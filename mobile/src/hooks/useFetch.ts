import { useEffect, useState } from 'react';
import { ApiError } from '../services/http';

interface FetchResult<T> {
  key: string;
  identity: string;
  data: T | null;
  error: string | null;
}

/**
 * Carga datos de la API con estados de carga y error.
 * `reload` vuelve a pedir los datos; `refresh` hace lo mismo mostrando el indicador de pull to refresh.
 */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<FetchResult<T> | null>(null);
  const identity = JSON.stringify(deps);
  const key = `${identity}:${version}`;

  useEffect(() => {
    let active = true;
    fetcher()
      .then((data) => active && setResult({ key, identity, data, error: null }))
      .catch((e) => {
        if (!active) return;
        const message = e instanceof ApiError ? e.message : 'No pudimos cargar la información.';
        setResult((prev) => ({ key, identity, data: prev?.identity === identity ? prev.data : null, error: message }));
      })
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
    // `key` resume las dependencias del llamador
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isCurrent = result?.key === key;
  return {
    data: result?.identity === identity ? result.data : null,
    error: isCurrent ? result.error : null,
    loading: !isCurrent,
    refreshing,
    reload: () => setVersion((v) => v + 1),
    refresh: () => {
      setRefreshing(true);
      setVersion((v) => v + 1);
    },
  };
}
