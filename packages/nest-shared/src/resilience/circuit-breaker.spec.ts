import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';

function makeBreaker(nowRef: { value: number }) {
  return new CircuitBreaker({ failureThreshold: 3, openMs: 10_000, now: () => nowRef.value });
}

const failing = () => Promise.reject(new Error('boom'));
const succeeding = () => Promise.resolve('ok');

describe('CircuitBreaker', () => {
  it('stays closed under the failure threshold and resets on success', async () => {
    const breaker = makeBreaker({ value: 0 });
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    await expect(breaker.execute(succeeding)).resolves.toBe('ok'); // resets the count
    await expect(breaker.execute(failing)).rejects.toThrow('boom');
    expect(breaker.currentState).toBe('closed');
  });

  it('opens after N consecutive failures and fails fast while open', async () => {
    const now = { value: 0 };
    const breaker = makeBreaker(now);
    for (let i = 0; i < 3; i += 1) await breaker.execute(failing).catch(() => undefined);
    expect(breaker.currentState).toBe('open');

    // fail-fast: the wrapped fn is NOT called
    let called = false;
    await expect(
      breaker.execute(() => {
        called = true;
        return Promise.resolve('x');
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);
  });

  it('half-open probe: success closes the circuit', async () => {
    const now = { value: 0 };
    const breaker = makeBreaker(now);
    for (let i = 0; i < 3; i += 1) await breaker.execute(failing).catch(() => undefined);

    now.value = 10_001; // cool-down elapsed
    await expect(breaker.execute(succeeding)).resolves.toBe('ok');
    expect(breaker.currentState).toBe('closed');
  });

  it('half-open probe: failure reopens for another full cool-down', async () => {
    const now = { value: 0 };
    const breaker = makeBreaker(now);
    for (let i = 0; i < 3; i += 1) await breaker.execute(failing).catch(() => undefined);

    now.value = 10_001;
    await breaker.execute(failing).catch(() => undefined); // probe fails
    expect(breaker.currentState).toBe('open');

    now.value = 15_000; // still cooling down after the reopen
    await expect(breaker.execute(succeeding)).rejects.toBeInstanceOf(CircuitOpenError);

    now.value = 20_002;
    await expect(breaker.execute(succeeding)).resolves.toBe('ok');
    expect(breaker.currentState).toBe('closed');
  });
});
