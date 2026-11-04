import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, SegmentedButtons } from 'react-native-paper';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { createHealthEntry, getHealthCategories } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { ConfidenceLevel, HomeStackParamList } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewEntry'>;

export function NewEntryScreen({ route, navigation }: Props) {
  const { subjectId, categoryCode: initialCategory, details: initialDetails, sourceAttachmentId, returnToSource } = route.params;
  const categories = useFetch(getHealthCategories);
  const [categoryCode, setCategoryCode] = useState(initialCategory ?? 'MEDICATION');
  const [title, setTitle] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [details, setDetails] = useState(initialDetails ?? '');
  const [confidenceLevel, setConfidence] = useState<ConfidenceLevel>('CONFIRMED');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // El backend solo acepta dosis y frecuencia en medicación
  const isMedication = categoryCode === 'MEDICATION';

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createHealthEntry(subjectId, {
        categoryCode,
        title: title.trim(),
        details: details.trim(),
        dose: isMedication ? dose.trim() : '',
        frequency: isMedication ? frequency.trim() : '',
        confidenceLevel,
        sourceAttachmentId,
      });
      // Desde un documento se vuelve a la lista: el texto ya se usó
      if (sourceAttachmentId && !returnToSource) navigation.pop(2);
      else navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  }

  if (categories.loading && !categories.data) return <LoadingView />;

  return (
    <FormScroll contentContainerStyle={styles.container}>
      <Text style={styles.intro}>Los demás cuidadores recibirán un aviso.</Text>
      <StatusMessage message={error ?? categories.error} />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.chips}>
        {categories.data?.map((c) => {
          const active = c.code === categoryCode;
          return (
            <Chip
              key={c.code}
              showSelectedCheck={false}
              selected={active}
              onPress={() => setCategoryCode(c.code)}
              style={{ backgroundColor: active ? colors.ink : colors.white }}
              textStyle={{ fontFamily: fonts.medium, color: active ? colors.white : colors.ink }}
            >
              {c.name}
            </Chip>
          );
        })}
      </View>

      <FormField
        label="Título"
        placeholder={isMedication ? 'Ej. Losartán 50 mg' : 'Ej. Alergia a la penicilina'}
        value={title}
        onChangeText={setTitle}
        maxLength={150}
        error={fieldErrors.title}
      />
      {isMedication ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormField label="Dosis" placeholder="1 tableta" value={dose} onChangeText={setDose} maxLength={60} />
          </View>
          <View style={styles.flex}>
            <FormField label="Frecuencia" placeholder="Cada 12 h" value={frequency} onChangeText={setFrequency} maxLength={60} />
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
        Registrar
      </Button>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 6, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginBottom: 8 },
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  button: { marginTop: 20 },
  buttonContent: { height: 50 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
});
