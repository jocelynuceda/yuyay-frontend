import { useRef } from 'react';
import { ApiError } from '../services/http';
import { confirmAction } from '../utils/confirm';
import { useToast } from './useToast';

export interface ConfirmedAction {
  /** Título, mensaje y botón de la confirmación. */
  confirm: [title: string, message: string, confirmLabel: string];
  action: () => Promise<unknown>;
  /** Aviso cuando sale bien. */
  success: string;
  /** Mensaje si falla sin un mensaje del servidor (sin conexión), o una función que traduce el error. */
  fallback: string | ((error: unknown) => string);
  onDone: () => void;
}

/**
 * Acción destructiva (borrar, quitar, revocar): pide confirmación, no deja ejecutarla dos veces
 * a la vez (doble toque), avisa el éxito y entrega el error a `onError` (null al empezar).
 */
export function useConfirmedAction(onError: (message: string | null) => void) {
  const toast = useToast();
  const running = useRef(false);

  return async ({ confirm, action, success, fallback, onDone }: ConfirmedAction) => {
    if (running.current) return;
    running.current = true;
    try {
      if (!(await confirmAction(...confirm))) return;
      onError(null);
      await action();
      toast(success);
      onDone();
    } catch (e) {
      onError(typeof fallback === 'function' ? fallback(e) : e instanceof ApiError ? e.message : fallback);
    } finally {
      running.current = false;
    }
  };
}
