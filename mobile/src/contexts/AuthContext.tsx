import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import { clearDelegateSession } from '../services/delegate';
import { NoSessionError, refreshSession, session, setSessionHandlers } from '../services/http';
import type { AuthResponse, User } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'recoverable' | 'logout-failed';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  recoveryError: string | null;
  retrySession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const restore = useCallback((active: () => boolean = () => true) => {
    const expected = session.generation;
    return refreshSession().then((result) => {
      if (!active() || expected !== session.generation) return;
      setUser(result.user);
      setStatus('authenticated');
    }).catch((error: unknown) => {
      if (!active()) return;
      if (error instanceof NoSessionError) {
        if (expected === session.generation) setStatus('anonymous');
      } else if (expected === session.generation) {
        setRecoveryError(error instanceof Error ? error.message : 'No pudimos recuperar la sesión.');
        setStatus('recoverable');
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = setSessionHandlers(() => {
      setUser(null);
      setStatus('anonymous');
    }, (message) => {
      setRecoveryError(message);
      setStatus('recoverable');
    });
    void restore(() => active);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [restore]);

  async function startSession(request: () => Promise<AuthResponse>) {
    const expected = session.generation;
    const result = await request();
    if (expected !== session.generation) throw new NoSessionError();
    const saving = session.replace(result);
    const savingGeneration = session.generation;
    await saving;
    if (savingGeneration !== session.generation) throw new NoSessionError();
    setUser(result.user);
    setStatus('authenticated');
    setRecoveryError(null);
  }

  const value: AuthContextValue = {
    status, user, recoveryError,
    retrySession: () => {
      if (status === 'logout-failed') return value.logout();
      setStatus('loading');
      setRecoveryError(null);
      return restore();
    },
    login: (email, password) => startSession(() => api.login(email, password)),
    register: (name, email, password) => startSession(() => api.register(name, email, password)),
    logout: async () => {
      // Un acceso delegado guardado no debe quedar a la vista de la siguiente persona que use el teléfono
      void Promise.resolve().then(clearDelegateSession).catch(() => {});
      const removal = session.logout();
      const expected = session.generation;
      setUser(null);
      setStatus('anonymous');
      setRecoveryError(null);
      try {
        await removal;
      } catch {
        if (expected !== session.generation) return;
        setRecoveryError('No pudimos borrar la sesión guardada. Reintenta el cierre de sesión.');
        setStatus('logout-failed');
      }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
