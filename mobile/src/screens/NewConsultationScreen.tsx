import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { DateField, datePartsOf, parseDateParts } from '../components/DateField';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { LoadingView } from '../components/LoadingView';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { TimeField } from '../components/TimeField';
import { createConsultation, getConsultation, updateConsultation } from '../services/api';
import { syncReminder } from '../services/reminders';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../services/http';
import type { Consultation, HomeStackParamList } from '../types';
import { parseTime, TIME_ERROR, type TimeParts, timePartsOf, toApiTime } from '../utils/calendar';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewConsultation'>;

// Puede ser futura (una cita agendada), pero no de aquí a muchos años
const DATE_RULES = { allowFuture: true, maxYearsAhead: 2 };

export function NewConsultationScreen({ route, navigation }: Props) {
  const { subjectId, consultationId } = route.params;
  const consultation = useFetch(
    () => consultationId === undefined ? Promise.resolve(null) : getConsultation(subjectId, consultationId),
    [subjectId, consultationId],
  );
  useRefreshOnFocus(consultation.reload);
  if (consultationId !== undefined && !consultation.data) {
    return consultation.loading
      ? <LoadingView />
      : <StatusMessage message={consultation.error ?? 'No encontramos esta cita.'} />;
  }
  return <ConsultationForm subjectId={subjectId} consultation={consultation.data} navigation={navigation} />;
}

function ConsultationForm({ subjectId, consultation, navigation }: {
  subjectId: number;
  consultation: Consultation | null;
  navigation: Props['navigation'];
}) {
  const initialDate = consultation ? datePartsOf(consultation.date) : undefined;
  const [dateParts, setDateParts] = useState(initialDate ?? { day: '', month: '', year: '' });
  const [timeParts, setTimeParts] = useState<TimeParts>(
    consultation?.time ? timePartsOf(consultation.time) : { hour: '', minute: '', period: 'am' },
  );
  const [reason, setReason] = useState(consultation?.reason ?? '');
  const [notes, setNotes] = useState(consultation?.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const date = parseDateParts(dateParts, DATE_RULES);
  const dateError = date.iso ? undefined : (date.error ?? 'Ingresa la fecha de la cita.');

  // La hora es opcional: solo se valida si se empezó a escribir
  const hasTime = !!(timeParts.hour || timeParts.minute);
  const time = hasTime ? parseTime(timeParts) : null;
  const timeError = hasTime && !time ? TIME_ERROR : undefined;

  async function handleSave() {
    setSubmitted(true);
    if (!reason.trim() || !date.iso || timeError) return;
    setSaving(true);
    setError(null);
    try {
      const data = { date: date.iso, time: time ? toApiTime(time) : undefined, reason: reason.trim(), notes: notes.trim() };
      if (consultation) {
        const updated = await updateConsultation(subjectId, consultation.id, { ...data, clearTime: !time });
        // Si esta cita tenía aviso en el celular, se mueve a la nueva hora o se quita
        if (user) await syncReminder(user.id, updated).catch(() => undefined);
      } else await createConsultation(subjectId, data);
      toast(consultation ? 'Cita actualizada.' : 'Cita guardada.');
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar la cita.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error} />

      <FormCard title="Cita">
        <DateField
          label="Fecha"
          initial={initialDate}
          onChange={(p) => {
            setDateParts(p);
            setFieldErrors(({ date: _date, ...rest }) => rest);
          }}
          rules={DATE_RULES}
          error={(submitted ? dateError : undefined) ?? fieldErrors.date}
        />
        <TimeField
          label="Hora (opcional)"
          value={timeParts}
          onChange={setTimeParts}
          error={(submitted ? timeError : undefined) ?? fieldErrors.time}
        />
        <FormField
          label="Motivo"
          icon="stethoscope"
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          error={(submitted && !reason.trim() ? 'Ingresa el motivo.' : undefined) ?? fieldErrors.reason}
        />
      </FormCard>

      <FormCard title="Notas (opcional)">
        <TextArea
          value={notes}
          onChangeText={setNotes}
          placeholder="Especialidad, clínica, qué llevar, qué dijo el médico…"
        />
      </FormCard>

      <SubmitButton label={consultation ? 'Guardar cambios' : 'Guardar cita'} onPress={handleSave} loading={saving} />
    </FormScroll>
  );
}
