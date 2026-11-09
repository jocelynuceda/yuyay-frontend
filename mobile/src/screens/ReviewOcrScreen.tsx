import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AttachmentPreview } from '../components/AttachmentPreview';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { deleteAttachment, getAttachment, retryOcr } from '../services/api';
import { openAttachmentFile } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { fonts, makeStyles, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { deleteErrorMessage, isImage } from '../utils/attachments';
import { confirmAction } from '../utils/confirm';
import { OCR_POLL_MS } from './DocumentsScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'ReviewOcr'>;

export function ReviewOcrScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, attachmentId } = route.params;
  const [retrying, setRetrying] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachment = useFetch(() => getAttachment(subjectId, attachmentId), [subjectId, attachmentId]);
  const { reload } = attachment;

  const reading = attachment.data?.ocrStatus === 'PENDING';
  useEffect(() => {
    if (!reading) return;
    const timer = setInterval(reload, OCR_POLL_MS);
    return () => clearInterval(timer);
    // `reload` cambia en cada render; el intervalo solo depende de si se está leyendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  if (attachment.loading && !attachment.data) return <LoadingView />;
  if (!attachment.data) return <StatusMessage message={attachment.error ?? 'No encontramos el documento.'} />;

  const a = attachment.data;

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      await retryOcr(subjectId, attachmentId);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos reintentar la lectura.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleOpen() {
    setOpening(true);
    setError(null);
    try {
      await openAttachmentFile(subjectId, attachmentId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos abrir el archivo. Inténtalo de nuevo.');
    } finally {
      setOpening(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirmAction('Borrar documento', 'Esta acción no se puede deshacer.', 'Borrar');
    if (!confirmed) return;
    setError(null);
    try {
      await deleteAttachment(subjectId, attachmentId);
      navigation.goBack();
    } catch (e) {
      setError(deleteErrorMessage(e));
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <Text style={styles.file}>{a.originalFilename}</Text>
      {isImage(a) ? (
        <AttachmentPreview subjectId={subjectId} attachmentId={attachmentId} />
      ) : (
        <SubmitButton label="Abrir PDF" icon="open-in-new" onPress={handleOpen} loading={opening} />
      )}
      <StatusMessage message={error} />

      {a.ocrStatus === 'PENDING' ? (
        <View style={styles.reading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.readingText}>Leyendo el documento…</Text>
        </View>
      ) : null}

      {a.ocrStatus === 'FAILED' ? (
        <>
          <StatusMessage message="No pudimos leer el texto. Puedes reintentar o escribir el registro tú." />
          <SubmitButton label="Reintentar" icon="refresh" onPress={handleRetry} loading={retrying} />
          <SubmitButton
            label="Escribir el registro"
            icon="pencil-outline"
            onPress={() => navigation.navigate('NewEntry', { subjectId, sourceAttachmentId: attachmentId })}
          />
        </>
      ) : null}

      {a.ocrStatus === 'DONE' ? (
        <ReviewForm
          text={a.ocrText ?? ''}
          onConfirm={(details) =>
            navigation.navigate('NewEntry', { subjectId, details, sourceAttachmentId: attachmentId })
          }
        />
      ) : null}

      {a.ocrStatus !== 'PENDING' ? (
        <Pressable onPress={handleDelete} hitSlop={8} accessibilityRole="button">
          <Text style={styles.delete}>Borrar documento</Text>
        </Pressable>
      ) : null}
    </FormScroll>
  );
}

/** Se monta cuando el texto ya está listo, para que lo editado no se pierda al recargar. */
function ReviewForm({ text, onConfirm }: { text: string; onConfirm: (details: string) => void }) {
  const styles = useStyles();
  const [value, setValue] = useState(text);
  return (
    <>
      <FormCard title="Texto leído">
        <Text style={styles.help}>La lectura puede tener errores. Corrígela antes de continuar.</Text>
        <TextArea
          value={value}
          onChangeText={setValue}
          placeholder="No encontramos texto en este documento."
          maxLength={5000}
        />
      </FormCard>
      <SubmitButton label="Crear registro con este texto" icon="arrow-right" onPress={() => onConfirm(value.trim())} />
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  file: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  readingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  delete: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger, textAlign: 'center' },
}));
