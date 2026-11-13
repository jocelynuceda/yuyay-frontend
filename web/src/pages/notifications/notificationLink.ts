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
 * Los avisos de invitación solo enlazan a una relación pendiente. La ausencia de esa relación
 * no confirma que el usuario tenga acceso a la persona.
 * Un aviso CAREGIVER_JOINED (un cuidador invitado aceptó) lleva a la pestaña de cuidadores de la persona.
 */
export function getNotificationLink(
  notification: Pick<Notification, 'type' | 'careSubjectId'>,
  pending: PendingInvitations,
): NotificationLink | null {
  const { careSubjectId } = notification
  if (careSubjectId === null) return null
  const relationshipId = pending.bySubject.get(careSubjectId)
  if (relationshipId !== undefined) return { to: `/invitations/${relationshipId}`, label: 'Ver invitación' }
  if (notification.type === 'INVITATION') return null
  if (notification.type === 'CAREGIVER_JOINED') {
    return { to: `/people/${careSubjectId}?tab=caregivers`, label: 'Ver cuidadores' }
  }
  return { to: `/people/${careSubjectId}`, label: 'Ver persona' }
}
