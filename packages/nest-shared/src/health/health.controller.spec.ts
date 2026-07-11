import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('live always answers ok', () => {
    const controller = new HealthController([]);
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('ready answers ok when every check passes', async () => {
    const controller = new HealthController([
      { name: 'postgres', check: async () => undefined },
      { name: 'redis', check: async () => undefined },
    ]);
    const result = await controller.ready();
    expect(result.status).toBe('ok');
    expect(result.checks).toHaveLength(2);
  });

  it('ready throws 503 when any check fails', async () => {
    const controller = new HealthController([
      { name: 'postgres', check: async () => undefined },
      {
        name: 'rabbitmq',
        check: async () => {
          throw new Error('connection refused');
        },
      },
    ]);
    await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ready answers ok with no registered checks (default)', async () => {
    const controller = new HealthController();
    await expect(controller.ready()).resolves.toEqual({ status: 'ok', checks: [] });
  });
});
