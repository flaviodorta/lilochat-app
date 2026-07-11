/**
 * Circuit breaker (course canon: closed / open / half-open — CLAUDE.md §9.1).
 * - closed: calls pass; N consecutive failures trip it open.
 * - open: calls fail fast (CircuitOpenError) until the cool-down elapses.
 * - half-open: one probe call is allowed; success closes, failure reopens.
 * Clock injectable for deterministic tests.
 */
export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit is open');
  }
}

type State = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the circuit. */
  failureThreshold: number;
  /** Cool-down before allowing the half-open probe (ms). */
  openMs: number;
  now?: () => number;
}

export class CircuitBreaker {
  private state: State = 'closed';
  private consecutiveFailures = 0;
  private openedAt = 0;
  private probeInFlight = false;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? Date.now;
  }

  get currentState(): State {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.now() - this.openedAt < this.options.openMs) throw new CircuitOpenError();
      this.state = 'half-open';
      this.probeInFlight = false;
    }

    if (this.state === 'half-open') {
      if (this.probeInFlight) throw new CircuitOpenError(); // only one probe at a time
      this.probeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
  }

  private onFailure(): void {
    if (this.state === 'half-open') {
      this.trip();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) this.trip();
  }

  private trip(): void {
    this.state = 'open';
    this.openedAt = this.now();
    this.consecutiveFailures = 0;
    this.probeInFlight = false;
  }
}
