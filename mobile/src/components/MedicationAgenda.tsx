import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getMedicationAgenda, markDose, unmarkDose } from '../services/api';
import {
  disableDoseReminders,
  doseRemindersSupported,
  enableDoseReminders,
  syncDoseReminders,
  useDoseRemindersEnabled,
  useDoseRemindersUntil,
} from '../services/doseReminders';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { AgendaDose, DoseStatus } from '../types';
import { formatTime } from '../utils/format';
import {
  addDays,
  doseState,
  groupByPartOfDay,
  todayInLima,
  isTaken,
  matchesWho,
  PART_OF_DAY_LABELS,
  peopleIn,
  shortTime,
  startOfWeek,
  STATUS_LABELS,
  WEEK_DAYS,
  type DoseState,
  type Who,
} from '../utils/medicationSchedule';
import { StatusMessage } from './StatusMessage';
import { useFetch } from '../hooks/useFetch';

const weekdayDate = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
// La hora de las tomas es de Lima (ver utils/medicationSchedule)
const untilFormat = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const doseKey = (dose: Pick<AgendaDose, 'scheduleId' | 'date' | 'time'>) => `${dose.scheduleId}|${dose.date}|${dose.time}`;

/**
 * Agenda de tomas del inicio, igual que en la web: filtro por persona («Yo» y quienes cuido), la semana
 * con un punto por día con tomas y la lista del día por mañana, tarde y noche. Una toma se marca desde
 * 2 h antes hasta 30 min después; luego cuenta como no tomada y solo se marca «se tomó tarde».
 */
export function MedicationAgenda({
  refreshKey,
  accessible,
  onOpen,
}: {
  refreshKey: number;
  /** Personas a las que todavía tengo acceso: si me lo retiran, sus tomas desaparecen. null mientras carga. */
  accessible: ReadonlySet<number> | null;
  onOpen: (dose: AgendaDose) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const today = todayInLima();
  const [selected, setSelected] = useState(today);
  const weekStart = startOfWeek(selected);
  const agenda = useFetch(() => getMedicationAgenda(weekStart, addDays(weekStart, 6)), [weekStart, refreshKey]);
  // Van atados a la lectura en la que se hicieron: una lectura nueva del servidor manda sobre ellos
  const [saved, setSaved] = useState<{ source: unknown; byKey: Record<string, AgendaDose> }>({ source: null, byKey: {} });
  const changes = saved.source === agenda.data ? saved.byKey : {};
  const [busy, setBusy] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Who>('all');
  const remindersOn = useDoseRemindersEnabled();
  const remindersUntil = useDoseRemindersUntil();
  const [togglingReminders, setTogglingReminders] = useState(false);

  const allDoses = accessible
    ? (agenda.data ?? []).filter((dose) => accessible.has(dose.careSubjectId)).map((dose) => changes[doseKey(dose)] ?? dose)
    : [];
  const people = peopleIn(allDoses);
  const who = people.some((person) => person.id === chosen) ? chosen : 'all';
  const doses = allDoses.filter((dose) => matchesWho(dose, who));
  const ofDay = doses.filter((dose) => dose.date === selected);
  const taken = ofDay.filter(isTaken).length;
  const now = new Date();

  async function setStatus(dose: AgendaDose, status: DoseStatus | null) {
    const key = doseKey(dose);
    setBusy(key);
    try {
      const updated = status
        ? await markDose(dose.scheduleId, { date: dose.date, time: shortTime(dose.time), status })
        : (await unmarkDose(dose.scheduleId, dose.date, shortTime(dose.time)),
          { ...dose, status: null, markedByName: null, markedAt: null });
      setSaved((current) => ({
        source: agenda.data,
        byKey: { ...(current.source === agenda.data ? current.byKey : {}), [key]: { ...updated, time: dose.time } },
      }));
      // La toma marcada ya no necesita sonar en este celular
      if (user) void syncDoseReminders(user.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No pudimos marcar la toma.');
    } finally {
      setBusy(null);
    }
  }

  async function toggleReminders() {
    if (!user) return;
    setTogglingReminders(true);
    try {
      if (remindersOn) {
        await disableDoseReminders();
        toast('Ya no te avisaremos de las tomas en este celular.');
      } else if ((await enableDoseReminders(user.id)) === 'enabled') {
        toast('Te avisaremos a la hora de cada toma en este celular.');
      } else {
        toast('Sin permiso de notificaciones no podemos avisarte.');
      }
    } finally {
      setTogglingReminders(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">Medicamentos</Text>
          <Text style={styles.subtitle}>
            {selected === today
              ? `Hoy, ${weekdayDate.format(new Date(`${selected}T12:00:00`))}`
              : capitalize(weekdayDate.format(new Date(`${selected}T12:00:00`)))}
          </Text>
        </View>
        {ofDay.length > 0 ? (
          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {taken} de {ofDay.length} {ofDay.length === 1 ? 'tomada' : 'tomadas'}
          </Text>
        ) : null}
      </View>

      {people.length > 1 ? (
        <View style={styles.chips} accessibilityLabel="De quién son las tomas">
          {[{ id: 'all' as Who, label: 'Todas' }, ...people].map((option) => {
            const active = who === option.id;
            return (
              <Pressable
                key={String(option.id)}
                onPress={() => setChosen(option.id)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.week}>
        <Pressable onPress={() => setSelected(addDays(weekStart, -7))} style={styles.arrow} accessibilityLabel="Semana anterior">
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        {WEEK_DAYS.map((day, index) => {
          const date = addDays(weekStart, index);
          const dayDoses = doses.filter((dose) => dose.date === date);
          const done = dayDoses.length > 0 && dayDoses.every(isTaken);
          const active = date === selected;
          return (
            <Pressable
              key={date}
              onPress={() => setSelected(date)}
              style={[styles.day, active && styles.dayActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${day.long} ${Number(date.slice(8))}${date === today ? ', hoy' : ''}: ${
                dayDoses.length === 0 ? 'sin tomas' : done ? 'todas tomadas' : `${dayDoses.length} tomas`
              }`}
            >
              <Text style={[styles.dayShort, active && styles.onPrimary]}>{day.short}</Text>
              <Text style={[styles.dayNumber, active && styles.onPrimary, date === today && !active && { color: colors.primary }]}>
                {Number(date.slice(8))}
              </Text>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dayDoses.length === 0 ? 'transparent' : active ? colors.white : done ? colors.accent : colors.primary },
                ]}
              />
            </Pressable>
          );
        })}
        <Pressable onPress={() => setSelected(addDays(weekStart, 7))} style={styles.arrow} accessibilityLabel="Semana siguiente">
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <Text style={styles.hint}>Marca cada toma desde 2 horas antes hasta 30 minutos después. Si nadie la marca, queda como no tomada.</Text>

      <StatusMessage message={agenda.data ? null : agenda.error} />
      {(!agenda.data && agenda.loading) || !accessible ? <ActivityIndicator color={colors.primary} /> : null}
      {agenda.data && accessible && ofDay.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No hay tomas para este día.</Text>
          <Text style={styles.emptyText}>
            {allDoses.length === 0
              ? 'Abre un medicamento en la ficha de una persona y toca «Horario» para agregar sus horas.'
              : 'Elige otro día de la semana.'}
          </Text>
        </View>
      ) : null}

      {groupByPartOfDay(ofDay).map(({ part, doses: group }) => (
        <View key={part} style={styles.group}>
          <Text style={styles.part}>{PART_OF_DAY_LABELS[part]}</Text>
          {group.map((dose) => (
            <DoseRow
              key={doseKey(dose)}
              dose={dose}
              state={doseState(dose, now)}
              busy={busy === doseKey(dose)}
              onStatus={(status) => void setStatus(dose, status)}
              onOpen={() => onOpen(dose)}
            />
          ))}
        </View>
      ))}

      {doseRemindersSupported && allDoses.length > 0 ? (
        <Pressable
          onPress={() => void toggleReminders()}
          disabled={togglingReminders}
          style={styles.reminders}
          accessibilityRole="switch"
          accessibilityState={{ checked: remindersOn, busy: togglingReminders }}
        >
          <Ionicons name={remindersOn ? 'notifications' : 'notifications-off-outline'} size={20} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.remindersTitle}>{remindersOn ? 'Te avisamos de cada toma' : 'Avisarme de cada toma'}</Text>
            <Text style={styles.remindersText}>
              {remindersOn
                ? remindersUntil
                  ? `Programados hasta el ${untilFormat.format(remindersUntil)}. Abre Yuyay antes de esa fecha para renovarlos. Toca para desactivar.`
                  : 'En este celular, con los botones «Tomada» y «Posponer». Toca para desactivar.'
                : 'Una notificación en este celular a la hora de cada toma.'}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function DoseRow({
  dose,
  state,
  busy,
  onStatus,
  onOpen,
}: {
  dose: AgendaDose;
  state: DoseState;
  busy: boolean;
  onStatus: (status: DoseStatus | null) => void;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const time = formatTime(dose.time);
  const what = `${dose.medication} de las ${time}`;
  return (
    <View style={styles.row}>
      <Pressable onPress={onOpen} style={styles.rowMain} accessibilityRole="button" accessibilityLabel={`${what}, ${dose.mine ? 'para mí' : `para ${dose.careSubjectName}`}`}>
        <Text style={styles.time}>{time}</Text>
        <View style={styles.flex}>
          <Text style={styles.medication} numberOfLines={2}>
            {dose.medication}
            {dose.dose ? <Text style={styles.doseText}> · {dose.dose}</Text> : null}
          </Text>
          <Text style={styles.forWhom}>
            {dose.mine ? 'Para mí' : `Para ${dose.careSubjectName}`}
            {state === 'due' ? <Text style={{ color: colors.primary, fontFamily: fonts.semibold }}> · Es hora</Text> : null}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : state === 'marked' ? (
          <>
            <View style={[styles.badge, dose.status === 'SKIPPED' ? styles.badgeDanger : styles.badgeOk]}>
              {dose.status !== 'SKIPPED' ? <Ionicons name="checkmark" size={14} color={colors.accentText} /> : null}
              <Text style={[styles.badgeText, { color: dose.status === 'SKIPPED' ? colors.danger : colors.accentText }]}>
                {STATUS_LABELS[dose.status ?? 'TAKEN']}
                {dose.markedByName ? ` · ${dose.markedByName.split(/\s+/)[0]}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => onStatus(null)} style={styles.link} accessibilityRole="button" accessibilityLabel={`Deshacer la marca de ${what}`}>
              <Text style={styles.linkText}>Deshacer</Text>
            </Pressable>
          </>
        ) : state === 'upcoming' ? (
          <Text style={styles.waiting}>Aún no es hora</Text>
        ) : state === 'missed' ? (
          <>
            <View style={[styles.badge, styles.badgeDanger]}>
              <Text style={[styles.badgeText, { color: colors.danger }]}>No tomada</Text>
            </View>
            <Pressable onPress={() => onStatus('LATE')} style={styles.secondary} accessibilityRole="button" accessibilityLabel={`Marcar que ${what} se tomó tarde`}>
              <Text style={styles.secondaryText}>Se tomó tarde</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={() => onStatus('TAKEN')} style={styles.primary} accessibilityRole="button" accessibilityLabel={`Marcar ${what} como tomada`}>
            <Text style={styles.primaryText}>Tomada</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, marginTop: 12, gap: 12, ...shadow, shadowOpacity: 0.06, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  counter: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.white },
  week: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm, gap: 2 },
  dayActive: { backgroundColor: colors.primary },
  dayShort: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  dayNumber: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  onPrimary: { color: colors.white },
  dot: { width: 5, height: 5, borderRadius: 3 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  empty: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 4 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  group: { gap: 8 },
  part: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, gap: 10 },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  time: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, width: 74 },
  medication: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  doseText: { fontFamily: fonts.regular, color: colors.muted },
  forWhom: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeOk: { backgroundColor: colors.accentTint },
  badgeDanger: { backgroundColor: colors.dangerBg },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12 },
  waiting: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  primary: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 8 },
  primaryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  secondary: { backgroundColor: colors.soft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.softText },
  link: { paddingHorizontal: 8, paddingVertical: 6 },
  linkText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  reminders: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: 12 },
  remindersTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  remindersText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
