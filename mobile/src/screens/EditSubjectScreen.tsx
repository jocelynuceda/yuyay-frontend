import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { DateField, datePartsOf, parseDateParts } from '../components/DateField';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { updateCareSubject } from '../services/api';
import { ApiError } from '../services/http';
import type { HomeStackParamList } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditSubject'>;

export function EditSubjectScreen({ route, navigation }: Props) {
  const { subject } = route.params;
  const initialDate = subject.birthDate ? datePartsOf(subject.birthDate) : undefined;
  const [name, setName] = useState(subject.name);
  const [dateParts, setDateParts] = useState(initialDate ?? { day: '', month: '', year: '' });
  const [notes, setNotes] = useState(subject.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const date = parseDateParts(dateParts);

  async function handleSave() {
    setSubmitted(true);
    if (!name.trim() || date.error) return;
    setSaving(true);
    setError(null);
    try {
      await updateCareSubject(subject.id, {
        name: name.trim(),
        birthDate: date.iso || null,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar los cambios.');
      }
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error} />

      <FormCard title="Datos básicos">
        <FormField
          label="Nombre"
          icon="account-outline"
          value={name}
          onChangeText={setName}
          maxLength={120}
          error={(submitted && !name.trim() ? 'Ingresa su nombre.' : undefined) ?? fieldErrors.name}
        />
        <DateField
          label="Fecha de nacimiento (opcional)"
          initial={initialDate}
          onChange={setDateParts}
          error={(submitted ? date.error : undefined) ?? fieldErrors.birthDate}
        />
      </FormCard>

      <FormCard title="Notas (opcional)">
        <TextArea
          value={notes}
          onChangeText={setNotes}
          placeholder="Algo que todos los cuidadores deban saber: cómo prefiere que le hablen, a quién llamar…"
        />
      </FormCard>

      <SubmitButton label="Guardar cambios" onPress={handleSave} loading={saving} />
    </FormScroll>
  );
}
