import { useContext, useMemo, useSyncExternalStore } from 'react'
import { AuthContext } from '../contexts/auth-context'
import { listCareSubjects } from '../services/api/careSubjects'
import { getCareSubjectAccessSnapshot, subscribeToCareSubjectAccess } from '../services/http'
import { useFetch } from './useFetch'
import { useRefreshOnReturn } from './useRefreshOnReturn'

export function useAccessiblePeople() {
  const userId = useContext(AuthContext)?.user?.id
  const { data: directory, ...state } = useFetch(async (signal) => {
    const accessAtStart = getCareSubjectAccessSnapshot()
    const subjects = await listCareSubjects(signal)
    return { subjects, accessAtStart, userId }
  }, [userId])
  const access = useSyncExternalStore(subscribeToCareSubjectAccess, getCareSubjectAccessSnapshot)
  const data = useMemo(() => {
    if (!directory || directory.userId !== userId) return null
    return directory.subjects.filter(({ id }) => access.get(id) === directory.accessAtStart.get(id))
  }, [directory, access, userId])
  useRefreshOnReturn(state.reload, !state.loading)
  return { data, ...state }
}
