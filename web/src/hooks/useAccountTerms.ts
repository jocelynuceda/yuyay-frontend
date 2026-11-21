import axios from 'axios'
import { useCallback, useState } from 'react'
import { getTerms } from '../services/api/auth'
import type { TermsAcceptance } from '../types/auth'
import { useFetch } from './useFetch'

export function needsTermsReview(error: unknown, status: 400 | 428 = 400): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== status) return false
  const code: unknown = error.response.data?.code
  return code === 'TERMS_ACCEPTANCE_REQUIRED' || code === 'TERMS_VERSION_OUTDATED'
}

/** Mantiene la aceptación ligada a la versión que se mostró en el formulario. */
export function useAccountTerms() {
  const [open, setOpen] = useState(false)
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)
  const loadTerms = useCallback((signal: AbortSignal) => requested ? getTerms(signal) : Promise.resolve(null), [requested])
  const { data: document, error, loading, reload } = useFetch(loadTerms, [loadTerms])
  const acceptance: TermsAcceptance | null = document && !loading && !error && acceptedVersion === document.version
    ? { termsAccepted: true, termsVersion: document.version }
    : null

  function show() {
    setOpen(true)
    setRequested(true)
    reload()
  }

  function review() {
    setAcceptedVersion(null)
    show()
  }

  function setAccepted(checked: boolean) {
    setAcceptedVersion(checked && document && !loading && !error ? document.version : null)
  }

  return { document, error, loading, reload, open, show, close: () => setOpen(false), review, acceptance, setAccepted }
}
