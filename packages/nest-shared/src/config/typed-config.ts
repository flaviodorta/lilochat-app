import type { DynamicModule, InjectionToken } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Parses environment variables against a zod schema. Fails fast at boot with a
 * readable list of every invalid/missing variable — misconfigured services must
 * never start half-working.
 */
export function loadEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/**
 * Global module exposing the validated config object under a service-owned token:
 *
 *   TypedConfigModule.forRoot({ token: IDENTITY_CONFIG, schema: identityEnvSchema })
 */
export class TypedConfigModule {
  static forRoot<TSchema extends z.ZodTypeAny>(options: {
    token: InjectionToken;
    schema: TSchema;
    source?: NodeJS.ProcessEnv;
  }): DynamicModule {
    return {
      module: TypedConfigModule,
      global: true,
      providers: [
        {
          provide: options.token,
          useFactory: () => loadEnv(options.schema, options.source),
        },
      ],
      exports: [options.token],
    };
  }
}
