import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getBiometricSupport, type BiometricSupport } from '../services/biometric';
import { biometricHint } from '../utils/biometricSupport';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/**
 * «Desbloquear Yuyay con biometría» en este celular. Yuyay no guarda huellas ni rostros: el teléfono los
 * comprueba y solo entrega la clave que abre la sesión guardada. No aparece si el teléfono no es compatible.
 */
export function BiometricToggle() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { biometricEnabled, setBiometricEnabled } = useAuth();
  const toast = useToast();
  const [support, setSupport] = useState<BiometricSupport | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getBiometricSupport().then((result) => { if (active) setSupport(result); });
    return () => { active = false; };
  }, []);

  if (!support || (support.status === 'unsupported' && !biometricEnabled)) return null;
  const label = support.status === 'unsupported' ? 'biometría' : support.label;
  const canEnable = support.status === 'available';

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await setBiometricEnabled(next);
      toast(next ? `Yuyay se desbloqueará con ${label} en este celular.` : 'Desbloqueo con biometría desactivado.');
    } catch {
      toast(next ? 'No se activó: la comprobación se canceló o falló.' : 'No pudimos desactivar el desbloqueo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name={support.status !== 'unsupported' && support.kind === 'face' ? 'scan' : 'finger-print'} size={22} color={colors.primary} />
        <View style={styles.text}>
          <Text style={styles.title}>Desbloquear con {label}</Text>
          <Text style={styles.hint}>{biometricHint(support, biometricEnabled)}</Text>
        </View>
        <Switch
          value={biometricEnabled}
          onValueChange={(next) => { void toggle(next); }}
          disabled={busy || (!biometricEnabled && !canEnable)}
          accessibilityLabel={`Desbloquear Yuyay con ${label}`}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
}));
