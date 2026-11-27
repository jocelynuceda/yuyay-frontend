import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';
import { lookupDni } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius } from '../theme';
import type { RegistrationIdentity } from '../types';
import { suggestUserName } from '../utils/personName';
import { FormField } from './FormField';

type Lookup =
  | { status: 'idle' | 'loading' }
  | { status: 'found'; fullName: string }
  | { status: 'error'; message: string };

/**
 * DNI y nombre de usuario del alta. El nombre sale del DNI: la persona confirma que es ella y
 * después puede cambiar cómo quiere que la vean.
 */
export function RegistrationIdentityFields({ identity, onChange, fieldErrors, submitted, busy }: {
  identity: RegistrationIdentity;
  onChange: (next: RegistrationIdentity) => void;
  fieldErrors: Record<string, string>;
  submitted: boolean;
  busy: boolean;
}) {
  const styles = useStyles();
  const { dni, fullName, name } = identity;
  const dniOk = /^\d{8}$/.test(dni);
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' });
  // Solo vale la respuesta de la última consulta: cambiar el DNI descarta las anteriores.
  const attempt = useRef(0);

  function forget(next: RegistrationIdentity) {
    attempt.current += 1;
    setLookup({ status: 'idle' });
    onChange(next);
  }

  async function search() {
    const current = ++attempt.current;
    setLookup({ status: 'loading' });
    try {
      const found = await lookupDni(dni);
      if (current === attempt.current) setLookup({ status: 'found', fullName: found.fullName });
    } catch (e) {
      if (current !== attempt.current) return;
      const api = e instanceof ApiError ? e : null;
      setLookup({ status: 'error', message: api?.fieldErrors.dni ?? api?.message ?? 'No pudimos consultar el DNI.' });
    }
  }

  function confirm(found: string) {
    onChange({ ...identity, fullName: found, name: name.trim() ? name : suggestUserName(found) });
  }

  const nameError = fieldErrors.fullName ?? (submitted && !fullName ? 'Confirma tu nombre antes de continuar.' : undefined);

  return (
    <>
      <FormField
        label="DNI"
        icon="card-account-details-outline"
        value={dni}
        onChangeText={(value) => forget({ ...identity, dni: value.replace(/\D/g, ''), fullName: '' })}
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="off"
        textContentType="none"
        hint="Enviamos tu DNI a un proveedor externo para mostrarte el nombre que figura en él."
        error={
          (submitted && !dniOk ? 'Ingresa los 8 dígitos de tu DNI.' : undefined)
          ?? fieldErrors.dni
        }
        editable={!busy}
      />
      {fullName ? (
        <FormField
          label="Tu nombre según el DNI"
          icon="card-text-outline"
          value={fullName}
          error={fieldErrors.fullName}
          editable={false}
          multiline
        />
      ) : lookup.status === 'found' ? (
        <View style={styles.confirm}>
          <Text style={styles.question} accessibilityLiveRegion="polite">¿Eres {lookup.fullName}?</Text>
          <View style={styles.actions}>
            <Button mode="text" onPress={() => forget(identity)} disabled={busy}>No soy yo</Button>
            <Button mode="contained" onPress={() => confirm(lookup.fullName)} disabled={busy}>Sí, soy yo</Button>
          </View>
        </View>
      ) : (
        <View>
          <Button
            mode="outlined"
            icon="account-search-outline"
            onPress={search}
            loading={lookup.status === 'loading'}
            disabled={busy || !dniOk || lookup.status === 'loading'}
          >
            Ver mi nombre
          </Button>
          {lookup.status === 'error' || nameError ? (
            <HelperText type="error" visible>{lookup.status === 'error' ? lookup.message : nameError}</HelperText>
          ) : null}
        </View>
      )}
      <FormField
        label="Nombre de usuario"
        icon="account-outline"
        value={name}
        onChangeText={(value) => onChange({ ...identity, name: value })}
        maxLength={120}
        autoComplete="off"
        textContentType="none"
        hint="Así te verán en Yuyay. Puedes cambiarlo."
        error={(submitted && !name.trim() ? 'Elige un nombre de usuario.' : undefined) ?? fieldErrors.name}
        editable={!busy}
      />
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  confirm: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 6 },
  question: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 },
}));
