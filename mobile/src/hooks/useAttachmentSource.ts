import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getAttachmentSource } from '../services/api';

type Source = Awaited<ReturnType<typeof getAttachmentSource>>;

/** Carga la imagen de un adjunto privado y libera el blob al salir en la web. */
export function useAttachmentSource(subjectId: number, attachmentId: number, enabled: boolean) {
  const [source, setSource] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let uri: string | null = null;
    getAttachmentSource(subjectId, attachmentId)
      .then((loaded) => {
        uri = loaded.uri;
        if (active) setSource(loaded);
        else release(uri);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (uri) release(uri);
    };
  }, [subjectId, attachmentId, enabled]);

  return { source, failed };
}

function release(uri: string) {
  if (Platform.OS === 'web') URL.revokeObjectURL(uri);
}
