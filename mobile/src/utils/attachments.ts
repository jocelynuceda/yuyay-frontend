import { ApiError } from '../services/http';
import type { Attachment } from '../types';

export const isAudio = (a: Pick<Attachment, 'contentType'>) => a.contentType.startsWith('audio/');
export const isImage = (a: Pick<Attachment, 'contentType'>) => a.contentType.startsWith('image/');

/** Segundos como m:ss. Algunos audios no informan su duración hasta terminar de cargar. */
export function formatDuration(seconds: number) {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function deleteErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return 'Solo quien subió el archivo o el cuidador principal puede borrarlo.';
  }
  return error instanceof ApiError ? error.message : 'No pudimos borrar el archivo.';
}
