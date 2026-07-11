'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LoginBody, RegisterBody, UserProfile } from '@lilochat/contracts';
import { api } from '@/lib/api';

/** What the gateway returns publicly — the refresh token stays in the httpOnly cookie. */
interface PublicSession {
  user: UserProfile;
  accessToken: string;
  accessTokenExpiresIn: number;
}

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';
type AuthModalMode = 'signin' | 'signup';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  accessToken: string | null;
  signIn(body: LoginBody): Promise<void>;
  signUp(body: RegisterBody): Promise<void>;
  signOut(): Promise<void>;
  authModal: { open: boolean; mode: AuthModalMode };
  openAuthModal(mode?: AuthModalMode): void;
  closeAuthModal(): void;
  setAuthModalMode(mode: AuthModalMode): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh a minute before expiry — the access token lives ONLY in memory. */
const REFRESH_MARGIN_SEC = 60;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: AuthModalMode }>({
    open: false,
    mode: 'signin',
  });
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // breaks the applySession ⇄ silentRefresh cycle without stale closures
  const silentRefreshRef = useRef<() => Promise<void>>(async () => {});

  const applySession = useCallback((session: PublicSession) => {
    setUser(session.user);
    setAccessToken(session.accessToken);
    setStatus('authenticated');

    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delayMs = Math.max(5, session.accessTokenExpiresIn - REFRESH_MARGIN_SEC) * 1000;
    refreshTimer.current = setTimeout(() => void silentRefreshRef.current(), delayMs);
  }, []);

  const clearSession = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    setUser(null);
    setAccessToken(null);
    setStatus('anonymous');
  }, []);

  const silentRefresh = useCallback(async () => {
    try {
      applySession(await api<PublicSession>('/auth/refresh', { method: 'POST' }));
    } catch {
      clearSession();
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    silentRefreshRef.current = silentRefresh;
  }, [silentRefresh]);

  // resume the session from the httpOnly cookie on first load
  useEffect(() => {
    void silentRefresh();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [silentRefresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      async signIn(body) {
        applySession(await api<PublicSession>('/auth/login', { method: 'POST', body }));
        setAuthModal((m) => ({ ...m, open: false }));
      },
      async signUp(body) {
        applySession(await api<PublicSession>('/auth/register', { method: 'POST', body }));
        setAuthModal((m) => ({ ...m, open: false }));
      },
      async signOut() {
        await api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
        clearSession();
      },
      authModal,
      openAuthModal(mode = 'signin') {
        setAuthModal({ open: true, mode });
      },
      closeAuthModal() {
        setAuthModal((m) => ({ ...m, open: false }));
      },
      setAuthModalMode(mode) {
        setAuthModal({ open: true, mode });
      },
    }),
    [status, user, accessToken, authModal, applySession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
