import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import { CareAuthorizationFields } from '../components/CareAuthorizationFields';
import { DateField, parseDateParts } from '../components/DateField';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { GenderChips } from '../components/FormKit';
import { LionAvatar, lionForAge, lionVariantFor } from '../components/LionAvatar';
import { Sparkle } from '../components/Sparkle';
import { StatusMessage } from '../components/StatusMessage';
import { createCareSubject, type CareSubjectCreationFields } from '../services/api';
import { useCareAuthorization } from '../hooks/useCareAuthorization';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { CareSubject, Gender, HomeStackParamList } from '../types';
import type { CareSubjectCreation } from '../types/careAuthorization';
import { creationOutcomeUncertain, prepareCareSubjectCreation, type CreationAttempt } from '../utils/careAuthorization';
import { ageFrom } from '../utils/format';
import { confirmAction } from '../utils/confirm';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewSubject'>;

// La fecha de nacimiento debe ser anterior a hoy (el backend valida @Past)
const DATE_RULES = { strictPast: true };

// Identificador opaco de la petición, sin dependencia nativa.
function newRequestId() {
  return [Date.now(), Math.random(), Math.random()].map((part) => part.toString(36).replace('.', '')).join('-');
}

export function NewSubjectScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  const [gender, setGender] = useState<Gender | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const posting = useRef(false);
  const attempt = useRef<CreationAttempt<CareSubjectCreationFields> | null>(null);
  const [mustCheck, setMustCheck] = useState(false);
  const [created, setCreated] = useState<CareSubject | null>(null);
  const authorization = useCareAuthorization();
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);

  const date = parseDateParts(dateParts, DATE_RULES);
  const age = date.iso ? ageFrom(date.iso) : null;

  usePreventRemove(saving || mustCheck, ({ data }) => {
    if (posting.current) return;
    void confirmAction(
      '¿Salir del formulario?',
      'La persona puede haberse guardado. Revisa la lista de personas antes de intentar agregarla de nuevo.',
      'Salir',
    ).then((leave) => {
      if (leave && !posting.current) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    if (created && !saving) navigation.replace('SubjectDetail', { subjectId: created.id, name: created.name });
  }, [created, navigation, saving]);

  function handleSave() {
    if (mustCheck && attempt.current) {
      void submitCreation(attempt.current.request);
      return;
    }
    setSubmitted(true);
    if (!authorization.declaration || !name.trim() || date.error) return;
    const data = { name: name.trim(), birthDate: date.iso, gender, notes: notes.trim() };
    void submitCreation(prepareCareSubjectCreation(attempt.current, authorization.declaration, data, newRequestId));
  }

  async function submitCreation(request: CareSubjectCreation<CareSubjectCreationFields>) {
    if (posting.current) return;
    posting.current = true;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const subject = await createCareSubject(request);
      attempt.current = null;
      setMustCheck(false);
      toast(`Se agregó a ${subject.name}.`);
      setCreated(subject);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined;
      const uncertain = creationOutcomeUncertain(status, attempt.current?.uncertain);
      attempt.current = { request, uncertain };
      setMustCheck(uncertain);
      if (status === 409) authorization.review();
      if (uncertain) {
        setError('No pudimos confirmar si la persona se guardó. Comprueba el guardado para continuar.');
      } else if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos guardar a la persona.');
      }
    } finally {
      posting.current = false;
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.container}>
      {/* Vista previa de la tarjeta que se va a crear */}
      <View style={styles.preview}>
        <View style={styles.previewTile}>
          {name.trim() ? (
            <LionAvatar kind={lionForAge(age)} variant={lionVariantFor(gender)} size={60} animated />
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
      <CareAuthorizationFields authorization={authorization} disabled={saving || mustCheck} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos básicos</Text>
        <FormField
          label="Nombre"
          icon="account-outline"
          value={name}
          onChangeText={setName}
          disabled={saving || mustCheck}
          maxLength={120}
          error={(submitted && !name.trim() ? 'Ingresa su nombre.' : undefined) ?? fieldErrors.name}
        />
        <DateField
          label="Fecha de nacimiento (opcional)"
          disabled={saving || mustCheck}
          rules={DATE_RULES}
          onChange={(p) => {
            setDateParts(p);
            setFieldErrors(({ birthDate: _birthDate, ...rest }) => rest);
          }}
          error={(submitted ? date.error : undefined) ?? fieldErrors.birthDate}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Género (opcional)</Text>
        <GenderChips value={gender} onChange={setGender} disabled={saving || mustCheck} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          editable={!saving && !mustCheck}
          onChangeText={setNotes}
          placeholder="Algo que todos los cuidadores deban saber: cómo prefiere que le hablen, a quién llamar…"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
          style={styles.notes}
        />
        <Text style={styles.counter}>{notes.length}/500</Text>
      </View>

      {authorization.declaration && <View style={styles.info}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>Serás su cuidador principal y podrás invitar a otros cuidadores.</Text>
      </View>}

      <Button
        mode="contained"
        icon="check"
        onPress={handleSave}
        loading={saving}
        disabled={saving || (!mustCheck && !authorization.declaration)}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        style={styles.button}
      >
        {mustCheck ? 'Comprobar guardado' : 'Agregar persona'}
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
