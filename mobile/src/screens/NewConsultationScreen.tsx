import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { DateField, parseDateParts } from '../components/DateField';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { createConsultation } from '../services/api';
import { ApiError } from '../services/http';
import type { HomeStackParamList } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewConsultation'>;

export function NewConsultationScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Puede ser futura: una cita agendada
  const date = parseDateParts(dateParts, { allowFuture: true });
  const dateError = date.iso ? undefined : (date.error ?? 'Ingresa la fecha de la cita.');

  async function handleSave() {
    setSubmitted(true);
    if (!reason.trim() || !date.iso) return;
    setSaving(true);
    setError(null);
    try {
      await createConsultation(subjectId, { date: date.iso, reason: reason.trim(), notes: notes.trim() });
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
    <KeyboardAvoidingView style={formStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={formStyles.container} keyboardShouldPersistTaps="handled">
        <StatusMessage message={error} />

        <FormCard title="Cita">
          <DateField
            label="Fecha"
            onChange={setDateParts}
            error={(submitted || dateParts.year.length === 4 ? dateError : undefined) ?? fieldErrors.date}
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

        <SubmitButton label="Guardar cita" onPress={handleSave} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
