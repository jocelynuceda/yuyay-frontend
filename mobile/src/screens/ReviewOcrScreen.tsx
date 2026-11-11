import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { AttachmentPreview } from '../components/AttachmentPreview';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import medicalTerms from '../data/medicalTerms.json';
import { useConfirmedAction } from '../hooks/useConfirmedAction';
import { useFetch } from '../hooks/useFetch';
import { deleteAttachment, getAttachment, retryOcr } from '../services/api';
import { openAttachmentFile } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { fonts, makeStyles, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { deleteErrorMessage, isImage } from '../utils/attachments';
import { categoryMeta } from '../utils/categories';
import { formatDate } from '../utils/format';
import { applyAcceptedMatches, createMedicalTermMatcher, type MedicalTermMatcher } from '../utils/medicalTermMatcher';
import { ocrEntryParams } from '../utils/ocrEntryDraft';
import { suggestEntryFromOcr, type OcrSuggestion } from '../utils/ocrSuggestions';
import { OCR_POLL_MS } from './DocumentsScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'ReviewOcr'>;

let cachedMatcher: MedicalTermMatcher | undefined;

export function ReviewOcrScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, attachmentId } = route.params;
  const [retrying, setRetrying] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runAction = useConfirmedAction(setError);
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

  const handleDelete = () =>
    runAction({
      confirm: ['Borrar documento', 'Esta acción no se puede deshacer.', 'Borrar'],
      action: () => deleteAttachment(subjectId, attachmentId),
      success: 'Documento borrado.',
      fallback: deleteErrorMessage,
      onDone: navigation.goBack,
    });

  return (
    <FormScroll contentContainerStyle={[formStyles.container, styles.container]}>
      <Text style={styles.file}>{a.originalFilename}</Text>
      {isImage(a) ? (
        <View style={styles.preview}>
          <AttachmentPreview subjectId={subjectId} attachmentId={attachmentId} />
          <Button mode="outlined" icon="open-in-new" onPress={handleOpen} loading={opening} disabled={opening}>
            Abrir imagen
          </Button>
        </View>
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
            onPress={() =>
              navigation.navigate('NewEntry', ocrEntryParams(subjectId, attachmentId, '', { evidence: {} }))
            }
          />
        </>
      ) : null}

      {a.ocrStatus === 'DONE' ? (
        <ReviewForm
          text={a.ocrText ?? ''}
          onConfirm={(details, suggestion) =>
            navigation.navigate('NewEntry', ocrEntryParams(subjectId, attachmentId, details, suggestion))
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
function ReviewForm({
  text,
  onConfirm,
}: {
  text: string;
  onConfirm: (details: string, suggestion: OcrSuggestion) => void;
}) {
  const styles = useStyles();
  const [value, setValue] = useState(text);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const reviewedText = useDeferredValue(value);
  const isCurrent = value === reviewedText;
  const suggestion = useMemo(() => suggestEntryFromOcr(value), [value]);
  const matches = useMemo(() => {
    if (!reviewedText.trim()) return [];
    cachedMatcher ??= createMedicalTermMatcher(medicalTerms);
    return cachedMatcher.findInText(reviewedText);
  }, [reviewedText]);
  const fields = [
    { label: 'Título', value: suggestion.title, evidence: suggestion.evidence.title },
    {
      label: 'Categoría',
      value: suggestion.categoryCode ? categoryMeta[suggestion.categoryCode].plural : undefined,
      evidence: suggestion.evidence.categoryCode,
    },
    {
      label: 'Fecha',
      value: suggestion.occurredOn ? formatDate(suggestion.occurredOn) : undefined,
      evidence: suggestion.evidence.occurredOn,
    },
  ].filter((field) => field.value);

  function toggleDismissed(key: string) {
    setDismissed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <FormCard title="Texto leído">
        <Text style={styles.help}>Compara el texto con el documento y corrige los errores antes de continuar.</Text>
        <TextArea
          accessibilityLabel="Texto leído"
          value={value}
          onChangeText={setValue}
          placeholder="No encontramos texto en este documento."
          maxLength={5000}
          autoCorrect={false}
          spellCheck={false}
          style={styles.editor}
        />
      </FormCard>
      {fields.length ? (
        <FormCard title="Campos sugeridos">
          <Text style={styles.help}>Podrás editar estos valores al crear el registro.</Text>
          {fields.map((field) => (
            <View key={field.label}>
              <Text style={styles.term}>{field.label} · {field.value}</Text>
              <Text style={styles.help}>En el texto: «{field.evidence}»</Text>
            </View>
          ))}
        </FormCard>
      ) : null}
      {matches.length ? (
        <FormCard title="Medicamentos y dispositivos detectados">
          <Text style={styles.help}>Verifica los nombres en el documento. Aceptar corrige solo ese nombre en el texto.</Text>
          {matches.map((match) => {
            const key = JSON.stringify([match.lineIndex, match.start, match.original, match.term]);
            const discarded = dismissed.has(key);
            return (
              <View key={key} style={styles.match}>
                <Text style={styles.term}>
                  {match.kind === 'known' ? match.original : `${match.original} → ¿${match.term}?`}
                </Text>
                <Text style={styles.help}>
                  Línea {match.lineIndex + 1}
                  {match.kind === 'known' ? ' · Reconocido' : discarded ? ' · Descartada' : ''}
                </Text>
                {match.kind === 'suggestion' ? (
                  <View style={styles.actions}>
                    {!discarded ? (
                      <Button
                        mode="contained-tonal"
                        disabled={!isCurrent}
                        accessibilityLabel={`Aceptar ${match.term} en lugar de ${match.original}, línea ${match.lineIndex + 1}`}
                        onPress={() => setValue((current) =>
                          current === reviewedText ? applyAcceptedMatches(current, [match]) : current,
                        )}
                      >
                        Aceptar
                      </Button>
                    ) : null}
                    <Button
                      disabled={!isCurrent}
                      accessibilityLabel={`${discarded ? 'Recuperar' : 'Descartar'} sugerencia ${match.term}, línea ${match.lineIndex + 1}`}
                      onPress={() => toggleDismissed(key)}
                    >
                      {discarded ? 'Deshacer' : 'Descartar'}
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })}
        </FormCard>
      ) : null}
      <SubmitButton label="Continuar al registro" icon="arrow-right" onPress={() => onConfirm(value, suggestion)} />
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  preview: { gap: 8 },
  editor: { height: 216 },
  file: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  reading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  readingText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  term: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  match: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  delete: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger, textAlign: 'center' },
}));
