import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { ChoiceChips, FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { DateField, parseDateParts } from '../components/DateField';
import { FormField } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { createDelegation, getHealthCategories } from '../services/api';
import { ApiError } from '../services/http';
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
    const shareMessage = `${created.delegation.granteeName}, te compartieron información de salud en Yuyay hasta el ${formatDate(created.delegation.validUntil)}: ${created.shareLink}`;
    return (
      <ScrollView contentContainerStyle={formStyles.container}>
        <StatusMessage
          tone="info"
          message={`Listo. Le enviamos un correo a ${created.delegation.granteeEmail} con el enlace.`}
        />
        <FormCard title="Enlace de acceso">
          <Text selectable>{created.shareLink}</Text>
        </FormCard>
        <SubmitButton label="Compartir enlace" icon="share-variant" onPress={() => shareText(shareMessage)} />
        <SubmitButton label="Terminar" icon="check" onPress={() => navigation.goBack()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={formStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={formStyles.container} keyboardShouldPersistTaps="handled">
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
            hint="No necesita cuenta: le llega un enlace."
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
