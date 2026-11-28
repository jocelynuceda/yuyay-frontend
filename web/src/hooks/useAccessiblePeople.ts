import { useContext, useMemo, useSyncExternalStore } from 'react'
import { AuthContext } from '../contexts/auth-context'
import { listCareSubjects } from '../services/api/careSubjects'
import { getCareSubjectAccessSnapshot, subscribeToCareSubjectAccess } from '../services/http'
import { useFetch } from './useFetch'
import { useRefreshOnReturn } from './useRefreshOnReturn'

export function useAccessiblePeople(accountId?: number, enabled = true) {
  const sessionUserId = useContext(AuthContext)?.user?.id
  const userId = accountId ?? sessionUserId
  const { data: directory, ...state } = useFetch(async (signal) => {
    if (!enabled) return null
    const accessAtStart = getCareSubjectAccessSnapshot()
    const subjects = await listCareSubjects(signal)
    return { subjects, accessAtStart, userId }
  }, [userId, enabled])
  const access = useSyncExternalStore(subscribeToCareSubjectAccess, getCareSubjectAccessSnapshot)
  const data = useMemo(() => {
    if (!directory || directory.userId !== userId) return null
    return directory.subjects.filter(({ id }) => access.get(id) === directory.accessAtStart.get(id))
  }, [directory, access, userId])
  useRefreshOnReturn(state.reload, enabled && !state.loading)
  return { data, ...state }
}
