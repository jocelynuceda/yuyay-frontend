import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useAccountTerms } from '../hooks/useAccountTerms';
import { useAuth } from '../hooks/useAuth';
import { getGoogleIdToken, loadGoogleSignIn } from '../services/googleSignIn';
import { NoSessionError } from '../services/http';
import { fonts, makeStyles, radius, useTheme, useThemePreference } from '../theme';
import { classifyGoogleError, GOOGLE_TERMS_REQUIRED } from '../utils/googleAuth';
import { AccountTerms } from './AccountTerms';
import { StatusMessage } from './StatusMessage';

/**
 * Botón oficial de Google en Iniciar sesión y Crear cuenta. Google entrega un ID token y el backend
 * lo cambia por la sesión normal de Yuyay. Si la cuenta es nueva, se piden los términos antes de
 * crearla. En Expo Go o sin ID de cliente configurado no se muestra nada.
 */
export function GoogleSignInSection({ disabled = false }: { disabled?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { dark } = useThemePreference();
  const { loginWithGoogle } = useAuth();
  const terms = useAccountTerms();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  // Credencial de una cuenta nueva que espera la aceptación de los términos
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const google = loadGoogleSignIn();
  if (!google) return null;
  const { GoogleSigninButton } = google;

  async function signIn(idToken: string, acceptedTermsVersion?: string) {
    try {
      await loginWithGoogle(idToken, acceptedTermsVersion);
      // Al autenticarse, el RootNavigator muestra la app
    } catch (e) {
      // Otro intento o un cierre de sesión reemplazó a este: no hay nada que mostrar
      if (e instanceof NoSessionError) return;
      const outcome = classifyGoogleError(e);
      if (outcome.kind === 'terms') {
        setPendingToken(idToken);
        setTermsError(acceptedTermsVersion ? 'El documento cambió. Revísalo y vuelve a aceptarlo para continuar.' : null);
        terms.review();
      } else {
        setPendingToken(null);
        setError(outcome.message);
      }
    }
  }

  async function handlePress() {
    if (busy) return;
    setError(null);
    setTermsError(null);
    setPendingToken(null);
    setBusy(true);
    try {
      const result = await getGoogleIdToken();
      if (result.status === 'ok') await signIn(result.idToken);
      else if (result.status === 'error') setError(result.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!pendingToken || busy) return;
    if (!terms.acceptance) {
      setTermsError('Lee y acepta los términos de uso y el aviso de privacidad para crear tu cuenta.');
      return;
    }
    setTermsError(null);
    setBusy(true);
    try {
      await signIn(pendingToken, terms.acceptance.termsVersion);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <StatusMessage message={error} />
      {pendingToken ? (
        <View style={styles.terms}>
          <Text style={styles.termsText}>{GOOGLE_TERMS_REQUIRED}</Text>
          <AccountTerms terms={terms} requireAcceptance disabled={busy} validationError={terms.acceptance ? null : termsError} />
          {termsError && terms.acceptance ? <StatusMessage message={termsError} /> : null}
          <View style={styles.actions}>
            <Button mode="text" onPress={() => setPendingToken(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button mode="contained" onPress={handleAccept} loading={busy} disabled={busy} style={styles.accept}>
              Crear cuenta con Google
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.button}>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={dark ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
            onPress={handlePress}
            disabled={busy || disabled}
            accessibilityLabel="Continuar con Google"
          />
          {busy ? <ActivityIndicator color={colors.primary} accessibilityLabel="Conectando con Google" /> : null}
        </View>
      )}
      <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.line} />
        <Text style={styles.dividerText}>o con tu correo</Text>
        <View style={styles.line} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: 12 },
  button: { alignItems: 'center', gap: 8 },
  terms: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 },
  termsText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  accept: { borderRadius: radius.pill },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
}));
