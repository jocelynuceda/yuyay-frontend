import type { Attachment, AttachmentAccess } from '../types';

export interface AttachmentPreview extends AttachmentAccess {
  document: Attachment;
  requestId: number;
  renewing: boolean;
}

interface Options {
  getAccess: (document: Attachment) => Promise<AttachmentAccess>;
  isActive: () => boolean;
  sessionGeneration: () => number;
  onChange: (preview: AttachmentPreview | null) => void;
  onError: (error: unknown) => void;
}

/** Cada apertura permite una sola renovación; cerrar invalida también las respuestas y eventos tardíos. */
export function createAttachmentPreview(options: Options) {
  let requestId = 0;
  let generation = 0;
  let preview: AttachmentPreview | null = null;
  let renewed = false;
  let active = true;

  function current(id: number) {
    return active && id === requestId && generation === options.sessionGeneration() && options.isActive();
  }

  function close() {
    requestId++;
    preview = null;
    options.onChange(null);
  }

  async function load(document: Attachment, id: number) {
    try {
      const access = await options.getAccess(document);
      if (!current(id)) return;
      if (!access.url.startsWith('https://') || !Number.isFinite(Date.parse(access.expiresAt)) || Date.parse(access.expiresAt) <= Date.now()) {
        throw new Error('Invalid attachment access');
      }
      preview = { ...access, document, requestId: id, renewing: false };
      options.onChange(preview);
    } catch (error) {
      if (!current(id)) return;
      close();
      options.onError(error);
    }
  }

  return {
    close,
    setActive(value: boolean) {
      active = value;
      if (!value) close();
    },
    isCurrent: (id: number) => preview?.requestId === id && current(id),
    open(document: Attachment) {
      close();
      generation = options.sessionGeneration();
      renewed = false;
      return load(document, requestId);
    },
    imageFailed(id: number) {
      if (preview?.requestId !== id || preview.renewing || !current(id)) return Promise.resolve();
      if (renewed) {
        close();
        options.onError(new Error('Attachment image unavailable'));
        return Promise.resolve();
      }
      renewed = true;
      const document = preview.document;
      preview = { ...preview, url: '', requestId: ++requestId, renewing: true };
      options.onChange(preview);
      return load(document, requestId);
    },
  };
}
