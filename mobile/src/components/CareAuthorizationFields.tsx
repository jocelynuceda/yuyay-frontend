import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { useCareAuthorization } from '../hooks/useCareAuthorization';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { profileKinds, thirdPartyTypes } from '../utils/careAuthorization';
import { FormCard } from './FormKit';
import { StatusMessage } from './StatusMessage';

function Choice({
  label, description, checked, disabled, role = 'radio', onPress,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  role?: 'radio' | 'checkbox';
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const icon = role === 'checkbox'
    ? (checked ? 'checkbox-outline' : 'square-outline')
    : (checked ? 'radio-button-on' : 'radio-button-off');
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={[label, description].filter(Boolean).join(' ')}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, checked && styles.active]}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={styles.choiceText}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
    </Pressable>
  );
}

export function CareAuthorizationFields({
  authorization, disabled, existing = false,
}: {
  authorization: ReturnType<typeof useCareAuthorization>;
  existing?: boolean;
  disabled: boolean;
}) {
  const styles = useStyles();
  const { document, profileKind, option, declaration } = authorization;

  if (authorization.loading) {
    return <Text accessibilityLiveRegion="polite" style={styles.description}>Cargando las opciones de autorización…</Text>;
  }
  if (!document) {
    return (
      <FormCard title="Autorización">
        <StatusMessage message={authorization.error ?? 'No pudimos cargar las opciones de autorización.'} />
        <Button onPress={authorization.review}>Volver a cargar</Button>
      </FormCard>
    );
  }

  return (
    <FormCard>
      <View accessibilityRole="radiogroup" accessibilityLabel="¿Para quién es el perfil?" style={styles.group}>
        <Text accessibilityRole="header" style={styles.heading}>¿Para quién es el perfil?</Text>
        {profileKinds.map((kind) => {
          const policyOption = document.options.find((entry) => entry.type === kind);
          return kind === 'THIRD_PARTY' || policyOption ? (
            <Choice
              key={kind}
              label={policyOption?.label ?? 'El perfil es para otra persona.'}
              description={policyOption?.description}
              checked={profileKind === kind}
              disabled={disabled}
              onPress={() => authorization.chooseProfileKind(kind)}
            />
          ) : null;
        })}
      </View>
      {profileKind === 'THIRD_PARTY' && (
        <View accessibilityRole="radiogroup" accessibilityLabel={document.thirdPartyQuestion} style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>{document.thirdPartyQuestion}</Text>
          {thirdPartyTypes.map((type) => {
            const policyOption = document.options.find((entry) => entry.type === type);
            return policyOption ? (
              <Choice
                key={type}
                label={policyOption.label}
                description={policyOption.description}
                checked={authorization.thirdPartyType === type}
                disabled={disabled}
                onPress={() => authorization.chooseThirdPartyType(type)}
              />
            ) : null;
          })}
        </View>
      )}
      {option?.type === 'PENDING' && (
        <StatusMessage tone="info" message={existing ? 'Podrás registrar la declaración cuando cuentes con autorización.' : 'Para agregar a esta persona, primero debes contar con su autorización.'} />
      )}
      {option?.confirmationText && (
        <Choice
          role="checkbox"
          label={option.confirmationText}
          checked={Boolean(declaration)}
          disabled={disabled}
          onPress={() => authorization.confirm(!declaration)}
        />
      )}
      <Text style={styles.description}>Versión {document.textVersion}</Text>
    </FormCard>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  group: { gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 44,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
  },
  active: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  choiceText: { flex: 1, gap: 3 },
  label: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 14 },
  description: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13 },
}));
