/**
 * k6 WS load scenario (roadmap 6.2, CLAUDE.md §4.3 targets):
 *   steady   — 850 viewers spread over 49 rooms: join, heartbeat, ambient chat
 *   hot_room — 150 viewers in ONE room, each chatting every ~3 s (chat storm,
 *              per-user rate stays under the 1 msg/s token bucket on purpose:
 *              we're load-testing fan-out, not the limiter)
 *
 * Speaks engine.io v4 / socket.io v4 over a raw WebSocket (k6 has no
 * socket.io client): '0'=open, '2'/'3'=ping/pong, '40/ns'=connect,
 * '42/ns,[event,payload]'=event, '43/ns,id[...]'=ack.
 *
 * SLIs measured (§4.1): connect success, chat send→broadcast p95 (<500 ms),
 * chat send→persisted-ack p95 (full Rabbit→chat-service→Rabbit→RTG loop),
 * sync:ping RTT p95.
 *
 * Run (RTG load instance on :4215):
 *   docker run --rm --network host -v "$PWD/scripts/load:/load" grafana/k6 \
 *     run -e RTG_URL=ws://localhost:4215 /load/ws-scenario.js
 */
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const RTG_URL = __ENV.RTG_URL || 'ws://localhost:4215';
const STEADY_VUS = Number(__ENV.STEADY_VUS || 850);
const HOT_VUS = Number(__ENV.HOT_VUS || 150);
const SUSTAIN = __ENV.SUSTAIN || '3m';

const data = new SharedArray('load-data', () => [JSON.parse(open('./generated/load-data.json'))]);

const connectSuccess = new Rate('ws_connect_success');
const joinMs = new Trend('room_join_ms', true);
const chatDeliveryMs = new Trend('chat_delivery_ms', true);
const chatPersistMs = new Trend('chat_persist_ms', true);
const syncRttMs = new Trend('sync_rtt_ms', true);
const chatSent = new Counter('chat_sent');
const rateLimited = new Counter('chat_rate_limited');
const wsErrors = new Counter('ws_errors');

export const options = {
  scenarios: {
    steady: {
      executor: 'ramping-vus',
      exec: 'steady',
      startVUs: 0,
      stages: [
        { duration: '45s', target: STEADY_VUS },
        { duration: SUSTAIN, target: STEADY_VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulStop: '20s',
    },
    hot_room: {
      executor: 'ramping-vus',
      exec: 'hotRoom',
      startVUs: 0,
      stages: [
        { duration: '45s', target: HOT_VUS },
        { duration: SUSTAIN, target: HOT_VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulStop: '20s',
    },
  },
  thresholds: {
    ws_connect_success: ['rate>0.995'], // §4.1 availability
    chat_delivery_ms: ['p(95)<500'], // §4.1 chat delivery SLO
    sync_rtt_ms: ['p(95)<200'],
    room_join_ms: ['p(95)<1000'],
  },
};

/** One full viewer session; returns when the socket closes. */
function session({ token, roomId, chatEveryMs, sessionMs }) {
  const url = `${RTG_URL}/socket.io/?EIO=4&transport=websocket`;
  let joined = false;
  let counter = 0;
  const pendingChat = new Map(); // tempId → sentAt (delivery)
  const pendingAck = new Map(); // tempId → sentAt (persistence)
  let joinSentAt = 0;

  const res = ws.connect(url, {}, (socket) => {
    const send = (frame) => socket.send(frame);
    const emit = (event, payload, ackId) =>
      send(`42/room,${ackId !== undefined ? ackId : ''}${JSON.stringify([event, payload])}`);

    socket.on('open', () => {
      /* wait for the engine.io open packet */
    });

    socket.on('message', (raw) => {
      if (raw === '2') return send('3'); // engine.io heartbeat

      if (raw.startsWith('0{')) {
        // engine.io open → connect to /room with handshake auth
        return send(`40/room,${JSON.stringify({ token })}`);
      }

      if (raw.startsWith('40/room')) {
        // namespace accepted → join (ack id 1)
        joinSentAt = Date.now();
        return emit('room:join', { roomId }, 1);
      }

      if (raw.startsWith('44/room')) {
        // connect_error (unauthorized / server_full shed)
        connectSuccess.add(false);
        wsErrors.add(1);
        return socket.close();
      }

      const ackMatch = /^43\/room,(\d+)/.exec(raw);
      if (ackMatch && ackMatch[1] === '1') {
        // join ack (ack id 1 is reserved for room:join; chat acks are 101+)
        const ok = raw.includes('"ok":true');
        connectSuccess.add(ok);
        if (!ok) return socket.close();
        joined = true;
        joinMs.add(Date.now() - joinSentAt);

        // heartbeat + clock sync every 15 s
        socket.setInterval(() => {
          emit('sync:ping', { clientSentAt: Date.now() });
        }, 15000);

        // chat cadence (first message staggered per VU)
        socket.setTimeout(
          () => {
            socket.setInterval(() => {
              counter += 1;
              const tempId = `${__VU}-${counter}`;
              const sentAt = Date.now();
              pendingChat.set(tempId, sentAt);
              pendingAck.set(tempId, sentAt);
              chatSent.add(1);
              emit(
                'chat:send',
                { tempId, content: `k6 load ${tempId} lorem ipsum dolor sit` },
                counter + 100,
              );
            }, chatEveryMs);
          },
          Math.floor(Math.random() * chatEveryMs),
        );

        // end of session
        socket.setTimeout(() => socket.close(), sessionMs);
        return;
      }

      if (ackMatch) {
        // chat:send ack — rate_limited counts, errors surface
        if (raw.includes('rate_limited')) rateLimited.add(1);
        return;
      }

      if (raw.startsWith('42/room,')) {
        const payload = JSON.parse(raw.slice(raw.indexOf(',') + 1));
        const [event, body] = payload;
        if (event === 'sync:pong' && body && body.clientSentAt) {
          syncRttMs.add(Date.now() - body.clientSentAt);
        } else if (event === 'chat:new' && body && pendingChat.has(body.tempId)) {
          chatDeliveryMs.add(Date.now() - pendingChat.get(body.tempId));
          pendingChat.delete(body.tempId);
        } else if (event === 'chat:ack' && body && pendingAck.has(body.tempId)) {
          chatPersistMs.add(Date.now() - pendingAck.get(body.tempId));
          pendingAck.delete(body.tempId);
        }
        return;
      }
    });

    socket.on('error', () => {
      wsErrors.add(1);
      if (!joined) connectSuccess.add(false);
    });
  });

  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
}

// Disjoint token pools: sharing a user between scenarios shares their chat
// rate-limit bucket (found the hard way — 0.3% of sends came back
// rate_limited because a steady and a hot VU were the same userId).
export function steady() {
  const { tokens, roomIds } = data[0];
  const pool = tokens.length - HOT_VUS;
  const token = tokens[(__VU - 1) % pool];
  const roomId = roomIds[1 + ((__VU - 1) % (roomIds.length - 1))]; // rooms[1..49]
  session({ token, roomId, chatEveryMs: 45000, sessionMs: 300000 });
}

export function hotRoom() {
  const { tokens, roomIds } = data[0];
  const token = tokens[tokens.length - HOT_VUS + ((__VU - 1) % HOT_VUS)];
  session({ token, roomId: roomIds[0], chatEveryMs: 3000, sessionMs: 300000 });
}
