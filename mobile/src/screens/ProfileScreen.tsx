import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileCard } from '../components/ProfileCard';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareSubjects, getNotifications } from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { TabNavigatorParamList } from '../types';
import { formatDate, initialsOf } from '../utils/format';

type Props = BottomTabScreenProps<TabNavigatorParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const subjects = useFetch(getCareSubjects);
  const notifications = useFetch(getNotifications);
  useRefreshOnFocus(() => {
    subjects.reload();
    notifications.reload();
  });
  if (!user) return null;

  const unread = notifications.data?.filter((n) => !n.read).length;
  const memberYear = new Date(user.createdAt).getFullYear();

  const actions: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; featured?: boolean }[] = [
    { icon: 'people', label: 'Personas', onPress: () => navigation.navigate('HomeTab', { screen: 'Home' }) },
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
      <ProfileCard
        name={user.name}
        subtitle={user.email}
        initials={initialsOf(user.name)}
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
            style={({ pressed }) => [styles.action, a.featured && styles.actionFeatured, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Ionicons name={a.icon} size={30} color={a.featured ? colors.white : colors.accentText} />
            <Text style={[styles.actionLabel, a.featured && styles.actionLabelFeatured]}>{a.label}</Text>
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

      <Text style={styles.groupLabel}>Cuenta</Text>
      <Pressable onPress={logout} hitSlop={8} accessibilityRole="button" style={styles.logout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  actionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.accentText },
  actionLabelFeatured: { color: colors.white },
  card: {
    backgroundColor: colors.white,
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
    backgroundColor: colors.white,
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
  logoutText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
});
