import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import type { TimeParts } from '../utils/calendar';
import { ChoiceChips } from './FormKit';

const periods = [
  { value: 'am' as const, label: 'a. m.' },
  { value: 'pm' as const, label: 'p. m.' },
];

const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);

/** Hora en dos casillas numéricas y selector a. m./p. m. */
export function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label?: string;
  value: TimeParts;
  onChange: (value: TimeParts) => void;
  error?: string;
}) {
  const boxStyle = [styles.input, !!error && styles.inputError];
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          value={value.hour}
          onChangeText={(t) => onChange({ ...value, hour: digits(t) })}
          placeholder="HH"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          style={boxStyle}
          accessibilityLabel="Hora"
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          value={value.minute}
          onChangeText={(t) => onChange({ ...value, minute: digits(t) })}
          placeholder="MM"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          style={boxStyle}
          accessibilityLabel="Minutos"
        />
        <ChoiceChips
          options={periods}
          selected={[value.period]}
          onToggle={(period) => onChange({ ...value, period })}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  input: {
    width: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 10,
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
  },
  inputError: { borderColor: colors.danger },
  colon: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6, marginLeft: 4 },
});
