import { useState } from 'react';
import { ApiError, getAccountTerms } from '../services/http';
import type { TermsAcceptance } from '../types/terms';
import { useFetch } from './useFetch';

export function needsTermsReview(error: unknown, status: 400 | 428 = 400): boolean {
  return error instanceof ApiError
    && error.status === status
    && (error.code === 'TERMS_ACCEPTANCE_REQUIRED' || error.code === 'TERMS_VERSION_OUTDATED');
}

/** Mantiene la aceptación ligada a la versión que se mostró en el formulario. */
export function useAccountTerms() {
  const [open, setOpen] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const { data: document, error, loading, reload } = useFetch(
    () => requested ? getAccountTerms() : Promise.resolve(null),
    [requested],
  );
  const acceptance: TermsAcceptance | null = document && !loading && !error && acceptedVersion === document.version
    ? { termsAccepted: true, termsVersion: document.version }
    : null;

  function show() {
    setOpen(true);
    setRequested(true);
    reload();
  }

  function review() {
    setAcceptedVersion(null);
    show();
  }

  function setAccepted(checked: boolean) {
    setAcceptedVersion(checked && document && !loading && !error ? document.version : null);
  }

  return { document, error, loading, reload, open, show, close: () => setOpen(false), review, acceptance, setAccepted };
}
