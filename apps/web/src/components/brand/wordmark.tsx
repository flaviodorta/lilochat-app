import Image from 'next/image';
import { cn } from '@/lib/cn';

/** Logo + wordmark. Luckiest Guy lives HERE and nowhere else (product-owner rule). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex select-none items-center gap-2', className)}>
      <Image src="/lilochat-logo.svg" alt="" width={30} height={28} priority />
      <span className="font-display text-2xl leading-none text-brand max-sm:hidden">LiloChat</span>
    </span>
  );
}
