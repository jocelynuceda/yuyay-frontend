import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Button } from 'react-native-paper';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Tarjeta blanca con título, la misma de los formularios de Nueva persona y Nuevo registro. */
export function FormCard({ title, children }: { title?: string; children: ReactNode }) {
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
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
  style,
  ...inputProps
}: Pick<TextInputProps, 'accessibilityLabel' | 'autoCorrect' | 'spellCheck' | 'style'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline
        maxLength={maxLength}
        style={[styles.textArea, style]}
        {...inputProps}
      />
      <Text style={styles.counter}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

/** Acción destructiva al pie de un formulario (borrar, eliminar). Se desactiva mientras trabaja. */
export function DeleteButton({ label, onPress, busy }: { label: string; onPress: () => void; busy?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.delete, (pressed || busy) && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
    >
      {busy ? <ActivityIndicator size="small" color={colors.danger} /> : <Ionicons name="trash-outline" size={18} color={colors.danger} />}
      <Text style={styles.deleteText}>{label}</Text>
    </Pressable>
  );
}

export const formStyles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  /** El color va aparte porque depende del tema: [formStyles.error, { color: colors.danger }] */
  error: { fontFamily: fonts.medium, fontSize: 12, marginLeft: 4 },
});

const useStyles = makeStyles(({ colors, shadow }) => ({
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  pressed: { opacity: 0.6 },
  card: {
    backgroundColor: colors.card,
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
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextActive: { color: colors.onInk },
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
}));
