import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import { colors, fonts, radius, shadow } from '../theme';

/** Tarjeta blanca con título, la misma de los formularios de Nueva persona y Nuevo registro. */
export function FormCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

/** Botón principal de los formularios. */
export function SubmitButton({
  label,
  icon = 'check',
  onPress,
  loading,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      mode="contained"
      icon={icon}
      onPress={onPress}
      loading={loading}
      disabled={loading}
      contentStyle={styles.buttonContent}
      labelStyle={styles.buttonLabel}
      style={styles.button}
    >
      {label}
    </Button>
  );
}

/** Opciones en forma de chips: quien llama decide si se marca una o varias. */
export function ChoiceChips<T extends string | number>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onToggle(o.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Texto largo con contador de caracteres. */
export function TextArea({
  value,
  onChangeText,
  placeholder,
  maxLength = 500,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        maxLength={maxLength}
        style={styles.textArea}
      />
      <Text style={styles.counter}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginLeft: 4 },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  button: { borderRadius: radius.pill, marginTop: 4 },
  buttonContent: { height: 54 },
  buttonLabel: { fontFamily: fonts.semibold, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextActive: { color: colors.white },
  textArea: {
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  counter: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, alignSelf: 'flex-end', marginTop: 6 },
});
