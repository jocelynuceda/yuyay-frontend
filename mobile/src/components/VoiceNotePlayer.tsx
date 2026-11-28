import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { getAttachmentSource } from '../services/api';
import { ApiError } from '../services/http';
import { FormField } from './FormField';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { Attachment } from '../types';
import { formatDuration, splitFilename } from '../utils/attachments';
import { formatDate } from '../utils/format';

export function VoiceNotePlayer({
  note,
  canManage,
  onRename,
  onDownload,
  onDelete,
}: {
  note: Attachment;
  /** Quien subió la nota o el cuidador principal puede cambiarle el nombre y borrarla. */
  canManage: boolean;
  onRename?: (filename: string) => Promise<void>;
  onDownload: () => Promise<void>;
  onDelete?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const blobUri = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stem, setStem] = useState('');
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const { extension } = splitFilename(note.originalFilename);

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

  function startRename() {
    setStem(splitFilename(note.originalFilename).stem);
    setRenameError(null);
    setEditing(true);
  }

  async function saveRename() {
    const clean = stem.trim();
    if (!onRename) return;
    if (!clean) {
      setRenameError('Escribe un nombre.');
      return;
    }
    setSaving(true);
    setRenameError(null);
    try {
      await onRename(clean + extension);
      setEditing(false);
    } catch (e) {
      setRenameError(e instanceof ApiError ? e.message : 'No pudimos cambiar el nombre.');
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    setOpening(true);
    setOpenFailed(false);
    try {
      await onDownload();
    } catch {
      setOpenFailed(true);
    } finally {
      setOpening(false);
    }
  }

  const subtitle = failed
    ? 'No pudimos cargar el audio.'
    : openFailed
      ? 'No pudimos abrir el audio.'
      : loaded
        ? `${formatDuration(status.currentTime)} / ${formatDuration(status.duration)}`
        : `${note.uploadedByName} · ${formatDate(note.uploadedAt)}`;

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
          <Text style={styles.title} numberOfLines={2}>
            {note.originalFilename}
          </Text>
          <Text style={styles.time}>{subtitle}</Text>
        </View>
      </View>
      {editing ? (
        <View style={styles.edit}>
          <View style={styles.editRow}>
            <View style={styles.flex}>
              <FormField
                value={stem}
                onChangeText={setStem}
                maxLength={255 - extension.length}
                disabled={saving}
                error={renameError ?? undefined}
                accessibilityLabel="Nombre de la nota de voz"
                autoFocus
              />
            </View>
            {extension ? <Text style={styles.extension}>{extension}</Text> : null}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={() => setEditing(false)} disabled={saving} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.action, saving && styles.disabled]}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => void saveRename()} disabled={saving} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.action, saving && styles.disabled]}>Guardar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {canManage && onRename ? (
            <Pressable onPress={startRename} hitSlop={8} accessibilityRole="button">
              <Text style={styles.action}>Cambiar nombre</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void download()} disabled={opening} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.action, opening && styles.disabled]}>{opening ? 'Abriendo…' : 'Descargar audio'}</Text>
          </Pressable>
          {canManage && onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.action, styles.danger]}>Borrar</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 12, ...shadow, shadowOpacity: 0.06, elevation: 2 },
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
  edit: { gap: 8 },
  editRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  extension: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted, marginTop: 18 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 20 },
  action: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  disabled: { opacity: 0.5 },
  danger: { color: colors.danger },
}));
