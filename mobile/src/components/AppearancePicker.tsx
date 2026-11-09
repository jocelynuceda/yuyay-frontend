import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme, useThemePreference, type ThemePreference } from '../theme';

const options: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

/** Selector de apariencia: seguir al sistema, claro u oscuro. La elección se guarda en el dispositivo. */
export function AppearancePicker() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Apariencia">
      {options.map((o) => {
        const active = preference === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => setPreference(o.value)}
            style={[styles.option, active && styles.optionActive]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
          >
            <Ionicons name={o.icon} size={18} color={active ? colors.white : colors.muted} />
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    ...shadow,
    shadowOpacity: shadow.shadowOpacity / 2,
    elevation: 2,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  optionActive: { backgroundColor: colors.primary },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  labelActive: { color: colors.white },
}));
