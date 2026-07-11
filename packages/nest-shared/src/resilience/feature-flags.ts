/** Anything with GET — ioredis satisfies this. */
export interface FlagClient {
  get(key: string): Promise<string | null>;
}

/** The v1 kill switches (CLAUDE.md §13.4) — cheap insurance for launch. */
export const FLAGS = {
  chat: 'chat',
  votes: 'votes',
  roomCreation: 'room_creation',
} as const;

/**
 * Redis-backed kill switches. Semantics chosen for emergencies:
 * - a flag is ON unless its key holds '0' | 'off' | 'false' — flipping means
 *   writing one Redis key, no deploy;
 * - reads are cached in-process (default 5 s) so a flip propagates in seconds
 *   without putting Redis on every request's hot path;
 * - Redis down → last known value, then ON (fail-open): the brake must never
 *   become the outage. Availability of the FEATURE beats the switch (§9.1).
 */
export class FeatureFlags {
  private readonly cache = new Map<string, { value: boolean; at: number }>();

  constructor(
    private readonly client: FlagClient,
    private readonly options: { prefix?: string; cacheMs?: number } = {},
  ) {}

  async isEnabled(name: string): Promise<boolean> {
    const cacheMs = this.options.cacheMs ?? 5_000;
    const hit = this.cache.get(name);
    if (hit && Date.now() - hit.at < cacheMs) return hit.value;

    let value: boolean;
    try {
      const raw = await this.client.get(`${this.options.prefix ?? 'flags'}:${name}`);
      value = raw !== '0' && raw !== 'off' && raw !== 'false';
    } catch {
      value = hit?.value ?? true;
    }
    this.cache.set(name, { value, at: Date.now() });
    return value;
  }
}
