'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/auth-context';
import { AuthModal } from '@/features/auth/auth-modal';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* §12.1: every motion component honors prefers-reduced-motion */}
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          {children}
          <AuthModal />
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
