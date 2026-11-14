import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareSubjects, getNotifications, getPendingInvitations, markNotificationRead } from '../services/api';
import { fonts, makeStyles, radius, useTheme, type Colors } from '../theme';
import type { Notification, NotificationType, TabNavigatorParamList } from '../types';
import { notificationTarget } from '../utils/notificationTarget';
import { timeAgo } from '../utils/format';

const typeStyleFor = (colors: Colors): Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> => ({
  ENTRY_CHANGED: { icon: 'create-outline', bg: colors.soft, fg: colors.softText },
  INVITATION: { icon: 'people-outline', bg: colors.soft, fg: colors.softText },
  DELEGATION: { icon: 'link-outline', bg: colors.accentTint, fg: colors.accentText },
  CAREGIVER_JOINED: { icon: 'person-add-outline', bg: colors.accentTint, fg: colors.accentText },
});

type Filter = 'all' | 'unread';

export function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<TabNavigatorParamList>>();
  const notifications = useFetch(getNotifications);
  const pending = useFetch(getPendingInvitations);
  const subjects = useFetch(getCareSubjects);
  const [filter, setFilter] = useState<Filter>('all');
  useRefreshOnFocus(() => {
    notifications.reload();
    pending.reload();
    subjects.reload();
  });

  // Como en la web: tocar un aviso lo marca como leído y lleva a lo que menciona
  async function handlePress(item: Notification) {
    if (!item.read) {
      await markNotificationRead(item.id).catch(() => {});
      notifications.reload();
    }
    const pendingIds = new Set((pending.data ?? []).map((rel) => rel.careSubjectId));
    const target = notificationTarget(item, pendingIds, subjects.data ?? []);
    if (!target) return;
    if (target.screen === 'Home') navigation.navigate('HomeTab', { screen: 'Home' });
    else navigation.navigate('HomeTab', { screen: target.screen, params: target.params } as never);
  }

  if (notifications.loading && !notifications.data) return <LoadingView />;

  const all = notifications.data ?? [];
  const unreadCount = all.filter((n) => !n.read).length;
  const items = filter === 'unread' ? all.filter((n) => !n.read) : all;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.segment} accessibilityRole="tablist">
            <SegmentItem label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
            <SegmentItem
              label={unreadCount ? `Sin leer · ${unreadCount}` : 'Sin leer'}
              active={filter === 'unread'}
              onPress={() => setFilter('unread')}
            />
          </View>
          <StatusMessage message={notifications.error} />
        </View>
      }
      ListEmptyComponent={
        notifications.error ? undefined : (
          <EmptyState
            title={filter === 'unread' ? 'Todo al día' : 'Sin notificaciones'}
            description={
              filter === 'unread'
                ? 'No tienes avisos pendientes por leer.'
                : 'Te avisaremos cuando otro cuidador registre algo.'
            }
          />
        )
      }
      refreshControl={
        <RefreshControl refreshing={notifications.refreshing} onRefresh={notifications.refresh} tintColor={colors.primary} />
      }
      renderItem={({ item }) => {
        const typeStyle = typeStyleFor(colors);
        const style = typeStyle[item.type] ?? typeStyle.ENTRY_CHANGED;
        return (
          <TouchableOpacity
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
            style={[styles.item, !item.read && styles.unread]}
          >
            <View style={[styles.icon, { backgroundColor: style.bg }]}>
              <Ionicons name={style.icon} size={22} color={style.fg} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.title, !item.read && styles.bold]}>{item.title}</Text>
              {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
              <View style={styles.timeChip}>
                <Ionicons name="time-outline" size={12} color={colors.muted} />
                <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
          </TouchableOpacity>
        );
      }}
    />
  );
}

function SegmentItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentItem, active && styles.segmentActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  header: { gap: 12, marginBottom: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  segmentTextActive: { color: colors.white },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
  },
  unread: { backgroundColor: colors.card, ...shadow, shadowOpacity: 0.06, elevation: 2 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  bold: { fontFamily: fonts.bold },
  body: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  time: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginTop: 4 },
}));
