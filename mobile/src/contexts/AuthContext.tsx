import { createContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../services/api';
import { refreshSession, setSessionExpiredHandler, tokenStore } from '../services/http';
import type { AuthResponse, User } from '../types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Al abrir la app se intenta recuperar la sesión con el refresh token guardado
    refreshSession()
      .then((res) => {
        setUser(res.user);
        setStatus('authenticated');
      })
      .catch(() => setStatus('anonymous'));

    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  async function startSession(res: AuthResponse) {
    await tokenStore.save(res);
    setUser(res.user);
    setStatus('authenticated');
  }

  const value: AuthContextValue = {
    status,
    user,
    login: async (email, password) => startSession(await api.login(email, password)),
    register: async (name, email, password) => startSession(await api.register(name, email, password)),
    logout: async () => {
      const refreshToken = await tokenStore.getRefresh();
      await tokenStore.clear();
      setUser(null);
      setStatus('anonymous');
      if (refreshToken) api.logout(refreshToken).catch(() => {});
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
