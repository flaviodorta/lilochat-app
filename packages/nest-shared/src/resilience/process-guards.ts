import type { Logger } from 'pino';

/**
 * Production survival stance (found by the 6.5 Redis-outage drill, where an
 * unhandled MaxRetriesPerRequestError from a library-internal promise killed
 * the realtime gateway):
 * - unhandledRejection → log loudly with the stack and SURVIVE. For a gateway
 *   holding thousands of sockets, staying up beats crashing on an infra blip;
 *   the error log + rate alert make it observable, not hidden.
 * - uncaughtException → log and exit(1): synchronous state is unknowable,
 *   the orchestrator restarts us (restart: unless-stopped).
 */
export function installProcessGuards(logger: Logger): void {
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection — surviving; investigate');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'uncaught exception — exiting');
    process.exit(1);
  });
}
