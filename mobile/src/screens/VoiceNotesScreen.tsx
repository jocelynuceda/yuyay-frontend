import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { FormCard, SubmitButton } from '../components/FormKit';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VoiceNotePlayer } from '../components/VoiceNotePlayer';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { deleteAttachment, getAttachments, uploadAttachment } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { HomeStackParamList } from '../types';
import { deleteErrorMessage, formatDuration, isAudio } from '../utils/attachments';
import { confirmAction } from '../utils/confirm';

type Props = NativeStackScreenProps<HomeStackParamList, 'VoiceNotes'>;

/** A 128 kbps son unos 5 MB, por debajo del límite de 10 MB del backend. */
const MAX_RECORDING_MS = 5 * 60 * 1000;

async function toFormData(uri: string) {
  const form = new FormData();
  const name = `nota-de-voz-${Date.now()}`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    // El navegador agrega el códec ("audio/webm;codecs=opus") y el backend compara el tipo exacto
    const type = blob.type.split(';')[0];
    form.append('file', new Blob([blob], { type }), `${name}.${type === 'audio/mp4' ? 'm4a' : 'webm'}`);
  } else {
    form.append('file', { uri, name: `${name}.m4a`, type: 'audio/mp4' } as unknown as Blob);
  }
  return form;
}

export function VoiceNotesScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 250);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useFetch(() => getAttachments(subjectId), [subjectId]);
  useRefreshOnFocus(attachments.reload);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true });
    return () => {
      if (limitTimer.current) clearTimeout(limitTimer.current);
    };
  }, []);

  async function stop() {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    await recorder.stop();
    // Con la grabación activa iOS saca el audio por el auricular y no por el altavoz
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    setRecordedUri(recorder.uri);
  }

  async function start() {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError('Activa el permiso de micrófono en los ajustes del celular para grabar.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      limitTimer.current = setTimeout(() => void stop(), MAX_RECORDING_MS);
    } catch {
      setError('No pudimos iniciar la grabación.');
    }
  }

  async function save() {
    if (!recordedUri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAttachment(subjectId, await toFormData(recordedUri));
      setRecordedUri(null);
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
        {recording.isRecording ? (
          <>
            <Text style={styles.timer}>{formatDuration(recording.durationMillis / 1000)}</Text>
            <SubmitButton label="Detener" icon="stop" onPress={stop} />
          </>
        ) : recordedUri ? (
          <View style={styles.saved}>
            <SubmitButton label="Guardar nota" onPress={save} loading={uploading} />
            <Pressable onPress={() => setRecordedUri(null)} disabled={uploading} hitSlop={8} accessibilityRole="button">
              <Text style={styles.discard}>Descartar</Text>
            </Pressable>
          </View>
        ) : (
          <SubmitButton label="Grabar" icon="microphone" onPress={start} />
        )}
      </FormCard>

      <StatusMessage message={error ?? attachments.error} />

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
