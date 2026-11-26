import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Menu, TextInput } from 'react-native-paper';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { durationUnitLabels, durationUnits, type Duration } from '../utils/accessDurations';

export function DurationField({ label, value, onChange, hint, error, disabled }: {
  label: string;
  value: Duration;
  onChange: (value: Duration) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.controls}>
          <TextInput
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            mode="outlined"
            dense
            value={value.amount}
            keyboardType="number-pad"
            onChangeText={(amount) => onChange({ ...value, amount })}
            error={!!error}
            outlineColor={colors.line}
            outlineStyle={styles.outline}
            style={styles.input}
            disabled={disabled}
          />
          <View style={styles.unit}>
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <Button mode="outlined" icon="chevron-down" disabled={disabled}
                  accessibilityLabel={`Unidad de ${label.toLowerCase()}. ${durationUnitLabels[value.unit]}`}
                  onPress={() => setMenuOpen(true)} style={styles.unitButton}>
                  {durationUnitLabels[value.unit]}
                </Button>
              }
            >
              {durationUnits.map((unit) => (
                <Menu.Item key={unit} title={durationUnitLabels[unit]} onPress={() => {
                  setMenuOpen(false);
                  onChange({ ...value, unit });
                }} />
              ))}
            </Menu>
          </View>
        </View>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  field: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  controls: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, width: 246, maxWidth: '100%' },
  input: { flex: 1, minWidth: 0, backgroundColor: colors.card },
  outline: { borderRadius: radius.md },
  unit: { width: 126 },
  unitButton: { borderRadius: radius.md, borderColor: colors.line },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, flexBasis: 152, flexGrow: 1 },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
}));
