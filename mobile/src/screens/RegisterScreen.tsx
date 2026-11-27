import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AuthLayout } from '../components/AuthLayout';
import { AccountTerms } from '../components/AccountTerms';
import { FormField, passwordInputProps } from '../components/FormField';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { needsTermsReview, useAccountTerms } from '../hooks/useAccountTerms';
import { useDniLookup } from '../hooks/useDniLookup';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { AuthStackParamList } from '../types';
import { isEmail } from '../utils/format';
import { passwordChecks, passwordError, utf8Bytes } from '../utils/password';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const DNI_PATTERN = /^\d{8}$/;

export function RegisterScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [typedFullName, setTypedFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const terms = useAccountTerms();

  const checks = passwordChecks(password);
  const passwordOk = checks.every((c) => c.ok);
  const mismatch = confirm.length > 0 && confirm !== password;
  const dniOk = DNI_PATTERN.test(dni);
  const { lookup, retry } = useDniLookup(dni);
  const manualName = lookup.status === 'manual';
  const fullName = lookup.status === 'found' ? lookup.fullName : manualName ? typedFullName.trim() : '';
  const canSubmit = name.trim() && dniOk && fullName && isEmail(email) && passwordOk && confirm === password;
  const passwordMessage = submitted || utf8Bytes(password) > 72 ? passwordError(password) : undefined;
  const confirmMessage = mismatch
    ? 'Las contraseñas no coinciden.'
    : submitted && !confirm
      ? 'Confirma tu contraseña.'
      : undefined;

  async function handleSubmit() {
    if (loading) return;
    setSubmitted(true);
    if (!canSubmit) return;
    setError(null);
    setTermsError(null);
    if (!terms.acceptance) {
      setTermsError('Lee y acepta los términos de uso y el aviso de privacidad para crear tu cuenta.');
      return;
    }
    setLoading(true);
    setFieldErrors({});
    try {
      await register({ name: name.trim(), fullName, dni, email: email.trim(), password }, terms.acceptance);
    } catch (e) {
      if (needsTermsReview(e)) {
        setTermsError('Revisa el documento vigente y confirma tu aceptación para continuar.');
        terms.review();
      } else if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        // Si el error ya quedó bajo un campo (p. ej. el DNI), no se repite arriba.
        const shownInField = Object.keys(e.fieldErrors).length > 0;
        setError(e.status === 409 ? 'Ya existe una cuenta con ese correo.' : shownInField ? null : e.message);
      } else {
        setError('No pudimos crear tu cuenta.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      mode="register"
      onSwitchMode={() => navigation.replace('Login')}
      title="Crea tu cuenta"
      subtitle="Empieza a cuidar en equipo, paso a paso."
      footer={
        <Text style={styles.footer}>
          ¿Primera vez aquí?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Welcome')}>
            Conoce Yuyay
          </Text>
        </Text>
      }
    >
      <GoogleSignInSection disabled={loading} />
      <StatusMessage message={error} />
      <FormField
        label="DNI"
        icon="card-account-details-outline"
        value={dni}
        onChangeText={(value) => setDni(value.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="off"
        textContentType="none"
        hint="Lo enviamos a APIsPERU para obtener tu nombre. No lo guardamos."
        error={
          (submitted && !dniOk ? 'Ingresa los 8 dígitos de tu DNI.' : undefined)
          ?? (lookup.status === 'error' ? lookup.message : fieldErrors.dni)
        }
      />
      {lookup.status === 'loading' ? <StatusMessage message="Buscando tu nombre…" tone="info" /> : null}
      {lookup.status === 'error' && !lookup.invalid ? <Button onPress={retry}>Reintentar la consulta</Button> : null}
      {manualName ? <StatusMessage message={lookup.message} tone="info" /> : null}
      <FormField
        label="Nombre completo"
        icon="card-text-outline"
        value={manualName ? typedFullName : fullName}
        onChangeText={setTypedFullName}
        editable={manualName}
        multiline={!manualName}
        maxLength={200}
        autoComplete="off"
        textContentType="none"
        hint={manualName ? undefined : 'Se completa con tu DNI.'}
        error={(submitted && dniOk && !fullName ? 'Necesitamos tu nombre completo.' : undefined) ?? fieldErrors.fullName}
      />
      <FormField
        label="Nombre de usuario"
        icon="account-outline"
        value={name}
        onChangeText={setName}
        maxLength={120}
        autoComplete="off"
        textContentType="none"
        hint="Así te verán en Yuyay."
        error={(submitted && !name.trim() ? 'Elige un nombre de usuario.' : undefined) ?? fieldErrors.name}
      />
      <FormField
        label="Correo electrónico"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="off"
        textContentType="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={150}
        error={(submitted && !isEmail(email) ? 'Ingresa un correo válido.' : undefined) ?? fieldErrors.email}
      />
      <FormField
        label="Contraseña"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        {...passwordInputProps}
        error={passwordMessage ?? fieldErrors.password}
        right={
          <TextInput.Icon
            icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onPress={() => setShowPassword((s) => !s)}
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          />
        }
      />
      <View style={styles.checks}>
        {checks.map((c) => (
          <View key={c.label} style={styles.check}>
            <Ionicons
              name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={c.ok ? colors.accentText : colors.muted}
            />
            <Text style={[styles.checkText, c.ok && { color: colors.accentText }]}>{c.label}</Text>
          </View>
        ))}
      </View>
      <FormField
        label="Confirma tu contraseña"
        icon="lock-check-outline"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!showPassword}
        {...passwordInputProps}
        error={confirmMessage}
        onSubmitEditing={handleSubmit}
      />
      <AccountTerms terms={terms} requireAcceptance disabled={loading} validationError={terms.acceptance ? null : termsError} />
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={loading}
        disabled={loading}
        icon="arrow-right"
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        style={styles.button}
      >
        Crear cuenta
      </Button>
    </AuthLayout>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  footer: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  link: { fontFamily: fonts.semibold, color: colors.primary },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: -2, marginBottom: 6, paddingLeft: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  button: { marginTop: 12, borderRadius: radius.pill },
  buttonContent: { height: 52, flexDirection: 'row-reverse' },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
}));
