import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as api from '../services/api';
import { cancelAllDoseReminders, setDoseReminderUser, syncDoseReminders } from '../services/doseReminders';
import { cancelAllReminders, reconcileAllReminders } from '../services/reminders';
import { API_URL, NoSessionError, refreshSession, session, setSessionHandlers, vault } from '../services/http';
import { clearPendingPeople } from '../services/pendingPersonDraft';
import { pendingPersonKey } from '../services/pendingPersonStorage';
import type { AuthResponse, RegisterInput, RegistrationIdentity, User } from '../types';
import type { TermsAcceptance } from '../types/terms';

type AuthStatus = 'loading' | 'locked' | 'authenticated' | 'anonymous' | 'recoverable' | 'logout-failed';
export type UnlockResult = 'unlocked' | 'failed' | 'invalidated';

/** Tiempo fuera de la app (cámara, otra app) antes de volver a pedir biometría. */
const LOCK_AFTER_MS = 60_000;

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  recoveryError: string | null;
  retrySession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (account: RegisterInput, acceptance: TermsAcceptance) => Promise<void>;
  /** Ingresa o crea la cuenta con Google; el backend decide si la persona ya existe. */
  loginWithGoogle: (idToken: string, acceptedTermsVersion?: string, identity?: RegistrationIdentity) => Promise<void>;
  logout: () => Promise<void>;
  /** Actualiza el usuario en memoria después de editar el perfil. */
  updateUser: (user: User) => void;
  /** La sesión de este celular se abre con huella o rostro. */
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  /** Hay que desbloquear con biometría: al abrir la app (status 'locked') o al volver tras un rato fuera. */
  locked: boolean;
  unlock: () => Promise<UnlockResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [biometricEnabled, setBiometricState] = useState(false);
  const [resumeLocked, setResumeLocked] = useState(false);
  const statusRef = useRef(status);
  const signingOutDraftKey = useRef<string | undefined>(undefined);
  const biometricRef = useRef(biometricEnabled);
  useEffect(() => {
    statusRef.current = status;
    biometricRef.current = biometricEnabled;
  }, [status, biometricEnabled]);

  // Al entrar con sesión, los avisos de citas del celular se comparan con lo que hay en el servidor
  const userId = user?.id;
  useEffect(() => {
    if (status === 'authenticated' && userId !== undefined) {
      void reconcileAllReminders(userId);
      // Y los de las tomas, con lo que se marcó en otros celulares, solo a nombre de esta cuenta
      setDoseReminderUser(userId);
      void syncDoseReminders(userId);
    } else {
      setDoseReminderUser(null);
    }
  }, [status, userId]);

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
      setBiometricState(false);
      setResumeLocked(false);
    }, (message) => {
      setRecoveryError(message);
      setStatus('recoverable');
    });
    // Con biometría activada la sesión no se restaura hasta desbloquear: el token sigue cifrado
    vault.isEnabled().then((enabled) => {
      if (!active) return;
      setBiometricState(enabled);
      if (enabled) setStatus('locked');
      else void restore(() => active);
    }, () => {
      if (active) void restore(() => active);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [restore]);

  // Al volver a la app tras un rato fuera (o al abrirla desde un enlace) se vuelve a pedir biometría
  useEffect(() => {
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') leftAt = Date.now();
      else if (next === 'active' && leftAt !== null) {
        const away = Date.now() - leftAt;
        leftAt = null;
        if (away >= LOCK_AFTER_MS && biometricRef.current && statusRef.current === 'authenticated') setResumeLocked(true);
      }
    });
    return () => subscription.remove();
  }, []);

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
    updateUser: setUser,
    biometricEnabled,
    locked: status === 'locked' || resumeLocked,
    unlock: async () => {
      let result: 'unlocked' | 'invalidated';
      try {
        result = await vault.unlock();
      } catch {
        // Canceló, falló o el sensor está bloqueado: Yuyay sigue bloqueado
        return 'failed';
      }
      if (result === 'invalidated') {
        // Cambiaron las huellas o rostros del teléfono: la credencial ya no sirve, hay que volver a entrar
        await value.logout();
        return 'invalidated';
      }
      setResumeLocked(false);
      if (statusRef.current === 'locked') {
        setStatus('loading');
        await restore();
      }
      return 'unlocked';
    },
    setBiometricEnabled: async (enabled) => {
      await session.withToken(async (token) => {
        if (!token) throw new NoSessionError();
        await (enabled ? vault.enable(token) : vault.disable(token));
      });
      setBiometricState(enabled);
    },
    login: (email, password) => startSession(() => api.login(email, password)),
    register: (account, acceptance) => startSession(() => api.register(account, acceptance)),
    loginWithGoogle: (idToken, acceptedTermsVersion, identity) => startSession(() => api.loginWithGoogle(idToken, acceptedTermsVersion, identity)),
    logout: async () => {
      // Los avisos de citas son de esta cuenta: no deben sonar después de cerrar sesión
      void cancelAllReminders();
      void cancelAllDoseReminders();
      const removal = session.logout();
      if (user) signingOutDraftKey.current = pendingPersonKey(API_URL, user.id);
      const draftRemoval = clearPendingPeople(signingOutDraftKey.current);
      const expected = session.generation;
      setBiometricState(false);
      setResumeLocked(false);
      setUser(null);
      setStatus('loading');
      setRecoveryError(null);
      try {
        await Promise.all([removal, draftRemoval]);
        if (expected !== session.generation) return;
        signingOutDraftKey.current = undefined;
        setStatus('anonymous');
      } catch {
        if (expected !== session.generation) return;
        setRecoveryError('No pudimos borrar la sesión guardada. Reintenta el cierre de sesión.');
        setStatus('logout-failed');
      }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
