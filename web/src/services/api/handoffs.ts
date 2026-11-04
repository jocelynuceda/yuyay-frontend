import { api, publicApi } from './client'
import type {
  Handoff,
  HandoffDetail,
  HandoffPublicView,
  HandoffRequest,
  HandoffSession,
  HandoffSessionCreated,
  HandoffSessionRequest,
  OpenHandoffRequest,
} from '../../types'

export async function listHandoffs(careSubjectId: number) {
  const { data } = await api.get<Handoff[]>(`/care-subjects/${careSubjectId}/handoffs`)
  return data
}

export async function getHandoff(handoffId: number) {
  const { data } = await api.get<HandoffDetail>(`/handoffs/${handoffId}`)
  return data
}

export async function createHandoff(careSubjectId: number, request: HandoffRequest) {
  const { data } = await api.post<HandoffDetail>(`/care-subjects/${careSubjectId}/handoffs`, request)
  return data
}

export async function deleteHandoff(handoffId: number) {
  await api.delete(`/handoffs/${handoffId}`)
}

/** Genera el enlace temporal (token) para el médico. */
export async function createHandoffSession(handoffId: number, request: HandoffSessionRequest) {
  const { data } = await api.post<HandoffSessionCreated>(`/handoffs/${handoffId}/sessions`, request)
  return data
}

export async function listHandoffSessions(handoffId: number) {
  const { data } = await api.get<HandoffSession[]>(`/handoffs/${handoffId}/sessions`)
  return data
}

export async function revokeHandoffSession(sessionId: number) {
  await api.delete(`/handoff-sessions/${sessionId}`)
}

// ---- Vista pública del médico (/traspaso/:token) ----

export async function openHandoffSession(token: string, request: OpenHandoffRequest) {
  const { data } = await publicApi.post<HandoffPublicView>(
    `/public/handoff-sessions/${encodeURIComponent(token)}/open`,
    request,
  )
  return data
}
