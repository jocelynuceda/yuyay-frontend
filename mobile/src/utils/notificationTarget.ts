import type { CareRole, NotificationType } from '../types';

type SubjectRef = { id: number; name: string; myRole: CareRole };

export type NotificationTarget =
  | { screen: 'Home' }
  | { screen: 'SubjectDetail'; params: { subjectId: number; name: string } }
  | { screen: 'Caregivers'; params: { subjectId: number; isPrincipal: boolean } };

/**
 * A dónde lleva un aviso al tocarlo; las mismas reglas que la web (notificationLink.ts).
 * Una invitación pendiente lleva al inicio, donde se acepta; una que ya no está pendiente no lleva
 * a ningún lado, porque no confirma que haya acceso a la persona.
 */
export function notificationTarget(
  notification: { type: NotificationType | string; careSubjectId: number | null },
  pendingSubjectIds: ReadonlySet<number>,
  subjects: readonly SubjectRef[],
): NotificationTarget | null {
  const { careSubjectId } = notification;
  if (careSubjectId === null) return null;
  if (pendingSubjectIds.has(careSubjectId)) return { screen: 'Home' };
  if (notification.type === 'INVITATION') return null;
  const subject = subjects.find((s) => s.id === careSubjectId);
  if (!subject) return null;
  if (notification.type === 'CAREGIVER_JOINED') {
    return { screen: 'Caregivers', params: { subjectId: subject.id, isPrincipal: subject.myRole === 'PRINCIPAL' } };
  }
  return { screen: 'SubjectDetail', params: { subjectId: subject.id, name: subject.name } };
}
