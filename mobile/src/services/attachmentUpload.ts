export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export class AttachmentValidationError extends Error {}

export interface AttachmentFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: File;
}

export function attachmentMimeType(name: string, mimeType?: string | null): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType.toLowerCase();
  const extension = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' } as Record<string, string>)[extension ?? ''] ?? '';
}

export function validateAttachment(file: AttachmentFile) {
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimeType)) {
    throw new AttachmentValidationError('Selecciona una imagen JPG o PNG, o un PDF de una página.');
  }
  const size = file.file?.size ?? file.size;
  if (size !== undefined && (!Number.isFinite(size) || size <= 0)) throw new AttachmentValidationError('El archivo está vacío o no se pudo leer.');
  if (size !== undefined && size > MAX_ATTACHMENT_BYTES) throw new AttachmentValidationError('El archivo supera el máximo de 10 MB.');
  if (!file.uri) throw new AttachmentValidationError('No pudimos leer el archivo seleccionado.');
}

/** Web necesita el File real; React Native interpreta el descriptor URI como archivo. */
export function appendAttachment(form: Pick<FormData, 'append'>, file: AttachmentFile, platform: 'web' | 'native') {
  validateAttachment(file);
  if (platform === 'web') {
    if (!file.file) throw new AttachmentValidationError('No pudimos leer el archivo. Vuelve a seleccionarlo.');
    form.append('file', file.file, file.name);
  } else {
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  }
}

// Sustituir el default JSON evita serializar FormData. Axios deja que web/RN generen el boundary.
export const attachmentUploadOptions = { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 };
