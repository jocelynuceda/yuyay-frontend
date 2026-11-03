import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/http';
import { colors, fonts, radius } from '../theme';
import type { AuthStackParamList } from '../types';
import { isEmail } from '../utils/format';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/** Mismas reglas que el backend: 8–72 caracteres, al menos una letra y un número. */
function passwordChecks(password: string) {
  return [
    { ok: password.length >= 8, label: '8 caracteres' },
    { ok: /[A-Za-z]/.test(password), label: 'Una letra' },
    { ok: /\d/.test(password), label: 'Un número' },
  ];
}

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const checks = passwordChecks(password);
  const passwordOk = checks.every((c) => c.ok);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = name.trim() && isEmail(email) && passwordOk && confirm === password;

  async function handleSubmit() {
    setSubmitted(true);
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e) {
      if (e instanceof ApiError) {
        setFieldErrors(e.fieldErrors);
        setError(e.status === 409 ? 'Ya existe una cuenta con ese correo.' : e.message);
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
      <StatusMessage message={error} />
      <FormField
        label="Nombre"
        icon="account-outline"
        value={name}
        onChangeText={setName}
        maxLength={120}
        autoComplete="name"
        error={(submitted && !name.trim() ? 'Ingresa tu nombre.' : undefined) ?? fieldErrors.name}
      />
      <FormField
        label="Correo electrónico"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={150}
        error={(submitted && !isEmail(email) ? 'Ingresa un correo válido.' : undefined) ?? fieldErrors.email}
      />
      <FormField
        label="Contraseña"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="new-password"
        maxLength={72}
        error={fieldErrors.password}
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
        autoComplete="new-password"
        error={mismatch ? 'Las contraseñas no coinciden.' : undefined}
        onSubmitEditing={handleSubmit}
      />
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

const styles = StyleSheet.create({
  footer: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  link: { fontFamily: fonts.semibold, color: colors.primary },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: -2, marginBottom: 6, paddingLeft: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  button: { marginTop: 12, borderRadius: radius.pill },
  buttonContent: { height: 52, flexDirection: 'row-reverse' },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
});
