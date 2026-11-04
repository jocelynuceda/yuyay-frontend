import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Badge, type BadgeTone } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getAttachments, uploadAttachment } from '../services/api';
import { imageFormData, imagePickerOptions } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { HomeStackParamList, OcrStatus } from '../types';
import { isAudio } from '../utils/attachments';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Documents'>;

export const ocrBadge: Record<OcrStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Leyendo…', tone: 'amber' },
  DONE: { label: 'Listo', tone: 'accent' },
  FAILED: { label: 'Sin leer', tone: 'soft' },
};

/** Cada cuánto se revisa si el backend terminó de leer los documentos. */
export const OCR_POLL_MS = 3000;

export function DocumentsScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachments = useFetch(() => getAttachments(subjectId), [subjectId]);
  const { reload } = attachments;
  useRefreshOnFocus(reload);

  const reading = attachments.data?.some((a) => a.ocrStatus === 'PENDING') ?? false;
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(reload, OCR_POLL_MS);
    return () => clearInterval(timer);
    // `reload` cambia en cada render; el intervalo solo depende de si hay algo leyéndose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  if (attachments.loading && !attachments.data) return <LoadingView />;

  async function upload(result: ImagePicker.ImagePickerResult) {
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setUploading(true);
    setError(null);
    try {
      const attachment = await uploadAttachment(subjectId, imageFormData(asset));
      navigation.navigate('ReviewOcr', { subjectId, attachmentId: attachment.id });
    } catch (e) {
      if (e instanceof ApiError && e.status === 502) {
        setError('El servidor todavía no tiene configurado dónde guardar los documentos.');
      } else {
        setError(e instanceof ApiError ? e.message : 'No pudimos subir el documento.');
      }
    } finally {
      setUploading(false);
    }
  }

  async function takePhoto() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      setError('Activa el permiso de cámara en los ajustes del celular para tomar la foto.');
      return;
    }
    await upload(await ImagePicker.launchCameraAsync(imagePickerOptions));
  }

  async function pickImage() {
    await upload(await ImagePicker.launchImageLibraryAsync(imagePickerOptions));
  }

  // Las notas de voz tienen su propia pantalla
  const list = attachments.data?.filter((a) => !isAudio(a)) ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={attachments.refreshing} onRefresh={attachments.refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.intro}>
        Fotografía una receta o un resultado. Leemos el texto y tú lo revisas antes de crear el registro.
      </Text>

      <SubmitButton label="Tomar foto" icon="camera" onPress={takePhoto} loading={uploading} />
      <SubmitButton label="Elegir de la galería" icon="image-outline" onPress={pickImage} loading={uploading} />

      <StatusMessage message={error ?? attachments.error} />

      {list.length === 0 ? (
        <EmptyState title="Aún no hay documentos" description="Los documentos que subas aparecerán aquí." />
      ) : (
        list.map((a) => {
          const badge = ocrBadge[a.ocrStatus];
          return (
            <ListItem
              key={a.id}
              icon="document-text-outline"
              iconBg={colors.accentTint}
              iconFg={colors.accentText}
              title={a.originalFilename}
              subtitle={`${a.uploadedByName} · ${formatDate(a.uploadedAt)}`}
              right={<Badge label={badge.label} tone={badge.tone} />}
              onPress={() => navigation.navigate('ReviewOcr', { subjectId, attachmentId: a.id })}
            />
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
});
