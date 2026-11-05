import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Linking, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { deleteAttachment, getAttachmentAccess, getAttachments, retryAttachmentOcr, uploadAttachment } from '../services/attachments';
import { attachmentMimeType, AttachmentValidationError, type AttachmentFile } from '../services/attachmentUpload';
import { createAttachmentPreview, type AttachmentPreview } from '../services/attachmentPreview';
import { ApiError, session } from '../services/http';
import { colors, fonts, radius, shadow } from '../theme';
import type { Attachment, HomeStackParamList } from '../types';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Documents'>;
const ocrLabels = { PENDING: 'Leyendo documento', DONE: 'Lectura terminada', FAILED: 'Lectura no disponible' };

export function DocumentsScreen({ route }: Props) {
  const { subjectId } = route.params;
  const insets = useSafeAreaInsets();
  const documents = useFetch(() => getAttachments(subjectId), [subjectId]);
  useRefreshOnFocus(documents.reload);
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const focused = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Attachment | null>(null);
  const [preview, setPreview] = useState<AttachmentPreview | null>(null);
  const [expandedText, setExpandedText] = useState<number | null>(null);
  const [previewController] = useState(() => createAttachmentPreview({
    getAccess: (document) => getAttachmentAccess(document.careSubjectId, document.id),
    isActive: () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    sessionGeneration: () => session.generation,
    onChange: setPreview,
    onError: (e) => setError(e instanceof ApiError ? e.message
      : 'No pudimos cargar el archivo. Revisa tu conexión y pulsa Ver archivo para intentarlo de nuevo. Si el problema continúa, puede que el archivo ya no esté disponible.'),
  }));

  useFocusEffect(useCallback(() => {
    focused.current = true;
    previewController.setActive(true);
    return () => {
      focused.current = false;
      previewController.setActive(false);
      setConfirmation(null);
    };
  }, [previewController]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      previewController.setActive(state === 'active' && focused.current);
    });
    return () => subscription.remove();
  }, [previewController]);

  useEffect(() => {
    if (!preview || preview.renewing) return;
    const timer = setTimeout(() => {
      if (!previewController.isCurrent(preview.requestId)) return;
      previewController.close();
      setNotice('El acceso al archivo venció. Pulsa Ver archivo para abrirlo de nuevo.');
    }, Math.max(0, new Date(preview.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [preview, previewController]);

  async function runAction(key: string, action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      if (!focused.current) return;
      setError(e instanceof AttachmentValidationError || e instanceof ApiError
        ? (key === 'upload' && e instanceof ApiError && e.status === 0
          ? 'No recibimos confirmación de la subida. Actualiza la lista antes de intentarlo de nuevo.'
          : e.message)
        : 'No pudimos completar la acción. Inténtalo de nuevo.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function upload(file: AttachmentFile) {
    await runAction('upload', async () => {
      await uploadAttachment(subjectId, file);
      if (!focused.current) return;
      documents.reload();
      setNotice('Archivo guardado. La lectura del texto puede tardar un momento.');
    });
  }

  async function pickDocument() {
    setError(null);
    try {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: false, copyToCacheDirectory: true, base64: false,
      });
      if (selected.canceled || !focused.current) return;
      const file = selected.assets[0];
      await upload({ uri: file.uri, name: file.name, mimeType: attachmentMimeType(file.name, file.mimeType), size: file.size, file: file.file });
    } catch {
      setError('No pudimos abrir el selector de archivos. Inténtalo de nuevo.');
    }
  }

  async function pickImage(camera: boolean) {
    setError(null);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(permission.canAskAgain
            ? 'Permite el acceso a la cámara para tomar una foto.'
            : 'El acceso a la cámara está desactivado. Puedes habilitarlo en los ajustes del teléfono o elegir una imagen.');
          return;
        }
      }
      // El selector de fotos del sistema no necesita acceso a toda la biblioteca.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
      const selected = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (selected.canceled || !focused.current) return;
      const image = selected.assets[0];
      if (Platform.OS === 'web') {
        const name = image.fileName ?? image.file?.name ?? 'imagen.jpg';
        await upload({ uri: image.uri, name, mimeType: attachmentMimeType(name, image.mimeType ?? image.file?.type), size: image.fileSize, file: image.file });
        return;
      }
      await runAction('upload', async () => {
        // iPhone puede entregar HEIC. Se exporta una copia JPEG, sin recortar el documento.
        const context = ImageManipulator.manipulate(image.uri, { maxWidth: 4096, maxHeight: 4096 });
        let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
        try {
          rendered = await context.renderAsync();
          const jpeg = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.95 });
          const name = `${(image.fileName ?? 'imagen').replace(/\.[^.]+$/, '')}.jpg`;
          await uploadAttachment(subjectId, { uri: jpeg.uri, name, mimeType: 'image/jpeg' });
          if (!focused.current) return;
          documents.reload();
          setNotice('Imagen guardada. La lectura del texto puede tardar un momento.');
        } finally {
          rendered?.release();
          context.release();
        }
      });
    } catch {
      setError('No pudimos abrir la cámara o la imagen. Puedes elegir un archivo JPG, PNG o PDF.');
    }
  }

  function viewDocument(document: Attachment) {
    void runAction(`view-${document.id}`, () => previewController.open(document));
  }

  function openPdf() {
    if (!preview || !previewController.isCurrent(preview.requestId)) return;
    if (Date.parse(preview.expiresAt) <= Date.now()) {
      previewController.close();
      setNotice('El acceso al archivo venció. Pulsa Ver archivo para abrirlo de nuevo.');
      return;
    }
    const url = preview.url;
    if (Platform.OS === 'web') {
      // Se ejecuta directamente en el clic para conservar la activación exigida por Safari.
      globalThis.open(url, '_blank', 'noopener,noreferrer');
      previewController.close();
    } else {
      const requestId = preview.requestId;
      void Linking.openURL(url).then(() => {
        if (previewController.isCurrent(requestId)) previewController.close();
      }).catch(() => {
        if (!previewController.isCurrent(requestId)) return;
        previewController.close();
        setError('No pudimos abrir el PDF. Pulsa Ver archivo para intentarlo de nuevo.');
      });
    }
  }

  function removeDocument() {
    if (!confirmation) return;
    const document = confirmation;
    void runAction(`delete-${document.id}`, async () => {
      await deleteAttachment(subjectId, document.id);
      setConfirmation(null);
      if (!focused.current) return;
      documents.reload();
      setNotice('Archivo eliminado.');
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.list} refreshControl={
      <RefreshControl refreshing={documents.refreshing} onRefresh={documents.refresh} tintColor={colors.primary} />
    }>
      <Text style={styles.title}>Imágenes y documentos</Text>
      <Text style={styles.intro}>Guarda recetas, resultados y otros documentos de esta persona. JPG, PNG o PDF de una página, hasta 10 MB.</Text>
      <View style={styles.actions}>
        <Button mode="contained" icon="image-outline" disabled={!!busy} onPress={() => void pickImage(false)}>Subir imagen</Button>
        <Button mode="outlined" icon="file-document-outline" disabled={!!busy} onPress={() => void pickDocument()}>Subir archivo</Button>
        {Platform.OS !== 'web' ? <Button mode="outlined" icon="camera-outline" disabled={!!busy} onPress={() => void pickImage(true)}>Tomar foto</Button> : null}
      </View>
      {busy === 'upload' ? <LoadingView label="Guardando archivo…" /> : null}
      <StatusMessage message={error ?? documents.error} />
      <StatusMessage tone="info" message={notice} />
      {documents.loading && !documents.data ? <LoadingView label="Cargando archivos…" /> : null}
      {documents.data?.length === 0 ? <Text style={styles.empty}>Aún no hay archivos. Puedes agregar una imagen o un documento.</Text> : null}
      <Button icon="refresh" disabled={!!busy || documents.loading} onPress={documents.refresh}>Actualizar lista</Button>

      {(documents.data ?? []).map((document) => (
        <View key={document.id} style={styles.card}>
          <Text style={styles.name}>{document.originalFilename}</Text>
          <Text style={styles.meta}>{document.contentType === 'application/pdf' ? 'PDF' : 'Imagen'} · {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB · {formatDate(document.uploadedAt)}</Text>
          <Text style={styles.meta}>Subido por {document.uploadedByName}</Text>
          <Badge label={ocrLabels[document.ocrStatus] ?? 'Estado de lectura desconocido'} tone={document.ocrStatus === 'FAILED' ? 'amber' : 'soft'} />
          {document.ocrStatus === 'PENDING' ? <Text style={styles.meta}>Actualiza la lista para consultar el resultado de la lectura.</Text> : null}
          {document.ocrStatus === 'FAILED' ? <Text style={styles.meta}>El archivo sigue guardado. Puedes verlo o volver a intentar la lectura.</Text> : null}
          {document.ocrStatus === 'DONE' && !document.ocrText ? <Text style={styles.meta}>No se encontró texto legible. Puedes ver el archivo original.</Text> : null}
          {document.ocrText ? <>
            <Button compact onPress={() => setExpandedText(expandedText === document.id ? null : document.id)}>
              {expandedText === document.id ? 'Ocultar texto' : 'Ver texto extraído'}
            </Button>
            {expandedText === document.id ? <>
              <Text style={styles.meta}>Revisa el texto con el documento original. Esta lectura no crea registros clínicos.</Text>
              <Text selectable style={styles.extracted}>{document.ocrText}</Text>
            </> : null}
          </> : null}
          <View style={styles.actions}>
            <Button compact icon="eye-outline" loading={busy === `view-${document.id}`} disabled={!!busy} onPress={() => viewDocument(document)}>Ver archivo</Button>
            {document.ocrStatus === 'FAILED' ? <Button compact icon="refresh" disabled={!!busy} loading={busy === `ocr-${document.id}`} onPress={() => {
              void runAction(`ocr-${document.id}`, async () => {
                await retryAttachmentOcr(subjectId, document.id);
                if (!focused.current) return;
                documents.reload();
                setNotice('Lectura solicitada. Actualiza la lista en un momento.');
              });
            }}>Reintentar lectura</Button> : null}
            <Button compact textColor={colors.danger} icon="delete-outline" disabled={!!busy} onPress={() => { setError(null); setConfirmation(document); }}>Eliminar</Button>
          </View>
        </View>
      ))}

      <Portal>
        <Dialog visible={!!confirmation} onDismiss={() => { if (!busy) setConfirmation(null); }}>
          <Dialog.Title>Eliminar archivo</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.body}>Se eliminará «{confirmation?.originalFilename}». Esta acción no se puede deshacer.</Text>
            <StatusMessage message={error} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={!!busy} onPress={() => setConfirmation(null)}>Cancelar</Button>
            <Button textColor={colors.danger} disabled={!!busy} loading={busy?.startsWith('delete-')} onPress={removeDocument}>Eliminar archivo</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Modal visible={!!preview} onRequestClose={previewController.close} animationType="slide" presentationStyle="fullScreen">
        <View style={[styles.preview, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.name}>{preview?.document.originalFilename}</Text>
          <Button onPress={previewController.close} icon="close">Cerrar</Button>
          {preview?.renewing ? <LoadingView label="Renovando acceso al archivo…" /> : preview?.document.contentType.startsWith('image/') ? (
            <Image key={preview.requestId} accessibilityLabel={preview.document.originalFilename} source={{ uri: preview.url, cache: 'reload' }} resizeMode="contain" style={styles.image} onError={() => {
              void previewController.imageFailed(preview.requestId);
            }} />
          ) : preview ? <View style={styles.pdf}>
            <Text style={styles.body}>El PDF se abrirá en el visor de tu dispositivo. El acceso es temporal.</Text>
            <Button mode="contained" icon="open-in-new" onPress={openPdf}>Abrir PDF</Button>
          </View> : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40, gap: 14 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, gap: 10, ...shadow },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 19 },
  empty: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  extracted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink, backgroundColor: colors.surface, padding: 12, borderRadius: radius.sm },
  preview: { flex: 1, paddingHorizontal: 20, gap: 14, backgroundColor: colors.surface },
  image: { flex: 1, width: '100%' },
  pdf: { gap: 20, paddingTop: 30 },
});
