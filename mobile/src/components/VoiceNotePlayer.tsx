import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { getAttachmentSource } from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { Attachment } from '../types';
import { formatDuration } from '../utils/attachments';
import { formatDate } from '../utils/format';

export function VoiceNotePlayer({
  note,
  onCreateEntry,
  onDelete,
}: {
  note: Attachment;
  onCreateEntry?: () => void;
  onDelete?: () => void;
}) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const blobUri = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (status.didJustFinish) void player.seekTo(0);
  }, [status.didJustFinish, player]);

  useEffect(
    () => () => {
      if (blobUri.current) URL.revokeObjectURL(blobUri.current);
    },
    [],
  );

  async function toggle() {
    if (status.playing) {
      player.pause();
      return;
    }
    if (loaded) {
      player.play();
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const source = await getAttachmentSource(note.careSubjectId, note.id);
      if (Platform.OS === 'web') blobUri.current = source.uri;
      player.replace(source);
      player.play();
      setLoaded(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const time = loaded
    ? `${formatDuration(status.currentTime)} / ${formatDuration(status.duration)}`
    : formatDate(note.uploadedAt);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          disabled={loading}
          style={styles.play}
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name={status.playing ? 'pause' : 'play'} size={22} color={colors.white} />
          )}
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Nota de {note.uploadedByName}</Text>
          <Text style={styles.time}>{failed ? 'No pudimos cargar el audio.' : time}</Text>
        </View>
      </View>
      {onCreateEntry || onDelete ? (
        <View style={styles.actions}>
          {onCreateEntry ? (
            <Pressable onPress={onCreateEntry} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>Crear registro</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.action, styles.danger]}>Borrar</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow, shadowOpacity: 0.06, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  time: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  action: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  danger: { color: colors.danger },
});
