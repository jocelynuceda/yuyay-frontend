import { api, publicApi } from '../http'
import type {
  Handoff,
  HandoffDetail,
  HandoffPublicView,
  HandoffRequest,
  HandoffSession,
  HandoffSessionCreated,
  HandoffSessionRequest,
  OpenHandoffRequest,
  Page,
  PageParams,
} from '../../types'

export async function listHandoffs(careSubjectId: number, params: PageParams = {}, signal?: AbortSignal) {
  const { data } = await api.get<Handoff[] | Page<Handoff>>(`/care-subjects/${careSubjectId}/handoffs`, { params, signal })
  return data
}

export async function getHandoff(handoffId: number, signal?: AbortSignal, careSubjectId?: number) {
  const { data } = await api.get<HandoffDetail>(`/handoffs/${handoffId}`, { signal, careSubjectId })
  return data
}

export async function createHandoff(careSubjectId: number, request: HandoffRequest) {
  const { data } = await api.post<HandoffDetail>(`/care-subjects/${careSubjectId}/handoffs`, request)
  return data
}

/** Los enlaces compartidos dejan de funcionar. */
export async function deleteHandoff(handoffId: number, careSubjectId?: number) {
  await api.delete(`/handoffs/${handoffId}`, { careSubjectId })
}

export async function listHandoffSessions(handoffId: number, signal?: AbortSignal, careSubjectId?: number) {
  const { data } = await api.get<HandoffSession[]>(`/handoffs/${handoffId}/sessions`, { signal, careSubjectId })
  return data
}

/** Lo puede hacer quien creó el resumen o el cuidador principal. */
export async function revokeHandoffSession(sessionId: number, careSubjectId?: number) {
  await api.delete(`/handoff-sessions/${sessionId}`, { careSubjectId })
}

/** Genera el enlace temporal (token) para el médico. */
export async function createHandoffSession(handoffId: number, request: HandoffSessionRequest, careSubjectId?: number) {
  const { data } = await api.post<HandoffSessionCreated>(`/handoffs/${handoffId}/sessions`, { ...request, requireAccessCode: true }, { careSubjectId })
  return data
}

// ---- Vista pública del médico (/handoff/:token) ----
export async function getHandoffAccessRequirements(token: string, signal: AbortSignal) {
  const { data } = await publicApi.get<{ accessCodeRequired: boolean }>(
    `/public/handoff-sessions/${encodeURIComponent(token)}/access-requirements`,
    { signal },
  )
  return data.accessCodeRequired
}


export async function openHandoffSession(token: string, request: OpenHandoffRequest) {
  const { data } = await publicApi.post<HandoffPublicView>(
    `/public/handoff-sessions/${encodeURIComponent(token)}/open`,
    request,
  )
  return data
}

/** PDF del snapshot autorizado, con el permiso de esta apertura. */
export async function getHandoffSummaryPdf(token: string, accessGrant?: string | null, signal?: AbortSignal) {
  const { data } = await publicApi.get<Blob>(
    `/public/handoff-sessions/${encodeURIComponent(token)}/summary.pdf`,
    { responseType: 'blob', timeout: 60000, signal, ...(accessGrant ? { headers: { 'X-Handoff-Access': accessGrant } } : {}) },
  )
  if (!(data instanceof Blob) || data.type.split(';')[0] !== 'application/pdf') throw new Error('El servidor no devolvió un PDF válido.')
  return data
}

/** Respaldo de una versión incluida, sujeto a la vigencia del mismo enlace del resumen. */
export async function openHandoffSource(token: string, versionId: number, accessGrant?: string | null) {
  const tab = window.open('', '_blank')
  if (!tab) return false
  tab.opener = null
  try {
    const { data } = await publicApi.get<Blob>(
      `/public/handoff-sessions/${encodeURIComponent(token)}/versions/${versionId}/source/content`,
      { responseType: 'blob', timeout: 60000, ...(accessGrant ? { headers: { 'X-Handoff-Access': accessGrant } } : {}) },
    )
    const url = URL.createObjectURL(data)
    tab.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    return true
  } catch (error) {
    tab.close()
    throw error
  }
}
