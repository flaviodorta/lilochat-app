import { beforeEach, describe, expect, it } from 'vitest';
import type { DomainEvent } from '@lilochat/contracts';
import type {
  BallotStore,
  PlaybackStateStore,
  PresenceReader,
  VoteRecord,
  VoteRepository,
  VoteScheduler,
} from '../domain/ports.js';
import type { PlaybackManager } from './playback-manager.js';
import {
  NoVideoPlayingError,
  VoteAlreadyOpenError,
  VoteCooldownError,
  VoteEngine,
  VoteNotFoundError,
} from './vote-engine.js';

class FakeVotes implements VoteRepository {
  rows = new Map<string, VoteRecord>();
  events: DomainEvent<unknown>[] = [];
  async createWithEvents(vote: VoteRecord, events: DomainEvent<unknown>[]) {
    this.rows.set(vote.id, { ...vote });
    this.events.push(...events);
  }
  async findOpen(roomId: string) {
    return [...this.rows.values()].find((v) => v.roomId === roomId && v.result === null) ?? null;
  }
  async findById(voteId: string) {
    return this.rows.get(voteId) ?? null;
  }
  async setResultWithEvents(
    voteId: string,
    result: 'PASSED' | 'FAILED',
    events: DomainEvent<unknown>[],
  ) {
    const row = this.rows.get(voteId);
    if (row) row.result = result;
    this.events.push(...events);
  }
  async appendEvents(events: DomainEvent<unknown>[]) {
    this.events.push(...events);
  }
  named(name: string) {
    return this.events.filter((e) => e.name === name);
  }
}

class FakeBallots implements BallotStore {
  yes = new Map<string, Set<string>>();
  cooldowns = new Set<string>();
  async addYes(voteId: string, userId: string) {
    const set = this.yes.get(voteId) ?? new Set<string>();
    const isNew = !set.has(userId);
    set.add(userId);
    this.yes.set(voteId, set);
    return isNew;
  }
  async countYes(voteId: string) {
    return this.yes.get(voteId)?.size ?? 0;
  }
  async clear(voteId: string) {
    this.yes.delete(voteId);
  }
  async setCooldown(roomId: string, itemId: string) {
    this.cooldowns.add(`${roomId}:${itemId}`);
  }
  async isCoolingDown(roomId: string, itemId: string) {
    return this.cooldowns.has(`${roomId}:${itemId}`);
  }
}

const ROOM = '00000000-0000-4000-8000-000000000001';
const ITEM = '00000000-0000-4000-8000-000000000002';

function makeEngine(present: { count: number }) {
  const votes = new FakeVotes();
  const ballots = new FakeBallots();
  const presence: PresenceReader = { countPresent: async () => present.count };
  const playing = { value: true };
  const playbackState = {
    get: async () =>
      playing.value
        ? { itemId: ITEM, videoId: 'v', title: 't', thumbUrl: 'u', durationMs: 1, startedAtMs: 0 }
        : null,
  } as unknown as PlaybackStateStore;
  const skips: string[] = [];
  const manager = {
    skip: async (roomId: string) => void skips.push(roomId),
  } as unknown as PlaybackManager;
  const scheduled: string[] = [];
  const cancelled: string[] = [];
  const scheduler: VoteScheduler = {
    scheduleResolution: async ({ voteId }) => void scheduled.push(voteId),
    cancelResolution: async (voteId) => void cancelled.push(voteId),
  };
  let ticks = 0;
  const engine = new VoteEngine({
    votes,
    ballots,
    presence,
    playbackState,
    manager,
    scheduler,
    clock: { now: () => new Date(1_000_000 + ticks++) },
    ids: { next: () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}` },
    windowS: 45,
    cooldownS: 90,
  });
  return { engine, votes, ballots, skips, scheduled, cancelled, playing, present };
}
let idSeq = 0;

const USER = (n: number) => `00000000-0000-4000-8000-9000000000${String(n).padStart(2, '0')}`;

beforeEach(() => {
  idSeq = 0;
});

describe('VoteEngine.start', () => {
  it('refuses when nothing is playing', async () => {
    const ctx = makeEngine({ count: 3 });
    ctx.playing.value = false;
    await expect(ctx.engine.start(ROOM, USER(1))).rejects.toBeInstanceOf(NoVideoPlayingError);
  });

  it('creates the vote: starter auto-yes, started event, resolution scheduled', async () => {
    const ctx = makeEngine({ count: 4 }); // needed = 3
    const snapshot = await ctx.engine.start(ROOM, USER(1));
    expect(snapshot).toMatchObject({ yes: 1, needed: 3, itemId: ITEM });
    expect(ctx.votes.named('playback.vote.started')).toHaveLength(1);
    expect(ctx.scheduled).toEqual([snapshot.voteId]);
    expect(ctx.skips).toHaveLength(0);
  });

  it('one open vote per room', async () => {
    const ctx = makeEngine({ count: 4 });
    await ctx.engine.start(ROOM, USER(1));
    await expect(ctx.engine.start(ROOM, USER(2))).rejects.toBeInstanceOf(VoteAlreadyOpenError);
  });

  it('respects the fail cooldown for the same item', async () => {
    const ctx = makeEngine({ count: 4 });
    await ctx.ballots.setCooldown(ROOM, ITEM);
    await expect(ctx.engine.start(ROOM, USER(1))).rejects.toBeInstanceOf(VoteCooldownError);
  });

  it('a solo room passes its own vote instantly', async () => {
    const ctx = makeEngine({ count: 1 }); // needed = 1
    await ctx.engine.start(ROOM, USER(1));
    expect(ctx.skips).toEqual([ROOM]);
    expect(ctx.votes.named('playback.vote.finished')[0]?.payload).toMatchObject({ passed: true });
  });
});

describe('VoteEngine.cast', () => {
  it('reaches quorum early → resolves passed and skips', async () => {
    const ctx = makeEngine({ count: 3 }); // needed = 2
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    const snapshot = await ctx.engine.cast(ROOM, voteId, USER(2));
    expect(snapshot.yes).toBe(2);
    expect(ctx.skips).toEqual([ROOM]);
    expect(ctx.cancelled).toContain(voteId);
    const finished = ctx.votes.named('playback.vote.finished');
    expect(finished[0]?.payload).toMatchObject({ passed: true, yes: 2, needed: 2 });
  });

  it('duplicate cast is idempotent (no progress event, count stays)', async () => {
    const ctx = makeEngine({ count: 5 }); // needed = 3
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    await ctx.engine.cast(ROOM, voteId, USER(2));
    const progressBefore = ctx.votes.named('playback.vote.progress').length;
    const snapshot = await ctx.engine.cast(ROOM, voteId, USER(2)); // again
    expect(snapshot.yes).toBe(2);
    expect(ctx.votes.named('playback.vote.progress')).toHaveLength(progressBefore);
  });

  it('rejects casts on unknown, resolved or expired votes', async () => {
    const ctx = makeEngine({ count: 5 });
    await expect(ctx.engine.cast(ROOM, USER(9), USER(2))).rejects.toBeInstanceOf(VoteNotFoundError);

    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    const vote = await ctx.votes.findById(voteId);
    if (vote) vote.endsAt = new Date(0); // expired
    await expect(ctx.engine.cast(ROOM, voteId, USER(3))).rejects.toBeInstanceOf(VoteNotFoundError);
  });
});

describe('VoteEngine resolution', () => {
  it('timeout without quorum → failed + cooldown, video keeps playing', async () => {
    const ctx = makeEngine({ count: 5 }); // needed = 3
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    await ctx.engine.cast(ROOM, voteId, USER(2)); // 2 < 3

    await ctx.engine.resolveByTimeout(voteId);
    expect(ctx.skips).toHaveLength(0);
    expect(await ctx.ballots.isCoolingDown(ROOM, ITEM)).toBe(true);
    expect(ctx.votes.named('playback.vote.finished')[0]?.payload).toMatchObject({
      passed: false,
      yes: 2,
      needed: 3,
    });
  });

  it('THE quorum-shrink edge: leavers deflate the denominator at the buzzer', async () => {
    const present = { count: 5 }; // needed = 3 at start
    const ctx = makeEngine(present);
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    await ctx.engine.cast(ROOM, voteId, USER(2)); // 2 yes — losing under needed=3

    present.count = 3; // two people left the room → needed = 2 now
    await ctx.engine.resolveByTimeout(voteId);

    expect(ctx.skips).toEqual([ROOM]); // the vote PASSES at resolution (§6.4)
    expect(ctx.votes.named('playback.vote.finished')[0]?.payload).toMatchObject({
      passed: true,
      yes: 2,
      needed: 2,
    });
  });

  it('resolveByTimeout after an early quorum resolution is a no-op (no double skip)', async () => {
    const ctx = makeEngine({ count: 3 }); // needed = 2
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    await ctx.engine.cast(ROOM, voteId, USER(2)); // resolved early

    await ctx.engine.resolveByTimeout(voteId); // the delayed job still fires
    expect(ctx.skips).toHaveLength(1);
    expect(ctx.votes.named('playback.vote.finished')).toHaveLength(1);
  });

  it('a new vote can start for the NEXT item after a failed one (cooldown is per item)', async () => {
    const ctx = makeEngine({ count: 5 });
    const { voteId } = await ctx.engine.start(ROOM, USER(1));
    await ctx.engine.resolveByTimeout(voteId); // fails, cooldown on ITEM
    await expect(ctx.engine.start(ROOM, USER(1))).rejects.toBeInstanceOf(VoteCooldownError);
    // (a different itemId would be allowed — cooldown keys include the item)
  });
});
