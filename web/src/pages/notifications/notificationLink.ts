import type { Notification } from '../../types'

export interface PendingInvitations {
  status: 'loading' | 'error' | 'ready'
  /** careSubjectId -> id de la relación pendiente */
  bySubject: Map<number, number>
}

export interface NotificationLink {
  to: string
  label: string
}

/**
 * Decide el enlace de un aviso. Una invitación pendiente no da acceso a /personas/{id} (403),
 * así que se enlaza a la invitación; si aún no se sabe si está pendiente, no se enlaza a la persona.
 */
export function getNotificationLink(
  notification: Pick<Notification, 'type' | 'careSubjectId'>,
  pending: PendingInvitations,
): NotificationLink | null {
  const { careSubjectId } = notification
  if (careSubjectId === null) return null
  const relationshipId = pending.bySubject.get(careSubjectId)
  if (relationshipId !== undefined) return { to: `/invitaciones/${relationshipId}`, label: 'Ver invitación' }
  if (notification.type === 'INVITATION' && pending.status !== 'ready') return null
  return { to: `/personas/${careSubjectId}`, label: 'Ver persona' }
}
