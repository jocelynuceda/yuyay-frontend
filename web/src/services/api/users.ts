import { api } from '../http'
import type { DocumentScopeSummary, UserProfile } from '../../types'

export async function getMe(signal?: AbortSignal) {
  const { data } = await api.get<UserProfile>('/users/me', { signal })
  return data
}

export async function updateMe(request: { name: string }) {
  const { data } = await api.patch<UserProfile>('/users/me', request)
  return data
}

/** Conteo de documentos propios por uso. Las versiones antiguas del servidor responden 404. */
export async function getDocumentScopeSummary(signal?: AbortSignal) {
  const { data } = await api.get<DocumentScopeSummary>('/users/me/document-scope', { signal })
  return data
}
