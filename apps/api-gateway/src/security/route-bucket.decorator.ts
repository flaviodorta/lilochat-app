import { SetMetadata } from '@nestjs/common';

export const ROUTE_BUCKET = 'lilochat:route_bucket';

/** Extra route-scoped token bucket on top of the global per-caller one (§9.1). */
export interface RouteBucketPolicy {
  /** Bucket namespace, e.g. 'queue-add' — one bucket per tag per caller. */
  tag: string;
  capacity: number;
  refillPerSec: number;
}

export const RouteBucket = (policy: RouteBucketPolicy) => SetMetadata(ROUTE_BUCKET, policy);
