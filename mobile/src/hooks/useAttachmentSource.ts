import { useEffect, useReducer } from 'react';
import { Platform } from 'react-native';
import { getAttachmentAccess, getPreviewImageSource } from '../services/api';
import { attachmentPreviewState } from './attachmentPreviewState';

/** El enlace firmado es sensible y no debe quedar en los registros. */
export function safeMessage(error: unknown) {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'error desconocido';
  return text.replace(/https?:\/\/\S+/g, '[url]');
}

export function useAttachmentSource(subjectId: number, attachmentId: number) {
  const [state, dispatch] = useReducer(attachmentPreviewState, {
    status: 'loading', origin: Platform.OS === 'web' ? 'api' : 's3',
  });
  const { origin } = state;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let blobUri: string | undefined;
    (async () => {
      try {
        const source = origin === 's3'
          ? { uri: (await getAttachmentAccess(subjectId, attachmentId)).url }
          : await getPreviewImageSource(subjectId, attachmentId, controller.signal);
        if (Platform.OS === 'web') blobUri = source.uri;
        if (active) dispatch({ type: 'loaded', origin, source });
        else if (blobUri) URL.revokeObjectURL(blobUri);
      } catch (error) {
        if (!active) return;
        console.warn('[AttachmentPreview]', origin, safeMessage(error));
        dispatch({ type: 'error', origin });
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (blobUri) URL.revokeObjectURL(blobUri);
    };
  }, [subjectId, attachmentId, origin]);

  return { state, onImageError: () => dispatch({ type: 'error', origin }) };
}
