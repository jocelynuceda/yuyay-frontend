import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ComponentProps } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { VoiceRecorder } from '../hooks/useVoiceRecorder';
import { imagePickerOptions } from '../services/attachmentFiles';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { formatDuration } from '../utils/attachments';
import { StatusMessage } from './StatusMessage';

function Option({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

/** Foto o audio de un registro nuevo. El archivo se sube recién al guardar el registro. */
export function EntryAttachmentField({
  photo,
  onPhotoChange,
  voice,
  disabled,
}: {
  photo: ImagePicker.ImagePickerAsset | null;
  onPhotoChange: (photo: ImagePicker.ImagePickerAsset | null) => void;
  voice: VoiceRecorder;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);

  function applyPicked(result: ImagePicker.ImagePickerResult) {
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    voice.discard();
    onPhotoChange(asset);
  }

  async function takePhoto() {
    setError(null);
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      setError('Activa el permiso de cámara en los ajustes del celular para tomar la foto.');
      return;
    }
    applyPicked(await ImagePicker.launchCameraAsync(imagePickerOptions));
  }

  async function pickImage() {
    setError(null);
    applyPicked(await ImagePicker.launchImageLibraryAsync(imagePickerOptions));
  }

  async function record() {
    setError(null);
    if (await voice.start()) onPhotoChange(null);
  }

  const remove = (
    <Pressable
      onPress={() => {
        onPhotoChange(null);
        voice.discard();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
    >
      <Text style={styles.remove}>Quitar</Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.label}>Foto o audio (opcional)</Text>
      <StatusMessage message={error ?? voice.error} />
      {voice.isRecording ? (
        <View style={styles.selected}>
          <Ionicons name="radio-button-on" size={22} color={colors.danger} />
          <Text style={styles.selectedText}>Grabando {formatDuration(voice.seconds)}</Text>
          <Pressable onPress={() => void voice.stop()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.stop}>Detener</Text>
          </Pressable>
        </View>
      ) : photo ? (
        <View style={styles.selected}>
          <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel="Foto elegida" />
          <Text style={styles.selectedText}>Foto lista</Text>
          {remove}
        </View>
      ) : voice.uri ? (
        <View style={styles.selected}>
          <Ionicons name="mic" size={22} color={colors.primary} />
          <Text style={styles.selectedText}>Nota de voz lista</Text>
          {remove}
        </View>
      ) : (
        <View style={styles.options}>
          <Option icon="camera-outline" label="Tomar foto" onPress={() => void takePhoto()} />
          <Option icon="image-outline" label="Galería" onPress={() => void pickImage()} />
          <Option icon="mic-outline" label="Grabar audio" onPress={() => void record()} />
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, marginTop: 10, marginBottom: 6 },
  options: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
  },
  pressed: { opacity: 0.7 },
  optionLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink, textAlign: 'center' },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumb: { width: 48, height: 48, borderRadius: radius.sm },
  selectedText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  stop: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  remove: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
}));
