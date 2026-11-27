import { useSyncExternalStore } from 'react';
import { getCareSubjectList, getNotifications, subjectAccess } from '../services/api';
import { subjectDataIsCurrent, type SubjectAccessSnapshot } from '../services/subjectAccess';
import { useFetch } from './useFetch';

export function useSubjectAccess() {
  return useSyncExternalStore(subjectAccess.subscribe, subjectAccess.getSnapshot);
}

/** Filtra una lectura de varias personas por la revisión de acceso con que se obtuvo cada fila. */
export function useSubjectRows<T>(
  fetcher: () => Promise<{ data: T[]; access: SubjectAccessSnapshot }>,
  subjectId: (row: T) => number | null,
) {
  const access = useSubjectAccess();
  const result = useFetch(fetcher);
  const loaded = result.data;
  const data = loaded && loaded.access.generation === access.generation ? loaded.data.filter((row) => {
    const id = subjectId(row);
    return id === null || subjectDataIsCurrent(access, loaded.access, id);
  }) : null;
  return { ...result, data };
}

export function useCareSubjects() {
  return useSubjectRows(getCareSubjectList, (subject) => subject.id);
}

async function loadNotificationRows() {
  const access = subjectAccess.getSnapshot();
  return { data: await getNotifications(), access };
}

export function useSubjectNotifications() {
  return useSubjectRows(loadNotificationRows, (row) => row.type === 'INVITATION' ? null : row.careSubjectId);
}
