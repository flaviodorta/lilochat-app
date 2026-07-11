import { Inject, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { InjectionToken } from '@nestjs/common';
import { RabbitMqBus } from './rabbitmq-bus.js';

export const EVENT_BUS: unique symbol = Symbol('EVENT_BUS');

/**
 * Provides a connected RabbitMqBus as EVENT_BUS (global). Services publish via
 * the outbox relay (2.3) and register consumers with bindConsumer on boot.
 *
 *   MessagingModule.forRootAsync({
 *     useFactory: (config: RoomsConfig) => ({ url: config.RABBITMQ_URL }),
 *     inject: [ROOMS_CONFIG],
 *   })
 */
export class MessagingModule implements OnApplicationShutdown {
  constructor(@Inject(EVENT_BUS) private readonly bus: RabbitMqBus) {}

  static forRootAsync(options: {
    useFactory: (...args: never[]) => { url: string } | Promise<{ url: string }>;
    inject?: InjectionToken[];
  }): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      providers: [
        {
          provide: EVENT_BUS,
          useFactory: async (...args: never[]) => {
            const { url } = await options.useFactory(...args);
            return RabbitMqBus.connect(url);
          },
          inject: options.inject ?? [],
        },
      ],
      exports: [EVENT_BUS],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.bus.close();
  }
}
