'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'lilo_hint_dismissed';

/**
 * First-visit hint (§7.1 onboarding): one thin, dismissible line under the
 * hero. Rendered only after mount so SSR/hydration never disagree with
 * localStorage.
 */
export function OnboardingHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) === null);
    } catch {
      /* private mode etc. — just skip the hint */
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mx-auto mb-8 flex max-w-xl items-center gap-3 rounded-full border border-brand/30 bg-brand/10 py-2 pl-4 pr-2 text-sm text-zinc-300">
      <span aria-hidden>✨</span>
      <p className="flex-1 text-pretty">
        New here? Pick any room to start watching instantly — or create your own and build the
        queue.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="focus-ring rounded-full px-2.5 py-1 text-zinc-400 transition-colors hover:bg-brand/20 hover:text-zinc-100"
      >
        ✕
      </button>
    </div>
  );
}
