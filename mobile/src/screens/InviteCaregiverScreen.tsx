import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ChoiceChips, FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { StatusMessage } from '../components/StatusMessage';
import { inviteCaregiver } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { CareRole, HomeStackParamList } from '../types';
import { careRoleLabel, isEmail } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'InviteCaregiver'>;

const roleOptions: { value: CareRole; label: string }[] = [
  { value: 'CAREGIVER', label: careRoleLabel.CAREGIVER },
  { value: 'PRINCIPAL', label: careRoleLabel.PRINCIPAL },
];

const labelSuggestions = ['Hija', 'Hijo', 'Pareja', 'Hermana', 'Hermano', 'Enfermera', 'Amiga'];

export function InviteCaregiverScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId } = route.params;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CareRole>('CAREGIVER');
  const [label, setLabel] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailError = submitted && !isEmail(email) ? 'Ingresa un correo válido.' : undefined;

  async function handleInvite() {
    setSubmitted(true);
    if (!isEmail(email)) return;
    setSaving(true);
    setError(null);
    try {
      await inviteCaregiver(subjectId, { email: email.trim(), role, relationshipLabel: label.trim() });
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFieldErrors(e.fieldErrors);
      } else {
        setError('No pudimos enviar la invitación.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error} />

      <FormCard title="¿A quién invitas?">
        <FormField
          label="Correo"
          icon="email-outline"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={emailError ?? fieldErrors.email}
          hint="Debe tener una cuenta en Yuyay."
        />
      </FormCard>

      <FormCard title="Rol">
        <ChoiceChips options={roleOptions} selected={[role]} onToggle={setRole} />
        <Text style={styles.help}>
          {role === 'PRINCIPAL'
            ? 'Podrá invitar y quitar cuidadores, delegar accesos y registrar citas.'
            : 'Podrá ver y agregar registros de salud.'}
        </Text>
      </FormCard>

      <FormCard title="Parentesco (opcional)">
        <ChoiceChips
          options={labelSuggestions.map((l) => ({ value: l, label: l }))}
          selected={[label]}
          onToggle={(l) => setLabel((prev) => (prev === l ? '' : l))}
        />
        <FormField label="Otro" value={label} onChangeText={setLabel} maxLength={60} error={fieldErrors.relationshipLabel} />
      </FormCard>

      <View style={styles.info}>
        <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
        <Text style={styles.infoText}>Le llegará un aviso y deberá aceptar la invitación desde su app.</Text>
      </View>

      <SubmitButton label="Enviar invitación" icon="send" onPress={handleInvite} loading={saving} />
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    padding: 14,
  },
  infoText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.primary, lineHeight: 18 },
}));
