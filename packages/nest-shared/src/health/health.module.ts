import type { DynamicModule, FactoryProvider, Provider } from '@nestjs/common';
import { HealthController, READINESS_CHECKS } from './health.controller.js';

export interface HealthModuleOptions {
  /** Factory building the service's ReadinessCheck[]; its `inject` tokens must be
   *  resolvable here — export them from a module passed via `imports`. */
  checks?: Omit<FactoryProvider, 'provide'>;
  /** Modules exporting the providers the checks factory injects (e.g. PrismaModule). */
  imports?: DynamicModule['imports'];
}

/**
 * Exposes GET /health/live and /health/ready.
 *
 *   HealthModule.forRoot({
 *     imports: [PrismaModule],
 *     checks: {
 *       useFactory: (prisma: PrismaService) => [
 *         { name: 'postgres', check: () => prisma.$queryRaw`SELECT 1` },
 *       ],
 *       inject: [PrismaService],
 *     },
 *   })
 */
export class HealthModule {
  static forRoot(options: HealthModuleOptions = {}): DynamicModule {
    const checksProvider: Provider = options.checks
      ? { provide: READINESS_CHECKS, ...options.checks }
      : { provide: READINESS_CHECKS, useValue: [] };

    return {
      module: HealthModule,
      imports: options.imports ?? [],
      controllers: [HealthController],
      providers: [checksProvider],
    };
  }
}
