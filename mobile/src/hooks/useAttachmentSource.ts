import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAttachmentAccess, getAttachmentSource } from '../services/api';

type Source = Awaited<ReturnType<typeof getAttachmentSource>>;

/** De dónde sale la imagen: enlace firmado de S3 o API con token. */
export type SourceOrigin = 's3' | 'api';

/** Mensaje de un error sin la URL: el enlace firmado es sensible y no debe quedar en los registros. */
export function safeMessage(error: unknown) {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : 'error desconocido';
  return text.replace(/https?:\/\/\S+/g, '[url]');
}

/**
 * Carga la imagen de un adjunto privado y libera el blob al salir en la web.
 * Con preferSigned, en iOS y Android intenta primero el enlace firmado de S3 (sin cabeceras) y,
 * si falla, usa la vía con token. fallbackToToken permite forzar esa vía cuando la imagen no se pinta.
 */
export function useAttachmentSource(
  subjectId: number,
  attachmentId: number,
  enabled: boolean,
  options: { preferSigned?: boolean } = {},
) {
  const preferSigned = !!options.preferSigned && Platform.OS !== 'web';
  const key = `${subjectId}:${attachmentId}`;
  const [loaded, setLoaded] = useState<{ key: string; source: Source; origin: SourceOrigin } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // Adjunto para el que ya se descartó el enlace firmado
  const [tokenKey, setTokenKey] = useState<string | null>(null);
  const forceToken = tokenKey === key;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let uri: string | null = null;
    (async () => {
      if (preferSigned && !forceToken) {
        try {
          const access = await getAttachmentAccess(subjectId, attachmentId);
          if (active) setLoaded({ key, source: { uri: access.url }, origin: 's3' });
          return;
        } catch (e) {
          console.warn('[AttachmentPreview]', 's3', safeMessage(e));
        }
      }
      try {
        const source = await getAttachmentSource(subjectId, attachmentId);
        uri = source.uri;
        if (active) setLoaded({ key, source, origin: 'api' });
        else release(uri);
      } catch (e) {
        console.warn('[AttachmentPreview]', 'api', safeMessage(e));
        if (active) setFailedKey(key);
      }
    })();
    return () => {
      active = false;
      if (uri) release(uri);
    };
  }, [subjectId, attachmentId, enabled, preferSigned, forceToken, key]);

  const current = loaded?.key === key ? loaded : null;
  return {
    source: current?.source ?? null,
    origin: current?.origin ?? null,
    failed: failedKey === key && !current,
    fallbackToToken: () => setTokenKey(key),
  };
}

function release(uri: string) {
  if (Platform.OS === 'web') URL.revokeObjectURL(uri);
}
