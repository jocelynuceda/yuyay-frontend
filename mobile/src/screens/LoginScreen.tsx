import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, passwordInputProps } from '../components/FormField';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius } from '../theme';
import type { AuthStackParamList, RootStackParamList } from '../types';
import { isEmail } from '../utils/format';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const styles = useStyles();
  const { login } = useAuth();
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
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
        <>
          <Text style={styles.footer}>
            ¿Primera vez aquí?{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Welcome')}>
              Conoce Yuyay
            </Text>
          </Text>
          <Text style={[styles.footer, styles.codeLink]}>
            ¿Te compartieron información?{' '}
            <Text style={styles.link} onPress={() => rootNavigation.navigate('Delegate')}>
              Tengo un código
            </Text>
          </Text>
        </>
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
        autoComplete="off"
        textContentType="none"
        autoCorrect={false}
        spellCheck={false}
        error={emailError}
      />
      <FormField
        label="Contraseña"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        {...passwordInputProps}
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
      <Text
        style={[styles.link, styles.forgot]}
        onPress={() => navigation.navigate('ForgotPassword')}
        accessibilityRole="link"
      >
        ¿Olvidaste tu contraseña?
      </Text>
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

const useStyles = makeStyles(({ colors }) => ({
  footer: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  link: { fontFamily: fonts.semibold, color: colors.primary },
  codeLink: { marginTop: 10 },
  forgot: { alignSelf: 'flex-end', fontSize: 14, paddingVertical: 4 },
  button: { marginTop: 12, borderRadius: radius.pill },
  buttonContent: { height: 52, flexDirection: 'row-reverse' },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
}));
