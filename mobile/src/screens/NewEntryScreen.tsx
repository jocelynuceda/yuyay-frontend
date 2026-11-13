import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Chip, SegmentedButtons } from 'react-native-paper';
import { DateField, parseDateParts } from '../components/DateField';
import { EntryAttachmentField } from '../components/EntryAttachmentField';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../hooks/useToast';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { createHealthEntry, getHealthCategories, uploadAttachment } from '../services/api';
import { audioFormData, imageFormData } from '../services/attachmentFiles';
import { ApiError } from '../services/http';
import { fonts, makeStyles, useTheme } from '../theme';
import type { ConfidenceLevel, HomeStackParamList } from '../types';
import { EXAM_CATEGORY } from '../utils/categories';
import { initialEntryFields } from '../utils/ocrEntryDraft';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewEntry'>;

export function NewEntryScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, sourceAttachmentId, returnToSource } = route.params;
  const initial = initialEntryFields(route.params);
  const categories = useFetch(getHealthCategories);
  const [categoryCode, setCategoryCode] = useState(initial.categoryCode);
  const [title, setTitle] = useState(initial.title);
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [details, setDetails] = useState(initial.details);
  const [notes, setNotes] = useState('');
  const [confidenceLevel, setConfidence] = useState<ConfidenceLevel>(initial.confidenceLevel);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dateParts, setDateParts] = useState(initial.dateParts);
  const [submitted, setSubmitted] = useState(false);
  const [photo, setPhoto] = useState<ImagePickerAsset | null>(null);
  const voice = useVoiceRecorder();
  const toast = useToast();
  // Si el registro falla después de subir el archivo, reintentar no debe subirlo de nuevo
  const uploaded = useRef<{ uri: string; id: number } | null>(null);

  // El backend solo acepta dosis y frecuencia en medicación
  const isMedication = categoryCode === 'MEDICATION';
  const isExam = categoryCode === EXAM_CATEGORY;
  // La fecha es opcional en todas las categorías, como en la web; en un examen es obligatoria
  const date = parseDateParts(dateParts);
  const hasDate = Boolean(dateParts.day || dateParts.month || dateParts.year);
  const dateError = hasDate ? date.error : isExam ? 'Ingresa la fecha del examen.' : undefined;

  async function uploadPicked() {
    const uri = photo?.uri ?? voice.uri;
    if (!uri) return undefined;
    if (uploaded.current?.uri === uri) return uploaded.current.id;
    const form = photo ? imageFormData(photo) : await audioFormData(uri);
    const { id } = await uploadAttachment(subjectId, form);
    uploaded.current = { uri, id };
    return id;
  }

  async function handleSave() {
    setSubmitted(true);
    if (!categoryCode || !title.trim() || voice.isRecording || dateError) return;
    setSaving(true);
    setError(null);
    try {
      const attachmentId = sourceAttachmentId ?? (await uploadPicked());
      await createHealthEntry(subjectId, {
        categoryCode,
        title: title.trim(),
        details: details.trim(),
        dose: isMedication ? dose.trim() : '',
        frequency: isMedication ? frequency.trim() : '',
        occurredOn: hasDate && date.iso ? date.iso : undefined,
        confidenceLevel,
        notes: notes.trim(),
        sourceAttachmentId: attachmentId,
      });
      // Desde un documento se vuelve a la lista: el texto ya se usó
      toast('Registro guardado. Los demás cuidadores recibirán un aviso.');
      if (sourceAttachmentId && !returnToSource) navigation.pop(2);
      else navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar el registro.');
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
              style={{ backgroundColor: active ? colors.ink : colors.card }}
              textStyle={{ fontFamily: fonts.medium, color: active ? colors.onInk : colors.ink }}
            >
              {c.name}
            </Chip>
          );
        })}
      </View>
      {!categoryCode ? <Text style={styles.intro}>Elige la categoría del registro.</Text> : null}

      <FormField
        label={isExam ? 'Nombre del examen' : 'Título'}
        placeholder={isExam ? 'Ej. Hemograma completo' : isMedication ? 'Ej. Losartán 50 mg' : 'Ej. Alergia a la penicilina'}
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
      <DateField
        label={isExam ? 'Fecha del examen' : 'Fecha del registro (opcional)'}
        initial={dateParts}
        onChange={setDateParts}
        error={fieldErrors.occurredOn ?? (submitted ? dateError : undefined)}
      />
      <FormField
        label={isExam ? 'Resultado (opcional)' : 'Detalles (opcional)'}
        value={details}
        onChangeText={setDetails}
        multiline
        numberOfLines={3}
        maxLength={2000}
        error={fieldErrors.details}
      />
      <FormField
        label="Notas (opcional)"
        placeholder="Quién lo indicó, dónde se hizo…"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={2}
        maxLength={500}
        error={fieldErrors.notes}
      />

      {sourceAttachmentId ? null : (
        <EntryAttachmentField photo={photo} onPhotoChange={setPhoto} voice={voice} disabled={saving} />
      )}

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
        disabled={saving || voice.isRecording || !categoryCode || !title.trim()}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        style={styles.button}
      >
        Registrar
      </Button>
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  container: { padding: 20, gap: 6, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginBottom: 8 },
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14, marginTop: 10, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  button: { marginTop: 20 },
  buttonContent: { height: 50 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
}));
