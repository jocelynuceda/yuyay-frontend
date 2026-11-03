import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HealthEntryCard } from '../components/HealthEntryCard';
import { LoadingView } from '../components/LoadingView';
import { PillAction, ProfileCard } from '../components/ProfileCard';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareRelationships, getCareSubject, getHealthCategories, getHealthEntries } from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { HomeStackParamList } from '../types';
import { categoryMeta, fallbackCategory } from '../utils/categories';
import { ageFrom, careRoleLabel, formatDate, initialsOf } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'SubjectDetail'>;

type QuickAction = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

export function SubjectDetailScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  // Categorías desplegadas en el perfil clínico (se pueden abrir varias)
  const [open, setOpen] = useState<Set<string>>(new Set());

  const subject = useFetch(() => getCareSubject(subjectId), [subjectId]);
  const categories = useFetch(getHealthCategories);
  // Se traen todos los registros una vez: los contadores y el filtro por categoría se calculan aquí
  const entries = useFetch(() => getHealthEntries(subjectId), [subjectId]);
  const relationships = useFetch(() => getCareRelationships(subjectId), [subjectId]);
  useRefreshOnFocus(entries.reload);

  if (subject.loading && !subject.data) return <LoadingView />;
  if (!subject.data) return <StatusMessage message={subject.error ?? 'No encontramos a esta persona.'} />;

  const s = subject.data;
  const age = ageFrom(s.birthDate);
  const all = entries.data ?? [];
  const entriesOf = (code: string) => all.filter((e) => e.categoryCode === code);
  const caregivers = relationships.data?.filter((r) => r.status === 'ACTIVE').length;
  const isPrincipal = s.myRole === 'PRINCIPAL';

  const quickActions: QuickAction[] = [
    { icon: 'calendar-outline', label: 'Citas', onPress: () => navigation.navigate('Consultations', { subjectId, isPrincipal }) },
    { icon: 'people-outline', label: 'Cuidadores', onPress: () => navigation.navigate('Caregivers', { subjectId, isPrincipal }) },
    { icon: 'clipboard-outline', label: 'Resumen', onPress: () => navigation.navigate('Handoffs', { subjectId }) },
    { icon: 'key-outline', label: 'Delegar', onPress: () => navigation.navigate('Delegations', { subjectId, isPrincipal }) },
    { icon: 'location-outline', label: 'Clínicas', onPress: () => navigation.navigate('NearbyClinics') },
  ];

  function toggle(code: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={entries.refreshing}
          onRefresh={() => {
            entries.refresh();
            relationships.reload();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <ProfileCard
        name={s.name}
        subtitle={s.birthDate ? `Nació el ${formatDate(s.birthDate)}` : 'Fecha de nacimiento no registrada'}
        initials={initialsOf(s.name)}
        chip={careRoleLabel[s.myRole]}
        stats={[
          { icon: 'calendar-outline', value: age !== null ? String(age) : '–', label: 'Años' },
          { icon: 'document-text-outline', value: entries.data ? String(all.length) : '–', label: 'Registros' },
          { icon: 'people-outline', value: caregivers !== undefined ? String(caregivers) : '–', label: 'Cuidadores' },
        ]}
      >
        {s.notes ? (
          <View style={styles.notes}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.softText} />
            <Text style={styles.notesText}>{s.notes}</Text>
          </View>
        ) : null}
        <View style={styles.cta}>
          <PillAction label="Nuevo registro" onPress={() => navigation.navigate('NewEntry', { subjectId })} />
        </View>
      </ProfileCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
        {quickActions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            style={({ pressed }) => [styles.quickItem, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <View style={styles.quickIcon}>
              <Ionicons name={a.icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View>
        <Text style={styles.section}>Perfil clínico</Text>
        <View style={styles.clinical}>
          {(categories.data ?? []).map((c, i) => {
            const meta = categoryMeta[c.code] ?? fallbackCategory;
            const expanded = open.has(c.code);
            const items = entriesOf(c.code);
            return (
              <View key={c.code} style={[i > 0 && styles.rowDivider]}>
                <Pressable
                  onPress={() => toggle(c.code)}
                  style={[styles.row, expanded && styles.rowActive]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${meta.plural}, ${items.length} registros`}
                >
                  <View style={[styles.rowIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.fg} />
                  </View>
                  <Text style={styles.rowLabel}>{meta.plural}</Text>
                  {items.length > 0 ? (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{items.length}</Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={expanded ? colors.primary : colors.muted}
                  />
                </Pressable>

                {expanded ? (
                  <View style={styles.panel}>
                    {items.length === 0 ? (
                      <Text style={styles.panelEmpty}>Aún no hay {meta.plural.toLowerCase()} registradas.</Text>
                    ) : (
                      items.map((entry) => <HealthEntryCard key={entry.id} entry={entry} />)
                    )}
                    <Pressable
                      onPress={() => navigation.navigate('NewEntry', { subjectId, categoryCode: c.code })}
                      style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                    >
                      <Ionicons name="add-circle" size={20} color={meta.fg} />
                      <Text style={[styles.addText, { color: meta.fg }]}>Agregar {c.name.toLowerCase()}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <StatusMessage message={entries.error} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40 },
  notes: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 12,
  },
  notesText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  cta: { marginTop: 14 },
  quick: { gap: 10, paddingTop: 16, paddingBottom: 2 },
  quickItem: {
    width: 76,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 12,
    ...shadow,
    shadowOpacity: 0.05,
    elevation: 1,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  section: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 18, marginBottom: 10 },
  clinical: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowActive: { backgroundColor: colors.surface, borderRadius: radius.md },
  rowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  count: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  countText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  panel: { paddingHorizontal: 4, paddingTop: 10, paddingBottom: 12 },
  panelEmpty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 10 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingVertical: 12,
  },
  addText: { fontFamily: fonts.semibold, fontSize: 14 },
});
