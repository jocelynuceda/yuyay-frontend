import { api, bearer, publicApi } from '../http'
import type {
  CategoryCode,
  DelegateConsultation,
  DelegateMe,
  DelegateSession,
  Delegation,
  DelegationCreated,
  DelegationRequest,
  HealthEntry,
} from '../../types'

export async function listDelegations(careSubjectId: number) {
  const { data } = await api.get<Delegation[]>(`/care-subjects/${careSubjectId}/delegations`)
  return data
}

/** Devuelve el token y el shareLink (/acceso/{token}) para compartir. */
export async function createDelegation(careSubjectId: number, request: DelegationRequest) {
  const { data } = await api.post<DelegationCreated>(`/care-subjects/${careSubjectId}/delegations`, request)
  return data
}

export async function revokeDelegation(delegationId: number) {
  await api.delete(`/delegations/${delegationId}`)
}

// ---- Vista pública del delegado (/acceso/:token) ----

/** Canjea el token del enlace por una sesión de delegado (sin login). */
export async function exchangeDelegationToken(token: string) {
  const { data } = await publicApi.post<DelegateSession>(`/public/delegations/${encodeURIComponent(token)}/exchange`)
  return data
}

export async function getDelegateMe(accessToken: string) {
  const { data } = await publicApi.get<DelegateMe>('/delegate/me', bearer(accessToken))
  return data
}

/** Citas compartidas, sin notas. El backend responde 403 si la delegación no las incluye. */
export async function listDelegateConsultations(accessToken: string) {
  const { data } = await publicApi.get<DelegateConsultation[]>('/delegate/consultations', bearer(accessToken))
  return data
}

/** Solo devuelve las categorías permitidas por la delegación. */
export async function listDelegateHealthEntries(accessToken: string, category?: CategoryCode) {
  const { data } = await publicApi.get<HealthEntry[]>('/delegate/health-entries', {
    ...bearer(accessToken),
    params: { category },
  })
  return data
}

export async function getDelegateHealthEntry(accessToken: string, entryId: number) {
  const { data } = await publicApi.get<HealthEntry>(`/delegate/health-entries/${entryId}`, bearer(accessToken))
  return data
}
