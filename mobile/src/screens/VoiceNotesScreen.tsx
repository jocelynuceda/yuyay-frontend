import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { FormCard, SubmitButton } from '../components/FormKit';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { deleteAttachment, getAttachments, uploadAttachment } from '../services/api';
import { audioFormData } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { HomeStackParamList } from '../types';
import { deleteErrorMessage, formatDuration, isAudio } from '../utils/attachments';
import { confirmAction } from '../utils/confirm';

type Props = NativeStackScreenProps<HomeStackParamList, 'VoiceNotes'>;

export function VoiceNotesScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const voice = useVoiceRecorder();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useFetch(() => getAttachments(subjectId), [subjectId]);
  useRefreshOnFocus(attachments.reload);

  async function save() {
    if (!voice.uri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAttachment(subjectId, await audioFormData(voice.uri));
      voice.discard();
      attachments.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos guardar la nota de voz.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: number) {
    const confirmed = await confirmAction('Borrar nota de voz', 'Esta acción no se puede deshacer.', 'Borrar');
    if (!confirmed) return;
    setError(null);
    try {
      await deleteAttachment(subjectId, id);
      attachments.reload();
    } catch (e) {
      setError(deleteErrorMessage(e));
    }
  }

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
        notes.map((note) => (
          <VoiceNotePlayer
            key={note.id}
            note={note}
            onCreateEntry={() =>
              navigation.navigate('NewEntry', { subjectId, sourceAttachmentId: note.id, returnToSource: true })
            }
            onDelete={() => void remove(note.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  timer: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, textAlign: 'center' },
  saved: { gap: 12 },
  discard: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger, textAlign: 'center' },
});
