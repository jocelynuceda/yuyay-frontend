import { Alert, Linking, Text } from 'react-native';
import { fonts, makeStyles } from '../theme';
import type { RegistrationIdentity } from '../types';
import { FormField } from './FormField';

export function RegistrationIdentityFields({ identity, onChange, fieldErrors, submitted, busy }: {
  identity: RegistrationIdentity;
  onChange: (next: RegistrationIdentity) => void;
  fieldErrors: Record<string, string>;
  submitted: boolean;
  busy: boolean;
}) {
  const { dni, fullName, name } = identity;
  const dniOk = /^\d{8}$/.test(dni);
  const update = (field: keyof RegistrationIdentity, value: string) => onChange({ ...identity, [field]: value });
  return (
    <>
      <FormField
        label="DNI"
        icon="card-account-details-outline"
        value={dni}
        onChangeText={(value) => update('dni', value.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="off"
        textContentType="none"
        hint="Al crear tu cuenta, enviamos tu DNI a un proveedor externo para contrastar los nombres y apellidos que escribes."
        error={
          (submitted && !dniOk ? 'Ingresa los 8 dígitos de tu DNI.' : undefined)
          ?? fieldErrors.dni
        }
        editable={!busy}
      />
      <FormField
        label="Nombres y apellidos según tu DNI"
        icon="card-text-outline"
        value={fullName}
        onChangeText={(value) => update('fullName', value)}
        maxLength={200}
        autoComplete="name"
        textContentType="name"
        error={(submitted && !fullName.trim() ? 'Escribe tus nombres y apellidos según tu DNI.' : undefined) ?? fieldErrors.fullName}
        editable={!busy}
      />
      <FormField
        label="Nombre de usuario"
        icon="account-outline"
        value={name}
        onChangeText={(value) => update('name', value)}
        maxLength={120}
        autoComplete="off"
        textContentType="none"
        hint="Así te verán en Yuyay."
        error={(submitted && !name.trim() ? 'Elige un nombre de usuario.' : undefined) ?? fieldErrors.name}
        editable={!busy}
      />
    </>
  );
}

const SUPPORT_EMAIL = 'luisfelipe.28h@gmail.com';

export function RegistrationSupport() {
  const styles = useStyles();
  return (
    <Text style={styles.footer}>
      ¿Necesitas ayuda con el registro?{' '}
      <Text accessibilityRole="link" style={styles.link} onPress={() => {
        void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => Alert.alert('Soporte de Yuyay', SUPPORT_EMAIL));
      }}>Escribe a soporte</Text> sin incluir tu DNI.
    </Text>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  footer: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  link: { fontFamily: fonts.semibold, color: colors.primary },
}));
