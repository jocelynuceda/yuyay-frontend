import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputInstance, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

type Parts = { day: string; month: string; year: string };

/** Valida las tres partes y devuelve la fecha ISO (AAAA-MM-DD) o el motivo del error. */
export function parseDateParts(
  { day, month, year }: Parts,
  { allowFuture = false }: { allowFuture?: boolean } = {},
): { iso: string; error?: string } {
  if (!day && !month && !year) return { iso: '' };
  if (!day || !month || year.length !== 4) return { iso: '', error: 'Completa día, mes y año.' };
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { iso: '', error: 'Esa fecha no existe.' };
  }
  if (y < 1900 || (!allowFuture && date > new Date())) return { iso: '', error: 'Revisa el año.' };
  return { iso: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` };
}

/** Separa una fecha AAAA-MM-DD en las tres casillas de DateField. */
export function datePartsOf(iso: string): Parts {
  const [year, month, day] = iso.split('-');
  return { day, month, year };
}

/** Fecha en tres casillas numéricas (día, mes, año) que avanzan solas al completarse. */
export function DateField({
  label,
  onChange,
  error,
  initial,
}: {
  label: string;
  onChange: (parts: Parts) => void;
  error?: string;
  initial?: Parts;
}) {
  const [parts, setParts] = useState<Parts>(initial ?? { day: '', month: '', year: '' });
  const monthRef = useRef<TextInputInstance>(null);
  const yearRef = useRef<TextInputInstance>(null);

  function update(key: keyof Parts, raw: string, max: number, next?: React.RefObject<TextInputInstance | null>) {
    const value = raw.replace(/\D/g, '').slice(0, max);
    const updated = { ...parts, [key]: value };
    setParts(updated);
    onChange(updated);
    if (value.length === max) next?.current?.focus();
  }

  const fields: {
    key: keyof Parts;
    placeholder: string;
    max: number;
    flex: number;
    ref?: React.RefObject<TextInputInstance | null>;
    next?: React.RefObject<TextInputInstance | null>;
  }[] = [
    { key: 'day', placeholder: 'DD', max: 2, flex: 1, next: monthRef },
    { key: 'month', placeholder: 'MM', max: 2, flex: 1, ref: monthRef, next: yearRef },
    { key: 'year', placeholder: 'AAAA', max: 4, flex: 1.6, ref: yearRef },
  ];

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {fields.map((f) => (
          <View key={f.key} style={[styles.box, { flex: f.flex }, !!error && styles.boxError]}>
            <Text style={styles.caption}>{{ day: 'Día', month: 'Mes', year: 'Año' }[f.key]}</Text>
            <TextInput
              ref={f.ref}
              value={parts[f.key]}
              onChangeText={(t) => update(f.key, t, f.max, f.next)}
              placeholder={f.placeholder}
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              maxLength={f.max}
              // Sin autocompletar: evita el relleno amarillo de iOS
              autoComplete="off"
              textContentType="none"
              style={styles.input}
              accessibilityLabel={`${label}: ${f.placeholder}`}
            />
          </View>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boxError: { borderColor: colors.danger },
  caption: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  input: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink, paddingVertical: 4 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 6, marginLeft: 4 },
});
