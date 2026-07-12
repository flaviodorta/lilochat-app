'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Room search (§3.2, debounced): the input drives the `q` URL param on the
 * home page, which the server component hands to RoomsGrid — shareable URLs,
 * works from any page (searching elsewhere brings you home).
 */
export function SearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // back/forward or a shared link changes the param → reflect it
  useEffect(() => {
    setValue(params.get('q') ?? '');
  }, [params]);

  useEffect(() => () => clearTimeout(debounce.current ?? undefined), []);

  const onChange = (next: string) => {
    setValue(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const target = next.trim() ? `/?q=${encodeURIComponent(next.trim())}` : '/';
      if (pathname === '/') router.replace(target, { scroll: false });
      else router.push(target);
    }, 300);
  };

  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-zinc-500 stroke-2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a room…"
        aria-label="Find a room"
        className="focus-ring h-9 w-full rounded-full border border-edge bg-surface pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-brand/50"
      />
    </div>
  );
}
