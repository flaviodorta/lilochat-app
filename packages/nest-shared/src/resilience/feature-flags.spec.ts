import { describe, expect, it } from 'vitest';
import { FeatureFlags, type FlagClient } from './feature-flags.js';

const clientWith = (store: Record<string, string>): FlagClient & { calls: number } => ({
  calls: 0,
  async get(key: string) {
    this.calls += 1;
    return store[key] ?? null;
  },
});

describe('FeatureFlags (kill switches, §13.4)', () => {
  it('is ON by default (missing key) and OFF only when explicitly disabled', async () => {
    const flags = new FeatureFlags(clientWith({ 'flags:chat': '0', 'flags:votes': 'off' }));
    expect(await flags.isEnabled('room_creation')).toBe(true); // no key → on
    expect(await flags.isEnabled('chat')).toBe(false);
    expect(await flags.isEnabled('votes')).toBe(false);
  });

  it('caches reads so Redis stays off the hot path', async () => {
    const client = clientWith({});
    const flags = new FeatureFlags(client, { cacheMs: 60_000 });
    await flags.isEnabled('chat');
    await flags.isEnabled('chat');
    await flags.isEnabled('chat');
    expect(client.calls).toBe(1);
  });

  it('re-reads after the cache window (a flip propagates in seconds)', async () => {
    const store: Record<string, string> = {};
    const client = clientWith(store);
    const flags = new FeatureFlags(client, { cacheMs: 0 });
    expect(await flags.isEnabled('chat')).toBe(true);
    store['flags:chat'] = '0';
    expect(await flags.isEnabled('chat')).toBe(false);
  });

  it('fails OPEN on Redis errors — the brake must never become the outage', async () => {
    const broken: FlagClient = {
      get: async () => {
        throw new Error('redis down');
      },
    };
    const flags = new FeatureFlags(broken, { cacheMs: 0 });
    expect(await flags.isEnabled('chat')).toBe(true);
  });

  it('keeps the LAST KNOWN value while Redis is down', async () => {
    let down = false;
    const client: FlagClient = {
      get: async () => {
        if (down) throw new Error('redis down');
        return '0';
      },
    };
    const flags = new FeatureFlags(client, { cacheMs: 0 });
    expect(await flags.isEnabled('chat')).toBe(false); // read the kill while healthy
    down = true;
    expect(await flags.isEnabled('chat')).toBe(false); // outage keeps the switch thrown
  });
});
