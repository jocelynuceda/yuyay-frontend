import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getNotifications, markNotificationRead } from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { Notification, NotificationType } from '../types';
import { timeAgo } from '../utils/format';

const typeStyle: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string }> = {
  ENTRY_CHANGED: { icon: 'create-outline', bg: colors.soft, fg: colors.primary },
  INVITATION: { icon: 'people-outline', bg: colors.soft, fg: colors.softText },
  DELEGATION: { icon: 'link-outline', bg: colors.accentTint, fg: colors.accentText },
};

type Filter = 'all' | 'unread';

export function NotificationsScreen() {
  const notifications = useFetch(getNotifications);
  const [filter, setFilter] = useState<Filter>('all');
  useRefreshOnFocus(notifications.reload);

  async function handlePress(item: Notification) {
    if (item.read) return;
    await markNotificationRead(item.id).catch(() => {});
    notifications.reload();
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  header: { gap: 12, marginBottom: 6 },
  segment: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  segmentTextActive: { color: colors.white },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  unread: { backgroundColor: colors.white, ...shadow, shadowOpacity: 0.06, elevation: 2 },
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
});
