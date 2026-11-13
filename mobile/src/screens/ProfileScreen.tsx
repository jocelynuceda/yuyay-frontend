import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AppearancePicker } from '../components/AppearancePicker';
import { AvatarPicker } from '../components/AvatarPicker';
import { FormField } from '../components/FormField';
import { SubmitButton } from '../components/FormKit';
import { ProfileCard } from '../components/ProfileCard';
import { useAuth } from '../hooks/useAuth';
import { useAvatar } from '../hooks/useAvatar';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useToast } from '../hooks/useToast';
import { getCareSubjects, getNotifications, updateMe } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { RootStackParamList, TabNavigatorParamList } from '../types';
import { formatDate } from '../utils/format';

type Props = BottomTabScreenProps<TabNavigatorParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  // Editar el nombre de la cuenta, como en el perfil de la web
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const rootNavigation = useNavigation<NavigationProp<RootStackParamList>>();
  const subjects = useFetch(getCareSubjects);
  const notifications = useFetch(getNotifications);
  useRefreshOnFocus(() => {
    subjects.reload();
    notifications.reload();
  });
  const avatar = useAvatar({ type: 'me' });
  const [pickingAvatar, setPickingAvatar] = useState(false);
  if (!user) return null;

  const unread = notifications.data?.filter((n) => !n.read).length;

  async function saveName() {
    if (!name.trim()) {
      setNameError('Ingresa tu nombre.');
      return;
    }
    setSavingName(true);
    setNameError(undefined);
    try {
      updateUser(await updateMe(name.trim()));
      setEditingName(false);
      toast('Nombre actualizado.');
    } catch (e) {
      setNameError(e instanceof ApiError ? (e.fieldErrors.name ?? e.message) : 'No pudimos guardar tu nombre.');
    } finally {
      setSavingName(false);
    }
  }
  const memberYear = new Date(user.createdAt).getFullYear();

  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; featured?: boolean; purple?: boolean }[] = [
    { icon: 'people', label: 'Personas', onPress: () => navigation.navigate('HomeTab', { screen: 'Home' }), purple: true },
    { icon: 'notifications', label: 'Avisos', onPress: () => navigation.navigate('Notifications') },
    {
      icon: 'person-add',
      label: 'Agregar',
      onPress: () => navigation.navigate('HomeTab', { screen: 'NewSubject' }),
      featured: true,
    },
  ];

  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; tint: string }[] = [
    { icon: 'mail-outline', label: 'Correo', value: user.email, tint: colors.primary },
    {
      icon: 'shield-checkmark-outline',
      label: 'Rol',
      value: user.role === 'ADMIN' ? 'Administrador' : 'Cuidador',
      tint: colors.accent,
    },
    { icon: 'calendar-outline', label: 'Miembro desde', value: formatDate(user.createdAt), tint: colors.softText },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <AvatarPicker
        visible={pickingAvatar}
        title="Tu avatar"
        current={avatar.avatar}
        automatic={avatar.automatic}
        isCustom={avatar.isCustom}
        onSelect={(choice) => void avatar.setAvatar(choice)}
        onClose={() => setPickingAvatar(false)}
      />
      <ProfileCard
        name={user.name}
        subtitle={user.email}
        avatar={avatar.avatar}
        onAvatarPress={() => setPickingAvatar(true)}
        chip={user.role === 'ADMIN' ? 'Admin' : 'Cuidador'}
        stats={[
          { icon: 'people-outline', value: subjects.data ? String(subjects.data.length) : '–', label: 'A tu cuidado' },
          { icon: 'notifications-outline', value: unread !== undefined ? String(unread) : '–', label: 'Sin leer' },
          { icon: 'sparkles-outline', value: String(memberYear), label: 'Desde' },
        ]}
      />

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.action,
              a.featured && styles.actionFeatured,
              a.purple && styles.actionPurple,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Ionicons name={a.icon} size={30} color={a.featured ? colors.white : a.purple ? colors.onPeopleAction : colors.softText} />
            <Text style={[styles.actionLabel, a.purple && styles.actionLabelPeople, a.featured && styles.actionLabelFeatured]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowDivider]}>
            <View style={styles.rowIcon}>
              <Ionicons name={row.icon} size={20} color={row.tint} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {editingName ? (
        <View style={styles.nameForm}>
          <FormField label="Nombre" value={name} onChangeText={setName} maxLength={120} autoComplete="name" error={nameError} />
          <SubmitButton label="Guardar nombre" onPress={saveName} loading={savingName} />
          <Pressable onPress={() => setEditingName(false)} hitSlop={8} accessibilityRole="button" style={styles.logout}>
            <Text style={[styles.logoutText, { color: colors.muted }]}>Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setName(user.name);
            setNameError(undefined);
            setEditingName(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={[styles.logout, styles.editName]}
        >
          <Ionicons name="create-outline" size={20} color={colors.primary} />
          <Text style={[styles.logoutText, { color: colors.primary }]}>Editar nombre</Text>
        </Pressable>
      )}

      <Text style={styles.groupLabel}>Apariencia</Text>
      <AppearancePicker />

      <Text style={styles.groupLabel}>Cuenta</Text>
      <Pressable
        onPress={() => rootNavigation.navigate('Delegate')}
        hitSlop={8}
        accessibilityRole="button"
        style={styles.logout}
      >
        <Ionicons name="key-outline" size={20} color={colors.primary} />
        <Text style={[styles.logoutText, { color: colors.primary }]}>Tengo un código de acceso</Text>
      </Pressable>
      <Pressable onPress={logout} hitSlop={8} accessibilityRole="button" style={styles.logout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 32 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: {
    flex: 1,
    height: 104,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionFeatured: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  actionPurple: { backgroundColor: colors.peopleAction },
  actionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.softText },
  actionLabelPeople: { color: colors.onPeopleAction },
  actionLabelFeatured: { color: colors.white },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 16,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  rowLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowValue: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  groupLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: 24, marginBottom: 10 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  editName: { marginTop: 16 },
  nameForm: { marginTop: 16, gap: 8 },
  logoutText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
}));
