'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import {
  loginBodySchema,
  registerBodySchema,
  type LoginBody,
  type RegisterBody,
} from '@lilochat/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { Avatar } from './avatar';
import { useAuth } from './auth-context';

const FRIENDLY_ERRORS: Record<string, string> = {
  EMAIL_ALREADY_IN_USE: 'This email is already registered — try signing in.',
  NICKNAME_ALREADY_IN_USE: 'That nickname is taken. Pick another one!',
  INVALID_CREDENTIALS: 'Wrong email or password.',
  RATE_LIMITED: 'Too many attempts — take a breath and try again in a minute.',
  NETWORK_UNREACHABLE:
    'Cannot reach the LiloChat API. Is the backend running (and this origin in its CORS list)?',
};

function friendlyError(error: unknown): string {
  const known = error instanceof ApiError && error.code ? FRIENDLY_ERRORS[error.code] : undefined;
  return known ?? 'Something went wrong. Please try again.';
}

const slide = {
  initial: (direction: number) => ({ x: direction * 48, opacity: 0 }),
  animate: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -48, opacity: 0 }),
};

/** Panels differ in height — animate it so the centered dialog glides instead of jumping. */
function AnimatedHeight({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}

export function AuthModal() {
  const { authModal, closeAuthModal, setAuthModalMode } = useAuth();
  const direction = authModal.mode === 'signup' ? 1 : -1;

  return (
    <Dialog open={authModal.open} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="overflow-hidden">
        <AnimatedHeight>
          {/* popLayout pops the exiting panel to absolute — the container height
              tracks ONLY the entering panel, so AnimatedHeight glides once. */}
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            {authModal.mode === 'signin' ? (
              <motion.div
                key="signin"
                className="w-full"
                custom={direction}
                variants={slide}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <SignInPanel onSwitch={() => setAuthModalMode('signup')} />
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                className="w-full"
                custom={direction}
                variants={slide}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <SignUpPanel onSwitch={() => setAuthModalMode('signin')} />
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatedHeight>
      </DialogContent>
    </Dialog>
  );
}

function SignInPanel({ onSwitch }: { onSwitch: () => void }) {
  const { signIn } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginBody>({ resolver: zodResolver(loginBodySchema) });

  const onSubmit = form.handleSubmit(async (body) => {
    setServerError(null);
    try {
      await signIn(body);
    } catch (error) {
      setServerError(friendlyError(error));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <DialogTitle className="text-xl font-semibold text-zinc-100">Welcome back</DialogTitle>
        <DialogDescription className="text-sm text-zinc-400">
          Pick up right where the room left off.
        </DialogDescription>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        {serverError && <p className="text-sm text-live">{serverError}</p>}

        <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        New here?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="focus-ring rounded font-medium text-brand-soft hover:underline"
        >
          Create an account
        </button>
      </p>
    </div>
  );
}

function SignUpPanel({ onSwitch }: { onSwitch: () => void }) {
  const { signUp } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterBody>({ resolver: zodResolver(registerBodySchema) });

  // live avatar preview: debounce the nickname → gateway /avatars/:seed.svg
  const nickname = form.watch('nickname') ?? '';
  const [previewSeed, setPreviewSeed] = useState('lilochat');
  useEffect(() => {
    const valid = /^[a-zA-Z0-9_]{3,20}$/.test(nickname.trim());
    const timer = setTimeout(() => setPreviewSeed(valid ? nickname.trim() : 'lilochat'), 350);
    return () => clearTimeout(timer);
  }, [nickname]);

  const onSubmit = form.handleSubmit(async (body) => {
    setServerError(null);
    try {
      await signUp(body);
    } catch (error) {
      setServerError(friendlyError(error));
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <DialogTitle className="text-xl font-semibold text-zinc-100">Join LiloChat</DialogTitle>
        <DialogDescription className="text-sm text-zinc-400">
          Your nickname shapes your avatar — try a few!
        </DialogDescription>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Input
              label="Nickname"
              autoComplete="username"
              placeholder="video_wizard"
              error={form.formState.errors.nickname?.message}
              {...form.register('nickname')}
            />
          </div>
          <Avatar
            key={previewSeed}
            seed={previewSeed}
            size="md"
            className="mb-0.5 shrink-0 ring-2 ring-brand/40 transition-all"
          />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />

        {serverError && <p className="text-sm text-live">{serverError}</p>}

        <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="mt-2">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitch}
          className="focus-ring rounded font-medium text-brand-soft hover:underline"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
