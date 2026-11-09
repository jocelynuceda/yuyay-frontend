import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { HealthEntryCard } from '../components/HealthEntryCard';
import { LoadingView } from '../components/LoadingView';
import { PillAction, ProfileCard } from '../components/ProfileCard';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  getCareRelationships,
  getCareSubject,
  getCareSubjects,
  getHealthCategories,
  getHealthEntries,
} from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { HomeStackParamList } from '../types';
import { categoryMeta, EXAM_CATEGORY, fallbackCategory } from '../utils/categories';
import { ageFrom, careRoleLabel, formatDate, initialsOf } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'SubjectDetail'>;

type QuickAction = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

/** Con dos o más personas a cargo, se pasa de un perfil a otro deslizando a los lados. */
export function SubjectDetailScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const { width } = useWindowDimensions();
  const [visibleId, setVisibleId] = useState(subjectId);
  const [swipeLocked, setSwipeLocked] = useState(false);
  const pager = useRef<ScrollViewInstance>(null);
  const positioned = useRef(false);
  const [pageHeight, setPageHeight] = useState<number>();
  const subjects = useFetch(getCareSubjects);
  useRefreshOnFocus(subjects.reload);

  const people = subjects.data ?? [];
  // La cabecera sigue al perfil visible, también si se le cambió el nombre
  const visibleName = people.find((p) => p.id === visibleId)?.name;
  useEffect(() => {
    if (visibleName) navigation.setOptions({ title: visibleName });
  }, [visibleName, navigation]);

  if (subjects.loading && !subjects.data) return <LoadingView />;

  const startIndex = people.findIndex((p) => p.id === subjectId);
  if (people.length < 2 || startIndex < 0) {
    return <SubjectProfile subjectId={subjectId} navigation={navigation} />;
  }

  const visibleIndex = people.findIndex((p) => p.id === visibleId);

  return (
    <View style={styles.flex}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Persona ${visibleIndex + 1} de ${people.length}. Desliza a los lados para cambiar.`}
      >
        {people.map((p, i) => (
          <View key={p.id} style={[styles.dot, i === visibleIndex && styles.dotActive]} />
        ))}
      </View>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        scrollEnabled={!swipeLocked}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onLayout={(e) => {
          setPageHeight(e.nativeEvent.layout.height);
          // Solo al abrir: después manda el dedo, aunque cambie el tamaño de la pantalla
          if (positioned.current) return;
          positioned.current = true;
          pager.current?.scrollTo({ x: startIndex * width, animated: false });
        }}
        onScroll={(e) => {
          const page = people[Math.round(e.nativeEvent.contentOffset.x / width)];
          if (page) setVisibleId(page.id);
        }}
      >
        {people.map((p, i) => (
          // Altura fija: sin ella el perfil crece con su contenido y deja de hacer scroll vertical
          <View key={p.id} style={{ width, height: pageHeight }}>
            {/* Solo se cargan el perfil visible y sus vecinos */}
            {Math.abs(i - visibleIndex) <= 1 ? (
              <SubjectProfile subjectId={p.id} navigation={navigation} onSwipeLock={setSwipeLocked} />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SubjectProfile({
  subjectId,
  navigation,
  onSwipeLock,
}: {
  subjectId: number;
  navigation: Props['navigation'];
  onSwipeLock?: (locked: boolean) => void;
}) {
  // Categorías desplegadas en el perfil clínico (se pueden abrir varias)
  const [open, setOpen] = useState<Set<string>>(new Set());

  const subject = useFetch(() => getCareSubject(subjectId), [subjectId]);
  const categories = useFetch(getHealthCategories);
  // Se traen todos los registros una vez: los contadores y el filtro por categoría se calculan aquí
  const entries = useFetch(() => getHealthEntries(subjectId), [subjectId]);
  const relationships = useFetch(() => getCareRelationships(subjectId), [subjectId]);
  useRefreshOnFocus(() => {
    entries.reload();
    subject.reload();
    relationships.reload();
  });

  if (subject.loading && !subject.data) return <LoadingView />;
  if (!subject.data) return <StatusMessage message={subject.error ?? 'No encontramos a esta persona.'} />;

  const s = subject.data;
  const age = ageFrom(s.birthDate);
  const all = entries.data ?? [];
  const entriesOf = (code: string) => all.filter((e) => e.categoryCode === code);
  const caregivers = relationships.data?.filter((r) => r.status === 'ACTIVE').length;
  const isPrincipal = s.myRole === 'PRINCIPAL';

  const quickActions: QuickAction[] = [
    { icon: 'calendar-outline', label: 'Citas', onPress: () => navigation.navigate('Consultations', { subjectId, subjectName: s.name, isPrincipal }) },
    { icon: 'people-outline', label: 'Cuidadores', onPress: () => navigation.navigate('Caregivers', { subjectId, isPrincipal }) },
    { icon: 'clipboard-outline', label: 'Resumen', onPress: () => navigation.navigate('Handoffs', { subjectId }) },
    { icon: 'key-outline', label: 'Delegar', onPress: () => navigation.navigate('Delegations', { subjectId, isPrincipal }) },
    { icon: 'document-attach-outline', label: 'Documentos', onPress: () => navigation.navigate('Documents', { subjectId }) },
    { icon: 'flask-outline', label: 'Exámenes', onPress: () => navigation.navigate('Exams', { subjectId }) },
    { icon: 'mic-outline', label: 'Notas de voz', onPress: () => navigation.navigate('VoiceNotes', { subjectId }) },
    { icon: 'location-outline', label: 'Clínicas', onPress: () => navigation.navigate('NearbyClinics') },
    // El backend reserva la bitácora al principal
    ...(isPrincipal
      ? [
          {
            icon: 'list-outline',
            label: 'Bitácora',
            onPress: () => navigation.navigate('AccessLog', { subjectId }),
          } as QuickAction,
        ]
      : []),
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
        <Pressable
          onPress={() => navigation.navigate('EditSubject', { subject: s })}
          hitSlop={6}
          style={({ pressed }) => [styles.editData, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={styles.editDataText}>Editar datos</Text>
        </Pressable>
        <View style={styles.cta}>
          <PillAction
            label="Nuevo registro"
            onPress={() => navigation.navigate('NewEntry', { subjectId })}
            onDragChange={onSwipeLock}
          />
        </View>
      </ProfileCard>

      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
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
          {(categories.data ?? []).filter((c) => c.code !== EXAM_CATEGORY).map((c, i) => {
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
                      items.map((entry) => (
                        <HealthEntryCard
                          key={entry.id}
                          entry={entry}
                          onEdit={() => navigation.navigate('EditEntry', { subjectId, entryId: entry.id })}
                          onHistory={() => navigation.navigate('EntryHistory', { subjectId, entryId: entry.id })}
                        />
                      ))
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
  flex: { flex: 1 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingTop: 4, paddingBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { width: 20, backgroundColor: colors.primary },
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
  editData: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12, marginLeft: 6 },
  editDataText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  cta: { marginTop: 14 },
  quick: { gap: 10, paddingTop: 16, paddingBottom: 2 },
  quickItem: {
    width: 84,
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
