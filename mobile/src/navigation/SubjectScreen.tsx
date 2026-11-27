import { createContext, useContext, type ReactNode } from 'react';
import { Button } from 'react-native-paper';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useSubjectAccess } from '../hooks/useSubjectAccess';
import { getCareSubjectWithAccess } from '../services/api';
import { accessFor, subjectDataIsCurrent } from '../services/subjectAccess';
import type { CareSubject } from '../types';

const SubjectContext = createContext<CareSubject | null>(null);

export function useCurrentCareSubject() {
  const subject = useContext(SubjectContext);
  if (!subject) throw new Error('La pantalla necesita una persona a cargo.');
  return subject;
}

export function SubjectScreen({ subjectId, children }: { subjectId: number; children: ReactNode }) {
  const access = useSubjectAccess();
  const { denied, revision } = accessFor(access, subjectId);
  // Al revocar se desmonta el contenido. Un acceso restablecido inicia una lectura nueva.
  const subject = useFetch(() => getCareSubjectWithAccess(subjectId), [
    access.generation, subjectId, denied ? revision - 1 : revision,
  ]);
  useRefreshOnFocus(subject.reload);

  if (subject.data && subjectDataIsCurrent(access, subject.data.access, subjectId)) {
    // Los formularios, vistas previas y lecturas previas se desmontan al retirar el permiso.
    return <SubjectContext.Provider key={revision} value={subject.data.data}>{children}</SubjectContext.Provider>;
  }
  if (!denied && subject.loading) return <LoadingView />;

  return (
    <FormScroll contentContainerStyle={{ padding: 20, gap: 12 }}>
      <StatusMessage message={denied ? 'Ya no tienes acceso a esta persona.' : subject.error ?? 'Vuelve a comprobar el acceso a esta persona.'} />
      <Button mode="outlined" onPress={subject.reload}>Reintentar</Button>
    </FormScroll>
  );
}
