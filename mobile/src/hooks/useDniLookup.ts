import { useEffect, useState } from 'react';
import { lookupDni } from '../services/api';
import { ApiError } from '../services/http';

export type DniLookup =
  | { status: 'idle' | 'loading' }
  | { status: 'found'; fullName: string }
  /** Sin consulta configurada en el servidor: la persona escribe su nombre. */
  | { status: 'manual'; message: string }
  /** `invalid`: el problema es el número; si no, se puede reintentar con el mismo. */
  | { status: 'error'; message: string; invalid: boolean };

/** Consulta el nombre completo en cuanto el DNI tiene ocho dígitos. */
export function useDniLookup(dni: string) {
  const [result, setResult] = useState<{ key: string; lookup: DniLookup } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const complete = /^\d{8}$/.test(dni);
  const key = `${dni}:${attempt}`;

  useEffect(() => {
    if (!complete) return;
    let active = true;
    lookupDni(dni)
      .then(({ fullName }) => {
        if (active) setResult({ key, lookup: { status: 'found', fullName } });
      })
      .catch((e: unknown) => {
        if (!active) return;
        const api = e instanceof ApiError ? e : null;
        const message = api?.message ?? 'No pudimos consultar el DNI.';
        const field = api?.fieldErrors.dni;
        setResult({ key, lookup: api?.code === 'DNI_LOOKUP_NOT_CONFIGURED'
          ? { status: 'manual', message }
          : { status: 'error', message: field ?? message, invalid: !!field } });
      });
    return () => {
      active = false;
    };
  }, [dni, complete, key]);

  const lookup: DniLookup = !complete ? { status: 'idle' } : result?.key === key ? result.lookup : { status: 'loading' };
  return { lookup, retry: () => setAttempt((value) => value + 1) };
}
