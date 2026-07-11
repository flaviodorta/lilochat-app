import { Controller, Get, Inject, Optional, ServiceUnavailableException } from '@nestjs/common';

/** A named readiness probe (DB ping, Redis ping, broker ping…). Throw = not ready. */
export interface ReadinessCheck {
  name: string;
  check(): Promise<void>;
}

export const READINESS_CHECKS: unique symbol = Symbol('READINESS_CHECKS');

@Controller('health')
export class HealthController {
  constructor(
    @Optional()
    @Inject(READINESS_CHECKS)
    private readonly checks: ReadinessCheck[] = [],
  ) {}

  /** Liveness: the process is up and the event loop responds. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: every registered dependency answers. 503 while any is failing. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: unknown[] }> {
    const results = await Promise.all(
      this.checks.map(async ({ name, check }) => {
        try {
          await check();
          return { name, status: 'ok' as const };
        } catch (error) {
          return {
            name,
            status: 'error' as const,
            message: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    if (results.some((result) => result.status === 'error')) {
      throw new ServiceUnavailableException({ status: 'error', checks: results });
    }
    return { status: 'ok', checks: results };
  }
}
