import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AuthLayout } from '../components/AuthLayout';
import { FormField } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/http';
import { colors, fonts, radius } from '../theme';
import type { AuthStackParamList } from '../types';
import { isEmail } from '../utils/format';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError = submitted && !isEmail(email) ? 'Ingresa un correo válido.' : undefined;
  const passwordError = submitted && !password ? 'Ingresa tu contraseña.' : undefined;

  async function handleSubmit() {
    setSubmitted(true);
    if (!isEmail(email) || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // Al autenticarse, el RootNavigator muestra la app automáticamente
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('Correo o contraseña incorrectos.');
      else setError(e instanceof ApiError ? e.message : 'No pudimos iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      mode="login"
      onSwitchMode={() => navigation.replace('Register')}
      title="Hola de nuevo"
      subtitle="Tu familia y tus cuidados, en un solo lugar."
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
        label="Correo electrónico"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={emailError}
      />
      <FormField
        label="Contraseña"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete="current-password"
        error={passwordError}
        right={
          <TextInput.Icon
            icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onPress={() => setShowPassword((s) => !s)}
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          />
        }
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
        Iniciar sesión
      </Button>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  link: { fontFamily: fonts.semibold, color: colors.primary },
  button: { marginTop: 12, borderRadius: radius.pill },
  buttonContent: { height: 52, flexDirection: 'row-reverse' },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
});
