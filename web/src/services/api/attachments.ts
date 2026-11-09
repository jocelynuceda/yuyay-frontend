import { api } from '../http'
import type { Attachment, AttachmentAccess } from '../../types'

/** Subir o descargar un archivo tarda más que una petición normal. */
const FILE_TIMEOUT_MS = 60000

const base = (careSubjectId: number) => `/care-subjects/${careSubjectId}/attachments`

export async function listAttachments(careSubjectId: number, signal?: AbortSignal) {
  const { data } = await api.get<Attachment[]>(base(careSubjectId), { signal })
  return data
}

export async function getAttachment(careSubjectId: number, attachmentId: number, signal?: AbortSignal) {
  const { data } = await api.get<Attachment>(`${base(careSubjectId)}/${attachmentId}`, { signal })
  return data
}

export async function uploadAttachment(careSubjectId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Attachment>(base(careSubjectId), form, {
    // Reemplaza el JSON por defecto: con él axios convertiría el FormData en texto
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: FILE_TIMEOUT_MS,
  })
  return data
}

export async function deleteAttachment(careSubjectId: number, attachmentId: number) {
  await api.delete(`${base(careSubjectId)}/${attachmentId}`)
}

/** Solo se puede reintentar una lectura que falló. */
export async function retryAttachmentOcr(careSubjectId: number, attachmentId: number) {
  const { data } = await api.post<Attachment>(`${base(careSubjectId)}/${attachmentId}/ocr-retry`)
  return data
}

export async function getAttachmentContent(careSubjectId: number, attachmentId: number, signal?: AbortSignal) {
  const { data } = await api.get<Blob>(`${base(careSubjectId)}/${attachmentId}/content`, {
    responseType: 'blob',
    timeout: FILE_TIMEOUT_MS,
    signal,
  })
  return data
}

/** Enlace temporal al archivo: no guardarlo. Sin S3 (desarrollo) el backend no lo genera. */
async function getAttachmentAccess(careSubjectId: number, attachmentId: number) {
  const { data } = await api.get<AttachmentAccess>(`${base(careSubjectId)}/${attachmentId}/access`)
  return data
}

async function attachmentUrl(careSubjectId: number, attachmentId: number) {
  try {
    return (await getAttachmentAccess(careSubjectId, attachmentId)).url
  } catch {
    const url = URL.createObjectURL(await getAttachmentContent(careSubjectId, attachmentId))
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return url
  }
}

/**
 * Abre el archivo original en otra pestaña. Debe llamarse en el clic para que el navegador no la bloquee.
 * Devuelve false si el navegador la bloqueó.
 */
export async function openAttachment(careSubjectId: number, attachmentId: number) {
  const tab = window.open('', '_blank')
  if (!tab) return false
  try {
    const url = await attachmentUrl(careSubjectId, attachmentId)
    tab.opener = null
    tab.location.href = url
    return true
  } catch (error) {
    tab.close()
    throw error
  }
}
