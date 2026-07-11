import { avatarUrl } from '@/lib/api';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'size-7', md: 'size-9', lg: 'size-24' } as const;

/** Multiavatar via our gateway (cached + circuit-broken there). Plain <img>: SVG, no Next optimization needed. */
export function Avatar({
  seed,
  size = 'md',
  className,
}: {
  seed: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    // plain <img>: SVG served by our own gateway, Next image optimization adds nothing.
    // alt="" — decorative; broken-image alt text overflowing the circle looks awful.
    <img
      src={avatarUrl(seed)}
      alt=""
      aria-hidden
      className={cn('shrink-0 rounded-full bg-surface-raised object-cover', SIZES[size], className)}
    />
  );
}
