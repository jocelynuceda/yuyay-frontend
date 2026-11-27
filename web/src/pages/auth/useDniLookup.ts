import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { lookupDni } from '../../services/api/auth'
import { getErrorMessage } from '../../utils/apiErrors'
import type { ErrorResponse } from '../../types'

export type DniLookup =
  | { status: 'idle' | 'loading' }
  | { status: 'found'; fullName: string }
  /** Sin consulta configurada en el servidor: la persona escribe su nombre. */
  | { status: 'manual'; message: string }
  /** `invalid`: el problema es el número; si no, se puede reintentar con el mismo. */
  | { status: 'error'; message: string; invalid: boolean }

/** Consulta el nombre completo en cuanto el DNI tiene ocho dígitos. */
export function useDniLookup(dni: string) {
  const [result, setResult] = useState<{ key: string; lookup: DniLookup } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const complete = /^\d{8}$/.test(dni)
  const key = `${dni}:${attempt}`
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!complete) return
    const current = new AbortController()
    controller.current = current
    lookupDni(dni, current.signal)
      .then(({ fullName }) => {
        if (!current.signal.aborted) setResult({ key, lookup: { status: 'found', fullName } })
      })
      .catch((error: unknown) => {
        if (current.signal.aborted) return
        const body = axios.isAxiosError<ErrorResponse & { code?: string }>(error) ? error.response?.data : undefined
        const field = body?.fieldErrors?.find((item) => item.field === 'dni')?.message
        setResult({ key, lookup: body?.code === 'DNI_LOOKUP_NOT_CONFIGURED'
          ? { status: 'manual', message: getErrorMessage(error) }
          : { status: 'error', message: field ?? getErrorMessage(error), invalid: !!field } })
      })
    return () => current.abort()
  }, [dni, complete, key])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  const lookup: DniLookup = !complete ? { status: 'idle' } : result?.key === key ? result.lookup : { status: 'loading' }
  return { lookup, retry }
}
