import { useCallback, useEffect, useRef, useState } from 'react'
import { getCareSubject } from '../services/api/careSubjects'
import { subscribeToCareSubjectAccess } from '../services/http'
import type { CareSubject } from '../types'
import { getErrorMessage, getErrorStatus, isAccessLost } from '../utils/apiErrors'
import { useRefreshOnReturn } from './useRefreshOnReturn'

interface AccessState {
  subject: CareSubject | null
  error?: string
  errorStatus?: number
  loading: boolean
}

export function useCareSubjectAccess(subjectId: number) {
  const [state, setState] = useState<AccessState>({ subject: null, loading: true })
  const checkRef = useRef<() => void>(null)
  const reload = useCallback(() => checkRef.current?.(), [])

  useEffect(() => {
    let pending: AbortController | undefined
    let checkAgain = false

    function checkAccess(afterDeniedRequest = false) {
      if (pending) {
        checkAgain ||= afterDeniedRequest
        return
      }
      const controller = new AbortController()
      pending = controller
      setState((current) => ({ ...current, error: undefined, errorStatus: undefined, loading: true }))
      void getCareSubject(subjectId, controller.signal).then((subject) => {
        if (!controller.signal.aborted) setState({ subject, loading: false })
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return
        const status = getErrorStatus(error)
        setState((current) => ({
          subject: isAccessLost(status) ? null : current.subject,
          error: getErrorMessage(error),
          errorStatus: status,
          loading: false,
        }))
      }).finally(() => {
        if (pending !== controller) return
        pending = undefined
        if (checkAgain) {
          checkAgain = false
          checkAccess()
        }
      })
    }

    const unsubscribe = subscribeToCareSubjectAccess(({ subjectId: affectedSubject, denial }) => {
      if (affectedSubject !== subjectId) return
      if (denial) {
        pending?.abort()
        pending = undefined
        checkAgain = false
        setState({ subject: null, error: denial.message, errorStatus: denial.status, loading: false })
      } else {
        checkAccess(true)
      }
    })
    checkRef.current = checkAccess
    checkAccess()
    return () => {
      pending?.abort()
      pending = undefined
      unsubscribe()
      checkRef.current = null
    }
  }, [subjectId])
  useRefreshOnReturn(reload)

  return { ...state, reload }
}
