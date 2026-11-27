import { api } from '../http'

export interface HandoffAccessCode {
  code: string | null
  consumed: boolean
  expiresAt: string
  serverTime: string
  periodSeconds: number
}

/** El código viene exclusivamente del servidor; nunca se genera ni persiste en el cliente. */
export async function getHandoffAccessCode(sessionId: number, signal?: AbortSignal, careSubjectId?: number): Promise<HandoffAccessCode> {
  const { data } = await api.get<HandoffAccessCode>(`/handoff-sessions/${sessionId}/access-code`, { signal, careSubjectId })
  const validCode = data?.consumed === true ? data.code === null : data?.consumed === false && typeof data.code === 'string' && /^[0-9]{6}$/.test(data.code)
  if (!validCode || data.periodSeconds !== 30 ||
      !Number.isFinite(Date.parse(data.expiresAt)) || !Number.isFinite(Date.parse(data.serverTime))) {
    throw new Error('Respuesta de código inválida.')
  }
  return data
}

/** Deadline monotónico: los ajustes del reloj local no prolongan la validez del código. */
export function accessCodeDeadline(code: HandoffAccessCode, startedAt: number, receivedAt: number): number {
  const serverRemaining = Date.parse(code.expiresAt) - Date.parse(code.serverTime)
  // Descontar todo el viaje de ida y vuelta es conservador: nunca añadimos latencia a la vigencia.
  return receivedAt + Math.min(code.periodSeconds * 1000, serverRemaining) - Math.max(0, receivedAt - startedAt)
}
