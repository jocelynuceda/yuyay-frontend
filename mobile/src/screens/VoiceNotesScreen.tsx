import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { FormCard, SubmitButton } from '../components/FormKit';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { useAuth } from '../hooks/useAuth';
import { useConfirmedAction } from '../hooks/useConfirmedAction';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../hooks/useToast';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useCareSubjects } from '../hooks/useSubjectAccess';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { deleteAttachment, getAttachments, renameAttachment, uploadAttachment } from '../services/api';
import { audioFormData, openAttachmentFile } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { fonts, makeStyles, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { deleteErrorMessage, formatDuration, isAudio } from '../utils/attachments';

type Props = NativeStackScreenProps<HomeStackParamList, 'VoiceNotes'>;

export function VoiceNotesScreen({ route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId } = route.params;
  const voice = useVoiceRecorder();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runAction = useConfirmedAction(setError);
  const toast = useToast();
  const { user } = useAuth();
  const subjects = useCareSubjects();
  // Mientras la lista no carga se asume que no es principal
  const isPrincipal = subjects.data?.find((subject) => subject.id === subjectId)?.myRole === 'PRINCIPAL';
  const attachments = useFetch(() => getAttachments(subjectId), [subjectId]);
  useRefreshOnFocus(attachments.reload);

  async function save() {
    if (!voice.uri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAttachment(subjectId, await audioFormData(voice.uri));
      voice.discard();
      toast('Nota de voz guardada.');
      attachments.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos guardar la nota de voz.');
    } finally {
      setUploading(false);
    }
  }

  const remove = (id: number) =>
    runAction({
      confirm: ['Borrar nota de voz', 'Esta acción no se puede deshacer.', 'Borrar'],
      action: () => deleteAttachment(subjectId, id),
      success: 'Nota de voz borrada.',
      fallback: deleteErrorMessage,
      onDone: attachments.reload,
    });

  if (attachments.loading && !attachments.data) return <LoadingView />;

  const notes = attachments.data?.filter(isAudio) ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={attachments.refreshing} onRefresh={attachments.refresh} tintColor={colors.primary} />
      }
    >
      <FormCard title="Nueva nota">
        <Text style={styles.help}>Graba hasta 5 minutos. Todos los cuidadores de esta persona podrán escucharla.</Text>
        {voice.isRecording ? (
          <>
            <Text style={styles.timer}>{formatDuration(voice.seconds)}</Text>
            <SubmitButton label="Detener" icon="stop" onPress={voice.stop} />
          </>
        ) : voice.uri ? (
          <View style={styles.saved}>
            <SubmitButton label="Guardar nota" onPress={save} loading={uploading} />
            <Pressable onPress={voice.discard} disabled={uploading} hitSlop={8} accessibilityRole="button">
              <Text style={styles.discard}>Descartar</Text>
            </Pressable>
          </View>
        ) : (
          <SubmitButton label="Grabar" icon="microphone" onPress={voice.start} />
        )}
      </FormCard>

      <StatusMessage message={error ?? voice.error ?? attachments.error} />

      {notes.length === 0 ? (
        <EmptyState title="Aún no hay notas de voz" description="Las notas que grabes aparecerán aquí." />
      ) : (
        notes.map((note) => {
          const canManage = isPrincipal || note.uploadedById === user?.id;
          return (
            <VoiceNotePlayer
              key={note.id}
              note={note}
              canManage={canManage}
              onRename={async (filename) => {
                await renameAttachment(subjectId, note.id, filename);
                toast('Nombre guardado.');
                attachments.reload();
              }}
              onDownload={() => openAttachmentFile(subjectId, note.id)}
              onDelete={canManage ? () => void remove(note.id) : undefined}
            />
          );
        })
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  timer: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, textAlign: 'center' },
  saved: { gap: 12 },
  discard: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger, textAlign: 'center' },
}));
