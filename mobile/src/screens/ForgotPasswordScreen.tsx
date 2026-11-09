import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, passwordInputProps } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { forgotPassword, resetPassword } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts, radius } from '../theme';
import type { AuthStackParamList } from '../types';
import { isEmail } from '../utils/format';
import { passwordChecks, passwordError, utf8Bytes } from '../utils/password';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

/** Dos pasos: pedir el código por correo y usarlo para elegir una contraseña nueva. */
export function ForgotPasswordScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const checks = passwordChecks(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canReset = /^\d{6}$/.test(code) && checks.every((c) => c.ok) && confirm === password;
  const passwordMessage = submitted || utf8Bytes(password) > 72 ? passwordError(password) : undefined;
  const confirmMessage = mismatch
    ? 'Las contraseñas no coinciden.'
    : submitted && !confirm
      ? 'Confirma tu contraseña.'
      : undefined;

  async function requestCode() {
    setSubmitted(true);
    if (!isEmail(email)) return;
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      if (codeSent) setNotice('Si pasó al menos un minuto, te enviamos un código nuevo.');
      setCodeSent(true);
      setSubmitted(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos enviar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setSubmitted(true);
    if (!canReset) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await resetPassword(email.trim(), code, password);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos cambiar tu contraseña.');
      }
      setLoading(false);
      return;
    }
    try {
      // Al autenticarse, el RootNavigator muestra la app automáticamente
      await login(email.trim(), password);
    } catch {
      // La contraseña ya cambió y el código ya no sirve: se entra desde el login
      navigation.navigate('Login');
    }
  }

  return (
    <AuthLayout
      title={codeSent ? 'Revisa tu correo' : 'Recupera tu cuenta'}
      subtitle={
        codeSent
          ? `Si ${email.trim()} tiene una cuenta, te enviamos un código de 6 dígitos.`
          : 'Te enviaremos un código para elegir una contraseña nueva.'
      }
      footer={
        <Text style={styles.link} onPress={() => navigation.navigate('Login')} accessibilityRole="link">
          Volver a iniciar sesión
        </Text>
      }
    >
      <StatusMessage message={error} />
      {codeSent ? (
        <>
          <FormField
            label="Código"
            icon="numeric"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            error={(submitted && code.length !== 6 ? 'Ingresa los 6 dígitos.' : undefined) ?? fieldErrors.code}
            hint={notice}
          />
          <FormField
            label="Contraseña nueva"
            icon="lock-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            {...passwordInputProps}
            error={passwordMessage ?? fieldErrors.newPassword}
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
            onSubmitEditing={handleReset}
          />
          <Button
            mode="contained"
            onPress={handleReset}
            loading={loading}
            disabled={loading}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            style={styles.button}
          >
            Cambiar contraseña
          </Button>
          <Button mode="text" onPress={requestCode} disabled={loading} labelStyle={styles.resendLabel}>
            Enviar otro código
          </Button>
        </>
      ) : (
        <>
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
            error={submitted && !isEmail(email) ? 'Ingresa un correo válido.' : undefined}
            onSubmitEditing={requestCode}
          />
          <Button
            mode="contained"
            onPress={requestCode}
            loading={loading}
            disabled={loading}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            style={styles.button}
          >
            Enviar código
          </Button>
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: -2, marginBottom: 6, paddingLeft: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  button: { marginTop: 12, borderRadius: radius.pill },
  buttonContent: { height: 52 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  resendLabel: { fontFamily: fonts.medium, fontSize: 14 },
});
