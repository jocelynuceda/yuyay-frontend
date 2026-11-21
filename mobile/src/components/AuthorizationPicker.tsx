import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { CareAuthorizationOption, CareAuthorizationPolicy } from '../types';
import { findOption, splitAuthorizationOptions, type AuthorizationChoice } from '../utils/authorization';

/**
 * Pregunta de autorización al añadir (o completar) una persona, con el texto del catálogo del
 * backend: opciones con su ayuda visible, ninguna marcada, y la confirmación solo cuando corresponde.
 */
export function AuthorizationPicker({
  policy,
  value,
  onChange,
  error,
}: {
  policy: CareAuthorizationPolicy;
  value: AuthorizationChoice;
  onChange: (value: AuthorizationChoice) => void;
  error?: string | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { ownOptions, thirdPartyOptions } = splitAuthorizationOptions(policy);
  const selected = findOption(policy, value.type);

  const option = (o: CareAuthorizationOption) => {
    const checked = value.type === o.type;
    return (
      <Pressable
        key={o.type}
        // Cambiar de opción vuelve a pedir la confirmación
        onPress={() => onChange({ type: o.type, confirmed: false })}
        accessibilityRole="radio"
        accessibilityState={{ checked }}
        accessibilityHint={o.description}
        style={({ pressed }) => [styles.option, checked && styles.optionChecked, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name={checked ? 'radio-button-on' : 'radio-button-off'} size={22} color={checked ? colors.primary : colors.muted} />
        <View style={styles.flex}>
          <Text style={styles.label}>{o.label}</Text>
          <Text style={styles.help}>{o.description}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {ownOptions.map(option)}
      {thirdPartyOptions.length > 0 ? (
        <Text style={styles.question}>Si es otra persona: {policy.thirdPartyQuestion}</Text>
      ) : null}
      {thirdPartyOptions.map(option)}

      {selected?.confirmationText ? (
        <Pressable
          onPress={() => onChange({ ...value, confirmed: !value.confirmed })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value.confirmed }}
          style={({ pressed }) => [styles.confirm, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={value.confirmed ? 'checkbox' : 'square-outline'}
            size={22}
            color={value.confirmed ? colors.primary : colors.muted}
          />
          <Text style={[styles.flex, styles.confirmText]}>{selected.confirmationText}</Text>
        </Pressable>
      ) : null}

      {selected && !selected.confirmationText ? (
        <View style={styles.pending} accessibilityLiveRegion="polite">
          <Text style={styles.pendingText}>
            {selected.description.replace(/\.?$/, '.')} No se creará el perfil todavía: puedes volver más tarde o elegir otra
            opción.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text style={styles.note}>Esto queda registrado como tu declaración, con fecha. Yuyay no verifica la autorización.</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  wrap: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
  },
  optionChecked: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.softText, marginTop: 2 },
  question: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, marginTop: 6 },
  confirm: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
  },
  confirmText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  pending: { backgroundColor: colors.amberBg, borderRadius: radius.md, padding: 12 },
  pendingText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.amberText },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
}));
