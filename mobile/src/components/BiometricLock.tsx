import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { getBiometricSupport } from '../services/biometric';
import { fonts, makeStyles, useTheme } from '../theme';

/**
 * Cubre toda la app mientras la sesión está bloqueada. El teléfono comprueba la huella o el rostro; si se cancela
 * o falla, Yuyay sigue bloqueado y se puede volver a intentar o entrar con la cuenta.
 */
export function BiometricLock() {
  const { locked } = useAuth();
  // onRequestClose vacío: el botón atrás de Android no salta el bloqueo
  return (
    <Modal visible={locked} animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {locked ? <LockContent /> : null}
    </Modal>
  );
}

function LockContent() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { unlock, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [label, setLabel] = useState('biometría');
  const [face, setFace] = useState(false);
  const running = useRef(false);

  const attempt = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const support = await getBiometricSupport();
      if (support.status !== 'unsupported') {
        setLabel(support.label);
        setFace(support.kind === 'face');
      }
      if (support.status !== 'available') {
        setMessage(
          support.status === 'needs-app'
            ? 'En Expo Go el iPhone no deja usar Face ID. Entra con tu cuenta para continuar.'
            : 'Ya no hay huella ni rostro registrado en este teléfono. Entra con tu cuenta para continuar.',
        );
        return;
      }
      const result = await unlock();
      if (result === 'failed') setMessage('No se pudo comprobar. Vuelve a intentarlo o entra con tu cuenta.');
      else if (result === 'invalidated') {
        Alert.alert('Vuelve a iniciar sesión', 'Cambiaron las huellas o rostros del teléfono. Por seguridad, entra de nuevo con tu cuenta.');
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [unlock]);

  // Pide la biometría apenas aparece el bloqueo
  useEffect(() => { void attempt(); }, [attempt]);

  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Ionicons name="lock-closed" size={36} color={colors.primary} />
      </View>
      <Text style={styles.title}>Yuyay está bloqueado</Text>
      <Text style={styles.body}>Desbloquéalo con {label} para ver la información de las personas a tu cuidado.</Text>
      {message ? <Text style={styles.message} accessibilityLiveRegion="polite">{message}</Text> : null}
      <Button mode="contained" icon={face ? 'face-recognition' : 'fingerprint'} onPress={() => { void attempt(); }} loading={busy} disabled={busy} style={styles.button}>
        Desbloquear
      </Button>
      <Button onPress={() => { void logout(); }} disabled={busy}>
        Entrar con mi cuenta
      </Button>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.surface },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  message: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger, textAlign: 'center', maxWidth: 320 },
  button: { alignSelf: 'stretch', marginTop: 12 },
}));
