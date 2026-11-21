import { useEffect, useState } from 'react';
import {
  disableReminder,
  enableReminder,
  localRemindersAvailable,
  syncSubjectReminders,
} from '../services/localReminders';
import type { Consultation } from '../types';
import { useAuth } from './useAuth';
import { useToast } from './useToast';

/**
 * Avisos locales de las citas de una persona: los sincroniza cada vez que llegan las citas y expone
 * cuáles están activos y cómo cambiarlos.
 */
export function useLocalReminders(
  subjectId: number,
  consultations: readonly Consultation[] | null,
  subject: { subjectName: string; isPrincipal: boolean },
) {
  const { user } = useAuth();
  const toast = useToast();
  const [active, setActive] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [denied, setDenied] = useState<number | null>(null);
  const userId = user?.id ?? null;
  const { subjectName, isPrincipal } = subject;

  useEffect(() => {
    if (!localRemindersAvailable || userId === null || !consultations) return;
    let current = true;
    syncSubjectReminders(userId, subjectId, consultations, { subjectName, isPrincipal })
      .then((ids) => current && setActive(ids))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [userId, subjectId, consultations, subjectName, isPrincipal]);

  async function toggle(consultation: Consultation, value: boolean) {
    if (userId === null) return;
    setBusy(consultation.id);
    setDenied(null);
    try {
      if (!value) {
        await disableReminder(userId, consultation.id);
        setActive((ids) => new Set([...ids].filter((id) => id !== consultation.id)));
        return;
      }
      const result = await enableReminder(userId, consultation, { subjectName, isPrincipal });
      if (result === 'scheduled') {
        setActive((ids) => new Set(ids).add(consultation.id));
        toast('Te avisaremos 1 hora antes en este celular.');
      } else if (result === 'denied') {
        setDenied(consultation.id);
      } else {
        toast('Esta cita ya no admite un aviso.');
      }
    } catch {
      toast('No pudimos programar el aviso.');
    } finally {
      setBusy(null);
    }
  }

  return { available: localRemindersAvailable && userId !== null, active, busy, denied, toggle };
}
