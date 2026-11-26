import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { DurationField } from '../components/DurationField';
import { ChoiceChips, FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { createDelegation, getHealthEntriesPage, getConsultations } from '../services/api';
import { API_URL, ApiError } from '../services/http';
import { fonts, makeStyles } from '../theme';
import type { DelegationCreated, HomeStackParamList } from '../types';
import { defaultDelegationDuration, delegationExpiry } from '../utils/accessDurations';
import { categoryMeta } from '../utils/categories';
import { shareText } from '../utils/confirm';
import { formatDateTime, isEmail } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewDelegation'>;

/** Las citas se eligen junto a las categorías, pero no son una categoría de salud. */
const CONSULTATIONS = 'CONSULTATIONS';

export function NewDelegationScreen(props: Props) {
  return <DelegationEditor key={props.route.params.subjectId} {...props} />;
}

function DelegationEditor({ route, navigation }: Props) {
  const styles = useStyles();
  const { subjectId } = route.params;
  const categories = useFetch(async () => {
    const knownCodes = Object.keys(categoryMeta);
    const [pages, consultations] = await Promise.all([
      Promise.all(knownCodes.map(code => getHealthEntriesPage(subjectId, 0, code, 1))),
      getConsultations(subjectId),
    ]);
    const options = knownCodes.filter((_, i) => (Array.isArray(pages[i]) ? pages[i] : pages[i].content).length > 0)
      .map(code => ({ value: code, label: categoryMeta[code].plural }));
    if (consultations.length) options.push({ value: CONSULTATIONS, label: 'Citas' });
    return options;
  }, [subjectId]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [duration, setDuration] = useState(defaultDelegationDuration);
  const [submitted, setSubmitted] = useState(false);
  const [durationEdited, setDurationEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<DelegationCreated | null>(null);

  const preview = delegationExpiry(duration);
  const errors = {
    name: !name.trim() ? 'Introduce tu nombre' : undefined,
    email: !isEmail(email) ? 'Ingresa un correo válido.' : undefined,
    codes: codes.length === 0 ? 'Elige al menos una opción.' : undefined,
  };

  const available = !!categories.data?.length && !categories.loading && !categories.error;

  function toggleCode(code: string) {
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSave() {
    setSubmitted(true);
    const { validUntil } = delegationExpiry(duration);
    if (saving || !available || Object.values(errors).some(Boolean) || !validUntil) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createDelegation(subjectId, {
        granteeName: name.trim(),
        granteeEmail: email.trim(),
        categoryCodes: codes.filter((code) => code !== CONSULTATIONS),
        includeConsultations: codes.includes(CONSULTATIONS),
        validUntil,
      });
      setCreated(res);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos crear el acceso.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    // En desarrollo el backend no conoce la IP de la computadora: el enlace pasa por Metro, igual que la API
    const link = __DEV__ ? `${API_URL}/access/${created.token}` : created.shareLink;
    const expires = formatDateTime(created.delegation.validUntil);
    const shareMessage = `${created.delegation.granteeName}, te compartieron información de salud en Yuyay hasta el ${expires}. Ábrela aquí, sin crear cuenta: ${link}\n\nSi usas la app: en el inicio de sesión toca "Tengo un código" (si ya tienes sesión: Perfil, "Tengo un código de acceso") y pega este código: ${created.token}`;
    return (
      <ScrollView contentContainerStyle={formStyles.container}>
        <StatusMessage tone="info" message={`Listo. Ahora compártele el enlace a ${created.delegation.granteeName}.`} />
        <FormCard title="Enlace de acceso">
          <Text style={styles.help}>Lo abre en su navegador, sin crear una cuenta.</Text>
          <Text style={styles.help}>Vence el {expires}.</Text>
          <Text selectable style={styles.value}>
            {link}
          </Text>
        </FormCard>
        <FormCard title="Si usa la app">
          <Text style={styles.help}>En el inicio de sesión toca “Tengo un código” (con sesión iniciada: Perfil, “Tengo un código de acceso”) y pega este código:</Text>
          <Text selectable style={styles.value}>
            {created.token}
          </Text>
        </FormCard>
        <Text style={styles.help}>
          El enlace y el código son el mismo acceso y solo se pueden abrir una vez. Esta es la única vez que los verás:
          si se pierden, revoca este acceso y crea otro.
        </Text>
        <SubmitButton label="Compartir enlace" icon="share-variant" onPress={() => shareText(shareMessage)} />
        <SubmitButton label="Terminar" icon="check" onPress={() => navigation.goBack()} />
      </ScrollView>
    );
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error} />

      <FormCard title="¿A quién le das acceso?">
        <FormField
          label="Nombre"
          placeholder="Dr. Pedro Ramos"
          icon="account-outline"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFieldErrors(({ granteeName: _granteeName, ...rest }) => rest);
          }}
          maxLength={120}
          error={(submitted ? errors.name : undefined) ?? fieldErrors.granteeName}
        />
        <FormField
          label="Correo"
          icon="email-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          maxLength={150}
          autoCapitalize="none"
          autoCorrect={false}
          error={(submitted ? errors.email : undefined) ?? fieldErrors.granteeEmail}
          hint="No necesita cuenta: le compartes un enlace."
        />
      </FormCard>

      <FormCard title="¿Hasta cuándo?">
        <DurationField
          label="El acceso vence en"
          value={duration}
          onChange={(value) => {
            setDuration(value);
            setDurationEdited(true);
            setFieldErrors(({ validUntil: _validUntil, ...rest }) => rest);
          }}
          hint={preview.validUntil ? `Vence aproximadamente el ${formatDateTime(preview.validUntil)}. Máximo: 365 días.` : 'El tiempo comienza al crear el acceso. Máximo: 365 días.'}
          error={(submitted || durationEdited ? preview.error : undefined) ?? fieldErrors.validUntil}
          disabled={saving}
        />
      </FormCard>

      <FormCard title="¿Qué podrá ver?">
        {categories.error ? <>
          <StatusMessage message={categories.error} />
          <SubmitButton label="Reintentar" onPress={categories.reload} />
        </> : categories.loading ? <Text style={styles.help}>Cargando opciones…</Text> :
          !available ? <Text style={styles.help}>Aún no hay registros ni citas para compartir.</Text> : null}
        <ChoiceChips
          options={categories.data ?? []}
          selected={codes}
          onToggle={toggleCode}
        />
        {codes.includes(CONSULTATIONS) ? (
          <Text style={styles.help}>Verá la fecha, la hora y el motivo de las citas, pero no sus notas.</Text>
        ) : null}
        {submitted && errors.codes ? <Text style={formStyles.error}>{errors.codes}</Text> : null}
      </FormCard>

      <SubmitButton label="Crear acceso" icon="key" onPress={handleSave} loading={saving} disabled={!available} />
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  value: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
}));
