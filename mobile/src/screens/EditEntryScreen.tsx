import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { deleteHealthEntry, getHealthEntry, updateHealthEntry } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { ConfidenceLevel, HealthEntry, HomeStackParamList } from '../types';
import { confirmAction } from '../utils/confirm';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditEntry'>;

export function EditEntryScreen({ route, navigation }: Props) {
  const { subjectId, entryId } = route.params;
  const entry = useFetch(() => getHealthEntry(subjectId, entryId), [subjectId, entryId]);

  if (entry.loading && !entry.data) return <LoadingView />;
  if (!entry.data) return <StatusMessage message={entry.error ?? 'No encontramos este registro.'} />;

  return <EntryForm entry={entry.data} subjectId={subjectId} onDone={() => navigation.goBack()} />;
}

/** El formulario arranca con la última versión del registro. */
function EntryForm({ entry, subjectId, onDone }: { entry: HealthEntry; subjectId: number; onDone: () => void }) {
  const v = entry.latestVersion;
  const [title, setTitle] = useState(v.title);
  const [dose, setDose] = useState(v.dose ?? '');
  const [frequency, setFrequency] = useState(v.frequency ?? '');
  const [details, setDetails] = useState(v.details ?? '');
  const [notes, setNotes] = useState(v.notes ?? '');
  const [confidenceLevel, setConfidence] = useState<ConfidenceLevel>(v.confidenceLevel);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // El backend solo acepta dosis y frecuencia en medicación
  const isMedication = entry.categoryCode === 'MEDICATION';

  async function handleSave() {
    setSubmitted(true);
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateHealthEntry(subjectId, entry.id, {
        title: title.trim(),
        details: details.trim(),
        dose: isMedication ? dose.trim() : '',
        frequency: isMedication ? frequency.trim() : '',
        occurredOn: v.occurredOn,
        notes: notes.trim(),
        confidenceLevel,
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar los cambios.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = await confirmAction('Borrar registro', `"${v.title}" dejará de aparecer en el perfil.`, 'Borrar');
    if (!ok) return;
    setError(null);
    try {
      await deleteHealthEntry(subjectId, entry.id);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos borrar el registro.');
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <Text style={styles.intro}>Se guarda como una versión nueva y los demás cuidadores reciben un aviso.</Text>
      <StatusMessage message={error} />

      <FormCard title={entry.categoryName}>
        <FormField
          label="Título"
          value={title}
          onChangeText={setTitle}
          maxLength={150}
          error={(submitted && !title.trim() ? 'Ingresa un título.' : undefined) ?? fieldErrors.title}
        />
        {isMedication ? (
          <View style={styles.row}>
            <View style={formStyles.flex}>
              <FormField label="Dosis" value={dose} onChangeText={setDose} maxLength={60} error={fieldErrors.dose} />
            </View>
            <View style={formStyles.flex}>
              <FormField
                label="Frecuencia"
                value={frequency}
                onChangeText={setFrequency}
                maxLength={60}
                error={fieldErrors.frequency}
              />
            </View>
          </View>
        ) : null}
      </FormCard>

      <FormCard title="Detalles (opcional)">
        <TextArea value={details} onChangeText={setDetails} placeholder="Lo que conviene saber" maxLength={2000} />
      </FormCard>

      <FormCard title="Notas (opcional)">
        <TextArea value={notes} onChangeText={setNotes} placeholder="Por qué cambió, quién lo indicó…" />
      </FormCard>

      <FormCard title="¿Qué tan seguro estás?">
        <SegmentedButtons
          value={confidenceLevel}
          onValueChange={(value) => setConfidence(value as ConfidenceLevel)}
          buttons={[
            { value: 'CONFIRMED', label: 'Confirmado', icon: 'check' },
            { value: 'UNCERTAIN', label: 'Por confirmar', icon: 'help' },
          ]}
        />
      </FormCard>

      <SubmitButton label="Guardar cambios" onPress={handleSave} loading={saving} />

      <Pressable onPress={handleDelete} style={styles.delete} accessibilityRole="button">
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={styles.deleteText}>Borrar registro</Text>
      </Pressable>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  row: { flexDirection: 'row', gap: 10 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
});
