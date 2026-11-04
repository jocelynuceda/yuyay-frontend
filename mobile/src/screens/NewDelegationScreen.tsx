import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ChoiceChips, FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { DateField, parseDateParts } from '../components/DateField';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { createDelegation, getHealthCategories } from '../services/api';
import { API_URL, ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { DelegationCreated, HomeStackParamList } from '../types';
import { categoryMeta } from '../utils/categories';
import { shareText } from '../utils/confirm';
import { formatDate, isEmail, todayIso } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewDelegation'>;

export function NewDelegationScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const categories = useFetch(getHealthCategories);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<DelegationCreated | null>(null);

  const date = parseDateParts(dateParts, { allowFuture: true });
  const today = todayIso();
  const dateError = !dateParts.day && !dateParts.month && !dateParts.year ? 'Elige hasta cuándo.' : date.error;
  const errors = {
    name: !name.trim() ? 'Ingresa su nombre.' : undefined,
    email: !isEmail(email) ? 'Ingresa un correo válido.' : undefined,
    codes: codes.length === 0 ? 'Elige al menos una categoría.' : undefined,
    date: dateError ?? (date.iso < today ? 'Debe ser hoy o una fecha futura.' : undefined),
  };

  function toggleCode(code: string) {
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function handleSave() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createDelegation(subjectId, {
        granteeName: name.trim(),
        granteeEmail: email.trim(),
        categoryCodes: codes,
        // Vale hasta el final del día elegido, en hora local
        validUntil: new Date(`${date.iso}T23:59:59`).toISOString(),
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
    const link = __DEV__ ? `${API_URL}/acceso/${created.token}` : created.shareLink;
    const shareMessage = `${created.delegation.granteeName}, te compartieron información de salud en Yuyay hasta el ${formatDate(created.delegation.validUntil)}. Ábrela aquí, sin crear cuenta: ${link}\n\nSi usas la app: en el inicio de sesión toca "Tengo un código" y pega este código: ${created.token}`;
    return (
      <ScrollView contentContainerStyle={formStyles.container}>
        <StatusMessage tone="info" message={`Listo. Ahora compártele el enlace a ${created.delegation.granteeName}.`} />
        <FormCard title="Enlace de acceso">
          <Text style={styles.help}>Lo abre en su navegador, sin crear una cuenta.</Text>
          <Text selectable style={styles.value}>
            {link}
          </Text>
        </FormCard>
        <FormCard title="Si usa la app">
          <Text style={styles.help}>En el inicio de sesión toca “Tengo un código” y pega este código:</Text>
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
          icon="account-outline"
          value={name}
          onChangeText={setName}
          maxLength={120}
          error={(submitted ? errors.name : undefined) ?? fieldErrors.granteeName}
        />
        <FormField
          label="Correo"
          icon="email-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={(submitted ? errors.email : undefined) ?? fieldErrors.granteeEmail}
          hint="No necesita cuenta: le compartes un enlace."
        />
      </FormCard>

      <FormCard title="¿Qué podrá ver?">
        <ChoiceChips
          options={(categories.data ?? []).map((c) => ({ value: c.code, label: categoryMeta[c.code]?.plural ?? c.name }))}
          selected={codes}
          onToggle={toggleCode}
        />
        {submitted && errors.codes ? <Text style={formStyles.error}>{errors.codes}</Text> : null}
      </FormCard>

      <FormCard title="¿Hasta cuándo?">
        <DateField
          label="Último día de acceso"
          onChange={setDateParts}
          error={(submitted ? errors.date : undefined) ?? fieldErrors.validUntil}
        />
      </FormCard>

      <SubmitButton label="Crear acceso" icon="key" onPress={handleSave} loading={saving} />
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  value: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
});
