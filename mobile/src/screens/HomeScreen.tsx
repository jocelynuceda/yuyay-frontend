import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CareSubjectCard } from '../components/CareSubjectCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { Logo } from '../components/Logo';
import { FadeIn, Floating, PressableScale } from '../components/Motion';
import { Sparkle } from '../components/Sparkle';
import { SparkleBuddy } from '../components/SparkleBuddy';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import {
  acceptInvitation,
  getCareSubjects,
  getConsultations,
  getNotifications,
  getPendingInvitations,
} from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts, gradients, heroIsDark, radius, shadow } from '../theme';
import type { CareRelationship, CareSubject, Consultation, HomeStackParamList, TabNavigatorParamList } from '../types';
import { careRoleLabel, initialsOf, todayIso } from '../utils/format';

const monthShort = new Intl.DateTimeFormat('es-PE', { month: 'short' });
const weekdayLong = new Intl.DateTimeFormat('es-PE', { weekday: 'long' });

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'Home'>,
  BottomTabScreenProps<TabNavigatorParamList>
>;

/** Próxima consulta (hoy o después) o, si no hay, la más reciente; con el nombre de la persona. */
function pickAppointment(consultations: Consultation[], subjects: CareSubject[]) {
  const today = todayIso();
  const sorted = [...consultations].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.find((c) => c.date >= today);
  const chosen = upcoming ?? sorted[sorted.length - 1];
  if (!chosen) return null;
  const subject = subjects.find((s) => s.id === chosen.careSubjectId);
  const upcomingCount = sorted.filter((c) => c.date >= today).length;
  return { consultation: chosen, subjectName: subject?.name ?? '', isUpcoming: !!upcoming, upcomingCount };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const subjects = useFetch(getCareSubjects);
  const invitations = useFetch(getPendingInvitations);
  const notifications = useFetch(getNotifications);
  const subjectIds = subjects.data?.map((s) => s.id) ?? [];
  // Consultas de todas las personas, para la tarjeta de próxima cita
  const consultations = useFetch(
    () => Promise.all(subjectIds.map((id) => getConsultations(id).catch(() => []))).then((lists) => lists.flat()),
    [subjectIds],
  );
  useRefreshOnFocus(() => {
    subjects.reload();
    invitations.reload();
    notifications.reload();
    consultations.reload();
  });

  if (subjects.loading && !subjects.data) return <LoadingView label="Abriendo tu espacio…" />;

  const firstName = user?.name.split(' ')[0] ?? '';
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0;
  const people = subjects.data ?? [];
  const appointment = pickAppointment(consultations.data ?? [], people);

  const header = (
    <View>
      {/* Banda celeste de cabecera, a todo el ancho */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.band, { marginTop: -(insets.top + 8), paddingTop: insets.top + 8 }]}
      >
        <View style={styles.topBar}>
          <View style={styles.flex}>
            <Logo light={heroIsDark} />
          </View>
          <Pressable
            onPress={() => navigation.navigate('Notifications')}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={unread ? `Avisos, ${unread} sin leer` : 'Avisos'}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {unread > 0 ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
          >
            <Text style={styles.avatarText}>{initialsOf(user?.name ?? '')}</Text>
          </Pressable>
        </View>

        <View style={styles.greetRow}>
          <View style={styles.flex}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>{firstName}</Text>
            <Text style={styles.tagline}>Tu red de cuidado, siempre al día.</Text>
          </View>
          <Floating>
            <SparkleBuddy size={96} />
          </Floating>
        </View>
      </LinearGradient>

      {/* Bento: tarjetas de distintos tamaños que aparecen escalonadas */}
      <View style={styles.bento}>
        <FadeIn delay={80} style={styles.flex}>
          <PressableScale
            onPress={() =>
              people[0] && navigation.navigate('SubjectDetail', { subjectId: people[0].id, name: people[0].name })
            }
            style={[styles.tile, styles.tileTall, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={`${people.length} personas a tu cuidado`}
          >
            <View style={styles.tileStar} pointerEvents="none">
              <Sparkle size={110} color={colors.soft} />
            </View>
            <Text style={[styles.tileLabel, { color: colors.softText }]}>Personas</Text>
            <View>
              <Text style={[styles.tileValue, { color: colors.ink }]}>{subjects.data ? people.length : '–'}</Text>
              <View style={styles.faces}>
                {people.slice(0, 3).map((p, i) => (
                  <View key={p.id} style={[styles.face, i > 0 && styles.faceOverlap]}>
                    <Text style={styles.faceText}>{initialsOf(p.name)}</Text>
                  </View>
                ))}
                {people.length > 3 ? (
                  <View style={[styles.face, styles.faceOverlap, { backgroundColor: colors.ink }]}>
                    <Text style={[styles.faceText, { color: colors.white }]}>+{people.length - 3}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </PressableScale>
        </FadeIn>

        <View style={[styles.flex, styles.bentoColumn]}>
          <FadeIn delay={160}>
            <PressableScale
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.tile, styles.tileShort, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`${unread} avisos sin leer`}
            >
              <View style={styles.tileRow}>
                <Text style={[styles.tileLabel, { color: colors.soft }]}>Avisos</Text>
                <Ionicons name="notifications" size={18} color={colors.soft} />
              </View>
              <Text style={[styles.tileValueSmall, { color: colors.white }]}>{notifications.data ? unread : '–'}</Text>
            </PressableScale>
          </FadeIn>
          <FadeIn delay={240}>
            <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.white }]}>
              <View style={styles.tileRow}>
                <Text style={[styles.tileLabel, { color: colors.muted }]}>Invitaciones</Text>
                <Ionicons name="mail-open-outline" size={18} color={colors.accentText} />
              </View>
              <Text style={[styles.tileValueSmall, { color: colors.ink }]}>
                {invitations.data ? invitations.data.length : '–'}
              </Text>
            </View>
          </FadeIn>
        </View>
      </View>

      <FadeIn delay={320}>
        <PressableScale
          onPress={() => navigation.navigate('UpcomingConsultations')}
          style={[styles.tile, styles.appointment]}
          accessibilityRole="button"
          accessibilityLabel="Ver próximas citas"
        >
          <View style={styles.dateBlock}>
            {appointment ? (
              <>
                <Text style={styles.dateDay}>{Number(appointment.consultation.date.slice(8, 10))}</Text>
                <Text style={styles.dateMonth}>
                  {monthShort.format(new Date(`${appointment.consultation.date}T12:00:00`)).replace('.', '')}
                </Text>
              </>
            ) : (
              <Ionicons name="calendar-outline" size={26} color={colors.accentText} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>
              {appointment
                ? appointment.isUpcoming
                  ? appointment.upcomingCount > 1
                    ? `Próxima cita · ${appointment.upcomingCount} en total`
                    : 'Próxima cita'
                  : 'Última consulta'
                : 'Próxima cita'}
            </Text>
            <Text style={styles.appointmentTitle} numberOfLines={1}>
              {appointment ? appointment.consultation.reason : 'Sin citas registradas'}
            </Text>
            <Text style={styles.appointmentMeta} numberOfLines={1}>
              {appointment
                ? `${appointment.subjectName} · ${weekdayLong.format(new Date(`${appointment.consultation.date}T12:00:00`))}`
                : 'Anótalas en el perfil de cada uno'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </PressableScale>
      </FadeIn>

      {invitations.data && invitations.data.length > 0 ? (
        <Invitations
          items={invitations.data}
          onAccepted={() => {
            invitations.reload();
            subjects.reload();
          }}
        />
      ) : null}

      <StatusMessage message={subjects.error} />
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Personas a tu cuidado</Text>
        {subjects.data?.length ? (
          <View style={styles.countChip}>
            <Text style={styles.countText}>{subjects.data.length}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.flex}
      data={subjects.data ?? []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item, index }) => (
        <FadeIn delay={380 + index * 70}>
          <CareSubjectCard
            subject={item}
            index={index}
            onPress={() =>
              navigation.navigate('SubjectDetail', {
                subjectId: item.id,
                name: item.name,
              })
            }
          />
        </FadeIn>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        subjects.error ? undefined : (
          <EmptyState
            title="Aún no registras a nadie"
            description="Agrega a la persona que cuidas para anotar su medicación, alergias y consultas."
            action={
              <Button mode="contained" icon="plus" onPress={() => navigation.navigate('NewSubject')}>
                Agregar persona
              </Button>
            }
          />
        )
      }
      contentContainerStyle={[styles.list, { paddingTop: insets.top + 8 }]}
      refreshControl={
        <RefreshControl
          refreshing={subjects.refreshing}
          onRefresh={() => {
            subjects.refresh();
            invitations.reload();
            notifications.reload();
            consultations.reload();
          }}
          tintColor={colors.primary}
        />
      }
    />
  );
}

function Invitations({ items, onAccepted }: { items: CareRelationship[]; onAccepted: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await acceptInvitation(id);
      onAccepted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo aceptar.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.invitations}>
      <View style={styles.invitationsHeader}>
        <Sparkle size={18} color={colors.accent} />
        <Text style={styles.invitationsTitle}>Te invitaron a cuidar</Text>
      </View>
      <StatusMessage message={error} />
      {items.map((r) => (
        <View key={r.id} style={styles.invitation}>
          <View style={styles.flex}>
            <Text style={styles.invitationName}>{r.careSubjectName}</Text>
            <Text style={styles.invitationMeta}>
              Como {careRoleLabel[r.role].toLowerCase()}
              {r.relationshipLabel ? ` · ${r.relationshipLabel}` : ''}
            </Text>
          </View>
          <Button
            mode="contained"
            compact
            loading={busyId === r.id}
            onPress={() => accept(r.id)}
            style={styles.acceptButton}
          >
            Aceptar
          </Button>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unreadDot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 16, color: colors.softText },
  greeting: {
    fontFamily: fonts.regular,
    fontSize: 30,
    color: colors.onHero,
    lineHeight: 36,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    color: colors.onHero,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onHeroSoft,
    marginTop: 6,
  },
  band: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  greetRow: { flexDirection: 'row', alignItems: 'center' },
  bento: { flexDirection: 'row', gap: 12, marginTop: 18 },
  bentoColumn: { gap: 12 },
  tile: { borderRadius: radius.lg, padding: 16, overflow: 'hidden', ...shadow, shadowOpacity: 0.06, elevation: 2 },
  tileTall: { height: 196, justifyContent: 'space-between' },
  tileShort: { height: 92, justifyContent: 'space-between' },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileStar: { position: 'absolute', right: -24, top: -20, opacity: 0.8 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 13 },
  tileValue: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52 },
  tileValueSmall: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  faces: { flexDirection: 'row', marginTop: 6 },
  face: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOverlap: { marginLeft: -8 },
  faceText: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  appointment: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, marginTop: 12 },
  dateBlock: {
    width: 60,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: colors.ink },
  dateMonth: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, textTransform: 'capitalize' },
  appointmentTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, marginTop: 2 },
  appointmentMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    textTransform: 'none',
  },
  invitations: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 16,
    gap: 10,
    ...shadow,
    shadowOpacity: 0.06,
  },
  invitationsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  invitationsTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  invitation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
  },
  invitationName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  invitationMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  acceptButton: { borderRadius: radius.pill },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 12,
  },
  section: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  countChip: {
    backgroundColor: colors.soft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.softText,
  },
});
