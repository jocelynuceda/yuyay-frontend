import { Ionicons } from '@expo/vector-icons';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import { CareAuthorizationFields } from '../components/CareAuthorizationFields';
import { DateField, datePartsOf, parseDateParts } from '../components/DateField';
import { useAuth } from '../hooks/useAuth';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { GenderChips } from '../components/FormKit';
import { LionAvatar, lionForAge, lionVariantFor } from '../components/LionAvatar';
import { Sparkle } from '../components/Sparkle';
import { StatusMessage } from '../components/StatusMessage';
import { createCareSubject, type CareSubjectCreationFields } from '../services/api';
import { useCareAuthorization } from '../hooks/useCareAuthorization';
import { useToast } from '../hooks/useToast';
import { API_URL, ApiError } from '../services/http';
import { readPendingPerson, writePendingPerson, type PersonDraft } from '../services/pendingPersonDraft';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { CareSubject, Gender, HomeStackParamList, User } from '../types';
import type { CareSubjectCreation } from '../types/careAuthorization';
import { creationOutcomeUncertain, prepareCareSubjectCreation, type CreationAttempt, type ProfileKind } from '../utils/careAuthorization';
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
  const { user } = useAuth();
  if (!user) return null;
  return <NewSubjectForm key={user.id} navigation={navigation} user={user} />;
}

function NewSubjectForm({ navigation, user }: { navigation: Props['navigation']; user: User }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const draftKey = `yuyay.pendingPerson.v1.${API_URL.replace(/[^a-zA-Z0-9.-]/g, '_')}.${user.id}`;
  const [savedDraft] = useState(() => readPendingPerson(draftKey));
  const draftRequestId = useRef(savedDraft?.requestId);
  const [name, setName] = useState(savedDraft?.name ?? '');
  const [dateParts, setDateParts] = useState(savedDraft?.dateParts ?? { day: '', month: '', year: '' });
  const [gender, setGender] = useState<Gender | null>(savedDraft?.gender ?? null);
  const [notes, setNotes] = useState(savedDraft?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const posting = useRef(false);
  const attempt = useRef<CreationAttempt<CareSubjectCreationFields> | null>(null);
  const [mustCheck, setMustCheck] = useState(false);
  const [created, setCreated] = useState<CareSubject | null>(null);
  const authorization = useCareAuthorization(true, Boolean(savedDraft));
  const [trackDraft, setTrackDraft] = useState(Boolean(savedDraft));
  const [draftError, setDraftError] = useState(false);
  const [dateRevision, setDateRevision] = useState(0);
  const savingDraft = trackDraft && authorization.profileKind === 'THIRD_PARTY';
  function persistDraft(values: PersonDraft) {
    try {
      draftRequestId.current ??= newRequestId();
      writePendingPerson(draftKey, { ...values, requestId: draftRequestId.current });
      setDraftError(false);
    } catch { setDraftError(true); }
  }
  function editDraft(changes: Partial<PersonDraft>) {
    if (savingDraft) persistDraft({ ...draft, ...changes });
  }

  function chooseThirdPartyType(next: Parameters<typeof authorization.chooseThirdPartyType>[0]) {
    if (next === 'PENDING') {
      persistDraft(draft);
      setTrackDraft(true);
    }
    authorization.chooseThirdPartyType(next);
  }

  function discardDraft() {
    try { writePendingPerson(draftKey, null); } catch { setDraftError(true); return; }
    setTrackDraft(false);
    setDraftError(false);
    delete drafts.current.THIRD_PARTY;
    draftRequestId.current = undefined;
    attempt.current = null;
    setName('');
    setDateParts({ day: '', month: '', year: '' });
    setDateRevision(value => value + 1);
    setGender(null);
    setNotes('');
    setSubmitted(false);
    setFieldErrors({});
    authorization.chooseThirdPartyType(null);
  }
  const self = authorization.profileKind === 'SELF';
  const draft = { name, dateParts, gender, notes };
  const drafts = useRef<Partial<Record<ProfileKind, typeof draft>>>({});
  function chooseProfileKind(next: Parameters<typeof authorization.chooseProfileKind>[0]) {
    const previous = authorization.profileKind;
    if (previous !== next && (previous || next === 'SELF')) {
      drafts.current[previous ?? 'THIRD_PARTY'] = draft;
      const nextDraft = drafts.current[next];
      setDateRevision(value => value + 1);
      setName(nextDraft?.name ?? (next === 'SELF' ? user?.name ?? '' : ''));
      setDateParts(nextDraft?.dateParts ?? (next === 'SELF' && user?.birthDate
        ? datePartsOf(user.birthDate) : { day: '', month: '', year: '' }));
      setGender(nextDraft ? nextDraft.gender : next === 'SELF' ? user?.gender ?? null : null);
      setNotes(nextDraft?.notes ?? '');
      setFieldErrors({});
      setSubmitted(false);
    }
    authorization.chooseProfileKind(next);
  }
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
    if (created && !saving) navigation.replace('SubjectDetail', { subjectId: created.id });
  }, [created, navigation, saving]);

  function handleSave() {
    if (mustCheck && attempt.current) {
      void submitCreation(attempt.current.request);
      return;
    }
    setSubmitted(true);
    if (!authorization.declaration || !name.trim() || date.error) return;
    const data = { name: name.trim(), birthDate: date.iso, gender, notes: notes.trim() };
    const requestId = savingDraft ? draftRequestId.current : undefined;
    void submitCreation(prepareCareSubjectCreation(attempt.current, authorization.declaration, data, () => requestId ?? newRequestId()));
  }

  async function submitCreation(request: CareSubjectCreation<CareSubjectCreationFields>) {
    if (posting.current) return;
    posting.current = true;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const subject = await createCareSubject(request);
      if (savingDraft) {
        setTrackDraft(false);
        try { writePendingPerson(draftKey, null); } catch { /* El alta ya se confirmó. */ }
      }
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
      <CareAuthorizationFields authorization={{ ...authorization, chooseProfileKind, chooseThirdPartyType }} disabled={saving || mustCheck} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos básicos</Text>
        <FormField
          label="Nombre"
          icon="account-outline"
          value={self ? `Yo · ${name}` : name}
          onChangeText={(value) => { setName(value); editDraft({ name: value }); }}
          editable={!self && !saving && !mustCheck}
          disabled={saving || mustCheck}
          maxLength={120}
          error={(submitted && !name.trim() ? 'Ingresa su nombre.' : undefined) ?? fieldErrors.name}
        />
        <DateField
          key={`${self}-${dateRevision}`}
          initial={dateParts}
          label="Fecha de nacimiento (opcional)"
          disabled={saving || mustCheck}
          rules={DATE_RULES}
          onChange={(p) => {
            setDateParts(p);
            editDraft({ dateParts: p });
            setFieldErrors(({ birthDate: _birthDate, ...rest }) => rest);
          }}
          error={(submitted ? date.error : undefined) ?? fieldErrors.birthDate}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Género (opcional)</Text>
        <GenderChips value={gender} onChange={(value) => { setGender(value); editDraft({ gender: value }); }} disabled={saving || mustCheck} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notas (opcional)</Text>
        <TextInput
          value={notes}
          editable={!saving && !mustCheck}
          onChangeText={(value) => { setNotes(value); editDraft({ notes: value }); }}
          placeholder="Algo que todos los cuidadores deban saber: cómo prefiere que le hablen, a quién llamar…"
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={500}
          style={styles.notes}
        />
        <Text style={styles.counter}>{notes.length}/500</Text>
      </View>
      {savingDraft && <View>
        <StatusMessage tone={draftError ? 'error' : 'info'} message={draftError ? 'No pudimos guardar el borrador en este dispositivo.' : 'Borrador guardado en este dispositivo. Puedes cerrar y retomarlo desde Agregar persona.'} />
        {!mustCheck && <Button disabled={saving} onPress={discardDraft}>Descartar borrador</Button>}
      </View>}

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
