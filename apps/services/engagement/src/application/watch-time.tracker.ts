import type {
  PresenceCheckpointEvent,
  PresenceUserJoinedEvent,
  PresenceUserLeftEvent,
} from '@lilochat/contracts';
import { periodKeys } from './periods.js';

export interface SessionStore {
  open(session: { id: string; userId: string; roomId: string; startedAt: Date }): Promise<void>;
  /** Credits seconds + advances lastCheckpointAt; creates the session if the
   *  joined event was lost/out-of-order. Returns false when already ended. */
  credit(input: {
    sessionId: string;
    userId: string;
    roomId: string;
    seconds: number;
    at: Date;
  }): Promise<boolean>;
  /** Marks ended; returns ms since lastCheckpointAt (the uncredited residue). */
  end(sessionId: string, at: Date): Promise<number | null>;
  isRoomPlaying(roomId: string): Promise<boolean>;
  setRoomPlaying(roomId: string, playing: boolean, at: Date): Promise<void>;
  addToTotals(userId: string, periods: string[], seconds: number): Promise<void>;
}

export interface LeaderboardStore {
  increment(periodKeys: string[], userId: string, seconds: number): Promise<void>;
}

/**
 * Qualified watch time (§3.6/§6.5): seconds count ONLY while the room's player
 * is running. Checkpoints (≤60 s apart) are the durability unit; the left
 * event credits the residue since the last checkpoint. Consumer idempotency
 * (eventId dedup) upstream makes every handler here effectively-once.
 */
export class WatchTimeTracker {
  constructor(private readonly deps: { sessions: SessionStore; leaderboard: LeaderboardStore }) {}

  async onJoined(event: PresenceUserJoinedEvent): Promise<void> {
    const { roomId, userId, sessionId, at } = event.payload;
    await this.deps.sessions.open({
      id: sessionId,
      userId,
      roomId,
      startedAt: new Date(at),
    });
  }

  async onCheckpoint(event: PresenceCheckpointEvent): Promise<void> {
    const at = new Date(event.occurredAt);
    for (const entry of event.payload.entries) {
      if (!(await this.deps.sessions.isRoomPlaying(entry.roomId))) {
        // idle room: advance the checkpoint marker WITHOUT crediting
        await this.deps.sessions.credit({ ...entry, seconds: 0, at });
        continue;
      }
      const credited = await this.deps.sessions.credit({ ...entry, at });
      if (credited && entry.seconds > 0) {
        await this.award(entry.userId, entry.seconds, at);
      }
    }
  }

  async onLeft(event: PresenceUserLeftEvent): Promise<void> {
    const at = new Date(event.payload.at);
    const residueMs = await this.deps.sessions.end(event.payload.sessionId, at);
    if (residueMs === null) return;

    // credit the tail since the last checkpoint — only if the room is playing
    if (await this.deps.sessions.isRoomPlaying(event.payload.roomId)) {
      const seconds = Math.floor(residueMs / 1000);
      if (seconds > 0) await this.award(event.payload.userId, seconds, at);
    }
  }

  async onPlaybackStarted(roomId: string, at: Date): Promise<void> {
    await this.deps.sessions.setRoomPlaying(roomId, true, at);
  }

  /** video.skipped: the room is between videos (or idle) until the next started. */
  async onPlaybackStopped(roomId: string, at: Date): Promise<void> {
    await this.deps.sessions.setRoomPlaying(roomId, false, at);
  }

  private async award(userId: string, seconds: number, at: Date): Promise<void> {
    const keys = periodKeys(at);
    await this.deps.sessions.addToTotals(userId, keys, seconds);
    await this.deps.leaderboard.increment(keys, userId, seconds);
  }
}
