import type { Attachment } from '../types'

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

/** Valor del atributo `accept` del selector de archivos. */
export const DOCUMENT_ACCEPT = DOCUMENT_TYPES.join(',')

/** Devuelve el motivo por el que no se puede subir el archivo, o null si es válido. */
export function validateDocumentFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!DOCUMENT_TYPES.includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o PDF de una página.'
  if (file.size > MAX_DOCUMENT_BYTES) return 'El archivo pesa más de 10 MB.'
  return null
}

export const isImage = (attachment: Pick<Attachment, 'contentType'>) => attachment.contentType.startsWith('image/')

/** Las notas de voz también son adjuntos, pero no tienen texto que revisar. Los más nuevos van primero. */
export function documentsOnly(attachments: Attachment[]) {
  return attachments
    .filter((attachment) => !attachment.contentType.startsWith('audio/'))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}
