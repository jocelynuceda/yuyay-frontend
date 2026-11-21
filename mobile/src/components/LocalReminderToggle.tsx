import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Switch, Text, View } from 'react-native';
import { fonts, makeStyles, useTheme } from '../theme';

/**
 * Interruptor «Avisarme 1 hora antes en este celular» de una cita futura con hora. Si el permiso de
 * notificaciones está negado, explica cómo activarlo sin cambiar nada de la cita.
 */
export function LocalReminderToggle({
  active,
  busy,
  denied,
  onChange,
}: {
  active: boolean;
  busy: boolean;
  denied: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Ionicons name={active ? 'notifications' : 'notifications-outline'} size={18} color={colors.primary} />
        <Text style={styles.label}>Avisarme 1 hora antes en este celular</Text>
        <Switch
          value={active}
          disabled={busy}
          onValueChange={onChange}
          accessibilityLabel="Avisarme 1 hora antes en este celular"
          trackColor={{ true: colors.primary }}
        />
      </View>
      {denied ? (
        <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
          <Text style={styles.denied}>
            Las notificaciones de Yuyay están desactivadas. Actívalas en Ajustes para recibir el aviso.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  wrap: { marginTop: 8, marginLeft: 56, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  denied: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.danger, textDecorationLine: 'underline' },
}));
