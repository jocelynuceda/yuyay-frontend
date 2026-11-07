import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, SegmentedButtons } from 'react-native-paper';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { getHealthEntry, updateHealthEntry } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { ConfidenceLevel, HealthEntry, HomeStackParamList } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditEntry'>;

export function EditEntryScreen({ route, navigation }: Props) {
  const { subjectId, entryId } = route.params;
  const entry = useFetch(() => getHealthEntry(subjectId, entryId), [subjectId, entryId]);

  if (entry.loading && !entry.data) return <LoadingView />;
  if (!entry.data) return <StatusMessage message={entry.error ?? 'No encontramos este registro.'} />;
  if (entry.data.deletedAt) return <StatusMessage message="Este registro fue eliminado y ya no se puede editar." />;

  return <EditEntryForm entry={entry.data} subjectId={subjectId} onSaved={() => navigation.goBack()} />;
}

/** Mismos campos que "Nuevo registro"; la categoría no se puede cambiar. */
function EditEntryForm({ entry, subjectId, onSaved }: { entry: HealthEntry; subjectId: number; onSaved: () => void }) {
  const v = entry.latestVersion;
  const [title, setTitle] = useState(v.title);
  const [dose, setDose] = useState(v.dose ?? '');
  const [frequency, setFrequency] = useState(v.frequency ?? '');
  const [details, setDetails] = useState(v.details ?? '');
  const [confidenceLevel, setConfidence] = useState<ConfidenceLevel>(v.confidenceLevel);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // El backend solo acepta dosis y frecuencia en medicación
  const isMedication = entry.categoryCode === 'MEDICATION';
  const unchanged =
    title.trim() === v.title &&
    details.trim() === (v.details ?? '') &&
    (!isMedication || (dose.trim() === (v.dose ?? '') && frequency.trim() === (v.frequency ?? ''))) &&
    confidenceLevel === v.confidenceLevel;

  async function handleSave() {
    if (!title.trim()) return;
    // Cada PATCH crea una versión nueva: si nada cambió, no se envía
    if (unchanged) return onSaved();
    setSaving(true);
    setError(null);
    try {
      await updateHealthEntry(subjectId, entry.id, {
        title: title.trim(),
        details: details.trim(),
        dose: isMedication ? dose.trim() : '',
        frequency: isMedication ? frequency.trim() : '',
        confidenceLevel,
        // El PATCH reemplaza la versión completa: se conservan los campos que esta pantalla no muestra
        occurredOn: v.occurredOn ?? '',
        notes: v.notes ?? '',
      });
      onSaved();
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

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Se guardará como una versión nueva y los demás cuidadores recibirán un aviso.</Text>
        <StatusMessage message={error} />

        <Text style={styles.label}>Categoría</Text>
        <Badge label={entry.categoryName} tone="soft" />

        <FormField
          label="Título"
          value={title}
          onChangeText={setTitle}
          maxLength={150}
          error={(!title.trim() ? 'Ingresa un título.' : undefined) ?? fieldErrors.title}
          style={styles.spaced}
        />
        {isMedication ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <FormField label="Dosis" placeholder="1 tableta" value={dose} onChangeText={setDose} maxLength={60} error={fieldErrors.dose} />
            </View>
            <View style={styles.flex}>
              <FormField
                label="Frecuencia"
                placeholder="Cada 12 h"
                value={frequency}
                onChangeText={setFrequency}
                maxLength={60}
                error={fieldErrors.frequency}
              />
            </View>
          </View>
        ) : null}
        <FormField label="Detalles (opcional)" value={details} onChangeText={setDetails} multiline numberOfLines={3} />

        <Text style={styles.label}>¿Qué tan seguro estás?</Text>
        <SegmentedButtons
          value={confidenceLevel}
          onValueChange={(value) => setConfidence(value as ConfidenceLevel)}
          buttons={[
            { value: 'CONFIRMED', label: 'Confirmado', icon: 'check' },
            { value: 'UNCERTAIN', label: 'Por confirmar', icon: 'help' },
          ]}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !title.trim()}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          style={styles.button}
        >
          Guardar cambios
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 6, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginBottom: 8 },
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, marginTop: 10, marginBottom: 6 },
  spaced: { marginTop: 12 },
  row: { flexDirection: 'row', gap: 10 },
  button: { marginTop: 20 },
  buttonContent: { height: 50 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
});
