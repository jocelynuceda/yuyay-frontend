import type { HandoffSession } from '../types';

export type HandoffLinkState = 'Revocado' | 'Vencido' | 'Abierto' | 'Sin abrir';

/**
 * Estado del enlace con la misma regla que el backend (HandoffSession.isExpired) y que la web
 * (handoffLinks.ts): vence al llegar `expiresAt` o cuando pasan `sessionWindowMinutes` desde que
 * el médico lo abrió por primera vez.
 */
export function handoffLinkState(
  session: Pick<HandoffSession, 'expiresAt' | 'sessionWindowMinutes' | 'firstOpenedAt' | 'revokedAt'>,
  now: Date = new Date(),
): HandoffLinkState {
  if (session.revokedAt) return 'Revocado';
  if (Date.parse(session.expiresAt) < now.getTime()) return 'Vencido';
  if (!session.firstOpenedAt) return 'Sin abrir';
  const windowEnds = Date.parse(session.firstOpenedAt) + session.sessionWindowMinutes * 60_000;
  return windowEnds < now.getTime() ? 'Vencido' : 'Abierto';
}

/** Solo quien creó el resumen o el cuidador principal puede ver, crear y revocar sus enlaces. */
export function canManageHandoffLinks(createdByUserId: number, userId: number | undefined, isPrincipal: boolean) {
  return isPrincipal || createdByUserId === userId;
}
