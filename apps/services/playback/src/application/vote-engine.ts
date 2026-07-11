import { makeDomainEvent } from '@lilochat/nest-shared';
import type {
  BallotStore,
  Clock,
  IdGenerator,
  PlaybackStateStore,
  PresenceReader,
  VoteRecord,
  VoteRepository,
  VoteScheduler,
} from '../domain/ports.js';
import { DomainError } from '../domain/errors.js';
import type { PlaybackManager } from './playback-manager.js';

export class NoVideoPlayingError extends DomainError {
  readonly code = 'NO_VIDEO_PLAYING';
  constructor() {
    super('Nothing is playing — there is nothing to skip');
  }
}
export class VoteAlreadyOpenError extends DomainError {
  readonly code = 'VOTE_ALREADY_OPEN';
  constructor() {
    super('A skip vote is already running');
  }
}
export class VoteCooldownError extends DomainError {
  readonly code = 'VOTE_COOLDOWN';
  constructor() {
    super('A vote for this video just failed — wait a bit before trying again');
  }
}
export class VoteNotFoundError extends DomainError {
  readonly code = 'VOTE_NOT_FOUND';
  constructor() {
    super('This vote is not open (anymore)');
  }
}

export interface VoteSnapshot {
  voteId: string;
  itemId: string;
  endsAt: string;
  yes: number;
  needed: number;
}

/**
 * Skip voting (§3.4, §6.4). Window 45s, fail-cooldown 90s, one open vote per
 * room. Quorum = floor(present/2)+1, ALWAYS derived from CURRENT presence —
 * at cast-time for early resolution and again at timeout: leavers must not
 * inflate the denominator, and a shrinking room can turn a losing vote into
 * a passing one at the buzzer.
 */
export class VoteEngine {
  constructor(
    private readonly deps: {
      votes: VoteRepository;
      ballots: BallotStore;
      presence: PresenceReader;
      playbackState: PlaybackStateStore;
      manager: PlaybackManager;
      scheduler: VoteScheduler;
      clock: Clock;
      ids: IdGenerator;
      windowS: number; // 45
      cooldownS: number; // 90
    },
  ) {}

  private async needed(roomId: string): Promise<number> {
    const present = await this.deps.presence.countPresent(roomId);
    return Math.floor(Math.max(present, 1) / 2) + 1;
  }

  async start(roomId: string, startedBy: string): Promise<VoteSnapshot> {
    const { votes, ballots, playbackState, scheduler, clock, ids, windowS, cooldownS } = this.deps;

    const playing = await playbackState.get(roomId);
    if (!playing) throw new NoVideoPlayingError();
    if (await votes.findOpen(roomId)) throw new VoteAlreadyOpenError();
    if (await ballots.isCoolingDown(roomId, playing.itemId)) throw new VoteCooldownError();

    const now = clock.now();
    const vote: VoteRecord = {
      id: ids.next(),
      roomId,
      itemId: playing.itemId,
      startedBy,
      endsAt: new Date(now.getTime() + windowS * 1000),
      result: null,
      createdAt: now,
    };
    const needed = await this.needed(roomId);

    await ballots.addYes(vote.id, startedBy, windowS + 60); // starting IS voting yes
    await votes.createWithEvents(vote, [
      makeDomainEvent(
        'playback.vote.started',
        {
          roomId,
          voteId: vote.id,
          itemId: vote.itemId,
          startedBy,
          endsAt: vote.endsAt.toISOString(),
          needed,
          yes: 1,
        },
        now,
      ),
    ]);
    await scheduler.scheduleResolution({ voteId: vote.id, roomId, fireAt: vote.endsAt });

    // a 1-person room passes its own vote instantly
    if (1 >= needed) await this.resolve(vote, cooldownS);
    return {
      voteId: vote.id,
      itemId: vote.itemId,
      endsAt: vote.endsAt.toISOString(),
      yes: 1,
      needed,
    };
  }

  async cast(roomId: string, voteId: string, userId: string): Promise<VoteSnapshot> {
    const { votes, ballots, clock } = this.deps;

    const vote = await votes.findById(voteId);
    if (!vote || vote.roomId !== roomId || vote.result !== null) throw new VoteNotFoundError();
    if (vote.endsAt.getTime() <= clock.now().getTime()) throw new VoteNotFoundError();

    const isNew = await ballots.addYes(voteId, userId, this.deps.windowS + 60);
    const yes = await ballots.countYes(voteId);
    const needed = await this.needed(roomId);

    if (isNew) {
      await votes.appendEvents([
        makeDomainEvent('playback.vote.progress', { roomId, voteId, yes, needed }, clock.now()),
      ]);
    }
    if (yes >= needed) await this.resolve(vote, this.deps.cooldownS);

    return { voteId, itemId: vote.itemId, endsAt: vote.endsAt.toISOString(), yes, needed };
  }

  /** Fired by the delayed job at endsAt (or early via quorum). Idempotent. */
  async resolveByTimeout(voteId: string): Promise<void> {
    const vote = await this.deps.votes.findById(voteId);
    if (!vote || vote.result !== null) return; // already resolved (quorum path)
    await this.resolve(vote, this.deps.cooldownS);
  }

  private async resolve(vote: VoteRecord, cooldownS: number): Promise<void> {
    const { votes, ballots, manager, scheduler, clock } = this.deps;

    const fresh = await votes.findById(vote.id);
    if (!fresh || fresh.result !== null) return;

    const yes = await ballots.countYes(vote.id);
    const needed = await this.needed(vote.roomId); // §6.4: CURRENT presence decides
    const passed = yes >= needed;

    await votes.setResultWithEvents(vote.id, passed ? 'PASSED' : 'FAILED', [
      makeDomainEvent(
        'playback.vote.finished',
        { roomId: vote.roomId, voteId: vote.id, passed, yes, needed },
        clock.now(),
      ),
    ]);
    await scheduler.cancelResolution(vote.id);
    await ballots.clear(vote.id);

    if (passed) {
      await manager.skip(vote.roomId, 'vote');
    } else {
      await ballots.setCooldown(vote.roomId, vote.itemId, cooldownS);
    }
  }
}
