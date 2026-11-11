import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { DateField, datePartsOf, parseDateParts } from '../components/DateField';
import { DeleteButton, FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { useToast } from '../hooks/useToast';
import { deleteCareSubject, updateCareSubject } from '../services/api';
import { ApiError } from '../services/http';
import type { HomeStackParamList } from '../types';
import { confirmAction } from '../utils/confirm';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditSubject'>;

// La fecha de nacimiento debe ser anterior a hoy (el backend valida @Past)
const DATE_RULES = { strictPast: true };

export function EditSubjectScreen({ route, navigation }: Props) {
  const { subject } = route.params;
  const initialDate = subject.birthDate ? datePartsOf(subject.birthDate) : undefined;
  const [name, setName] = useState(subject.name);
  const [dateParts, setDateParts] = useState(initialDate ?? { day: '', month: '', year: '' });
  const [notes, setNotes] = useState(subject.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const date = parseDateParts(dateParts, DATE_RULES);

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
      toast('Datos actualizados.');
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

  async function handleDelete() {
    const ok = await confirmAction(
      `Eliminar a ${subject.name}`,
      'Solo se puede eliminar a una persona que aún no tiene registros de salud. No se puede deshacer.',
      'Eliminar',
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCareSubject(subject.id);
      toast(`Se eliminó a ${subject.name}.`);
      navigation.popToTop();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos eliminar a la persona.');
      setDeleting(false);
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
          rules={DATE_RULES}
          onChange={(p) => {
            setDateParts(p);
            setFieldErrors(({ birthDate: _birthDate, ...rest }) => rest);
          }}
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
      {subject.myRole === 'PRINCIPAL' ? (
        <DeleteButton label="Eliminar persona" onPress={handleDelete} busy={deleting} />
      ) : null}
    </FormScroll>
  );
}
