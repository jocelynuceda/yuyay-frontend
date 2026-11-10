import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import { DateField, parseDateParts } from '../components/DateField';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { Sparkle } from '../components/Sparkle';
import { StatusMessage } from '../components/StatusMessage';
import { createCareSubject } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { ageFrom, initialsOf } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewSubject'>;

// La fecha de nacimiento debe ser anterior a hoy (el backend valida @Past)
const DATE_RULES = { strictPast: true };

export function NewSubjectScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const date = parseDateParts(dateParts, DATE_RULES);
  const age = date.iso ? ageFrom(date.iso) : null;

  async function handleSave() {
    setSubmitted(true);
    if (!name.trim() || date.error) return;
    setSaving(true);
    setError(null);
    try {
      const subject = await createCareSubject({ name: name.trim(), birthDate: date.iso, notes: notes.trim() });
      navigation.replace('SubjectDetail', { subjectId: subject.id, name: subject.name });
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar a la persona.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.container}>
      {/* Vista previa de la tarjeta que se va a crear */}
      <View style={styles.preview}>
        <View style={styles.previewTile}>
          {name.trim() ? (
            <Text style={styles.previewInitials}>{initialsOf(name)}</Text>
          ) : (
            <Sparkle size={34} color={colors.accent} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.previewName} numberOfLines={1}>
            {name.trim() || 'Nueva persona'}
          </Text>
          <Text style={styles.previewMeta}>{age !== null ? `${age} años` : 'Completa sus datos'}</Text>
        </View>
      </View>

      <StatusMessage message={error} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos básicos</Text>
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
          rules={DATE_RULES}
          onChange={(p) => {
            setDateParts(p);
            setFieldErrors(({ birthDate: _birthDate, ...rest }) => rest);
          }}
          error={(submitted ? date.error : undefined) ?? fieldErrors.birthDate}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Algo que todos los cuidadores deban saber: cómo prefiere que le hablen, a quién llamar…"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
          style={styles.notes}
        />
        <Text style={styles.counter}>{notes.length}/500</Text>
      </View>

      <View style={styles.info}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>Serás su cuidador principal y podrás invitar a otros cuidadores.</Text>
      </View>

      <Button
        mode="contained"
        icon="check"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        style={styles.button}
      >
        Agregar persona
      </Button>
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  container: { padding: 20, gap: 14 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.soft,
    borderRadius: radius.lg,
    padding: 16,
  },
  previewTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitials: { fontFamily: fonts.display, fontSize: 24, color: colors.primary },
  previewName: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  previewMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.softText, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  notes: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  counter: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, alignSelf: 'flex-end', marginTop: -6 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    padding: 14,
  },
  infoText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.primary, lineHeight: 18 },
  button: { borderRadius: radius.pill, marginTop: 4 },
  buttonContent: { height: 54 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
}));
