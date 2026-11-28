import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { DateField } from '../components/DateField';
import { ChoiceChips, DeleteButton, FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { TimeField } from '../components/TimeField';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../hooks/useToast';
import { deleteMedicationSchedule, getMedicationSchedule, saveMedicationSchedule } from '../services/api';
import { syncDoseReminders } from '../services/doseReminders';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { DayOfWeek, HomeStackParamList, MedicationSchedule, MedicationScheduleInput } from '../types';
import { parseTime, TIME_ERROR, timePartsOf, toApiTime, type TimeParts } from '../utils/calendar';
import { confirmAction } from '../utils/confirm';
import { datePartsOf, parseDateParts, type DateParts } from '../utils/dates';
import { formatDate, formatTime } from '../utils/format';
import { describeDays, FREQUENCY_PRESETS, todayInLima, WEEK_DAYS } from '../utils/medicationSchedule';

type Props = NativeStackScreenProps<HomeStackParamList, 'MedicationSchedule'>;

const MAX_TIMES = 8;
const EMPTY_DATE: DateParts = { day: '', month: '', year: '' };
const DATE_RULES = { allowFuture: true, maxYearsAhead: 2 };

/** Horario de un medicamento: lo muestra y permite agregarlo, cambiarlo o quitarlo. */
export function MedicationScheduleScreen({ route }: Props) {
  const { subjectId, entryId, medication } = route.params;
  const schedule = useFetch(() => getMedicationSchedule(subjectId, entryId), [subjectId, entryId]);
  const [saved, setSaved] = useState<MedicationSchedule | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const styles = useStyles();
  const current = saved !== undefined ? saved : schedule.data;

  if (schedule.loading && current === undefined) return <LoadingView />;
  if (current === undefined || (schedule.error && saved === undefined && !schedule.data)) {
    return (
      <FormScroll contentContainerStyle={formStyles.container}>
        <StatusMessage message={schedule.error ?? 'No pudimos abrir el horario.'} />
      </FormScroll>
    );
  }

  if (editing || !current) {
    return editing ? (
      <ScheduleForm
        medication={medication}
        initial={current}
        onCancel={() => setEditing(false)}
        onSaved={(result) => {
          setSaved(result);
          setEditing(false);
          toast('Horario guardado. Ya aparece en la agenda del inicio.');
          if (user) void syncDoseReminders(user.id);
        }}
        save={(input) => saveMedicationSchedule(subjectId, entryId, input)}
      />
    ) : (
      <FormScroll contentContainerStyle={formStyles.container}>
        <FormCard title={medication}>
          <Text style={styles.text}>
            Agrega las horas en que se toma, según la receta, para verlo en la agenda del inicio y recibir avisos en este celular.
          </Text>
          <Button mode="contained" icon="alarm-plus" onPress={() => setEditing(true)}>
            Agregar horario
          </Button>
        </FormCard>
      </FormScroll>
    );
  }

  async function remove() {
    const ok = await confirmAction(
      '¿Quitar el horario?',
      'El medicamento sigue registrado, pero sale de la agenda y se borran las tomas marcadas.',
      'Quitar',
    );
    if (!ok) return;
    try {
      await deleteMedicationSchedule(subjectId, entryId);
      setSaved(null);
      toast('Horario quitado.');
      if (user) void syncDoseReminders(user.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No pudimos quitar el horario.');
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <FormCard title={medication}>
        <View style={styles.times}>
          {current.times.map((time) => (
            <View key={time} style={styles.timePill}>
              <Text style={styles.timeText}>{formatTime(time)}</Text>
            </View>
          ))}
        </View>
        <Fact label="Días" value={describeDays(current.daysOfWeek)} />
        <Fact label="Desde" value={formatDate(current.startDate)} />
        <Fact label="Hasta" value={current.endDate ? formatDate(current.endDate) : 'Sin fecha de fin'} />
      </FormCard>
      <SubmitButton label="Cambiar horario" icon="pencil" onPress={() => setEditing(true)} />
      <DeleteButton label="Quitar horario" onPress={() => void remove()} />
    </FormScroll>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.text}>{value}</Text>
    </View>
  );
}

const shortOf = (parts: TimeParts) => {
  const time = parseTime(parts);
  return time ? toApiTime(time) : null;
};

function presetFor(times: TimeParts[]) {
  const values = times.map(shortOf);
  return FREQUENCY_PRESETS.find((p) => p.times.length === values.length && p.times.every((t, i) => t === values[i]))?.id ?? 'custom';
}

function ScheduleForm({
  medication,
  initial,
  onCancel,
  onSaved,
  save,
}: {
  medication: string;
  initial: MedicationSchedule | null;
  onCancel: () => void;
  onSaved: (schedule: MedicationSchedule) => void;
  save: (input: MedicationScheduleInput) => Promise<MedicationSchedule>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [times, setTimes] = useState<TimeParts[]>(
    initial ? initial.times.map(timePartsOf) : [timePartsOf('08:00')],
  );
  const [preset, setPreset] = useState<string>(presetFor(times));
  const [someDays, setSomeDays] = useState((initial?.daysOfWeek.length ?? 0) > 0);
  const [days, setDays] = useState<DayOfWeek[]>(initial?.daysOfWeek ?? []);
  const startInitial = datePartsOf(initial?.startDate ?? todayInLima());
  const [start, setStart] = useState<DateParts>(startInitial);
  const endInitial = initial?.endDate ? datePartsOf(initial.endDate) : undefined;
  const [end, setEnd] = useState<DateParts>(endInitial ?? EMPTY_DATE);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = parseDateParts(start, { allowFuture: true, maxYearsAhead: 2 });
  const endDate = parseDateParts(end, { ...DATE_RULES, notBefore: startDate.iso || undefined });
  const timeValues = times.map(shortOf);
  const badTime = timeValues.some((t) => t === null);

  function choosePreset(id: string) {
    setPreset(id);
    const found = FREQUENCY_PRESETS.find((p) => p.id === id);
    if (found) setTimes(found.times.map(timePartsOf));
  }

  function changeTimes(next: TimeParts[]) {
    setTimes(next);
    setPreset(presetFor(next));
  }

  async function submit() {
    setSubmitted(true);
    if (badTime || !startDate.iso || (someDays && days.length === 0) || endDate.error) return;
    setSaving(true);
    setError(null);
    try {
      const result = await save({
        times: [...new Set(timeValues as string[])].sort(),
        daysOfWeek: someDays ? days : [],
        startDate: startDate.iso,
        endDate: endDate.iso || null,
      });
      onSaved(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos guardar el horario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error} />
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={20} color={colors.accentText} />
        <Text style={styles.noticeText}>
          Copia las horas tal como dice la receta de {medication} o como te indicó el médico. Yuyay no cambia ni sugiere dosis.
        </Text>
      </View>

      <FormCard title="¿Cada cuánto se toma?">
        <ChoiceChips
          options={[...FREQUENCY_PRESETS.map((p) => ({ value: p.id as string, label: p.label })), { value: 'custom', label: 'Otro horario' }]}
          selected={[preset]}
          onToggle={choosePreset}
        />
      </FormCard>

      <FormCard title="Horas de cada toma">
        {times.map((time, index) => (
          <View key={index} style={styles.timeRow}>
            <View style={styles.flex}>
              <TimeField
                label={`Toma ${index + 1}`}
                value={time}
                onChange={(value) => changeTimes(times.map((t, i) => (i === index ? value : t)))}
                error={submitted && !timeValues[index] ? TIME_ERROR : undefined}
              />
            </View>
            {times.length > 1 ? (
              <Pressable
                onPress={() => changeTimes(times.filter((_, i) => i !== index))}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={`Quitar la toma ${index + 1}`}
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {times.length < MAX_TIMES ? (
          <Button mode="text" icon="plus" onPress={() => changeTimes([...times, timePartsOf('12:00')])}>
            Agregar hora
          </Button>
        ) : null}
      </FormCard>

      <FormCard title="¿Qué días?">
        <ChoiceChips
          options={[
            { value: 'all', label: 'Todos los días' },
            { value: 'some', label: 'Algunos días' },
          ]}
          selected={[someDays ? 'some' : 'all']}
          onToggle={(value) => setSomeDays(value === 'some')}
        />
        {someDays ? (
          <ChoiceChips
            options={WEEK_DAYS.map((d) => ({ value: d.value, label: d.short }))}
            selected={days}
            onToggle={(value) => setDays(days.includes(value) ? days.filter((d) => d !== value) : [...days, value])}
          />
        ) : null}
        {submitted && someDays && days.length === 0 ? <Text style={styles.error}>Elige al menos un día.</Text> : null}
      </FormCard>

      <FormCard title="Fechas">
        <DateField
          label="Desde"
          initial={startInitial}
          onChange={setStart}
          rules={{ allowFuture: true, maxYearsAhead: 2 }}
          error={submitted && !startDate.iso ? (startDate.error ?? 'Indica desde cuándo se toma.') : undefined}
        />
        <DateField
          label="Hasta (opcional)"
          initial={endInitial}
          onChange={setEnd}
          rules={{ ...DATE_RULES, notBefore: startDate.iso || undefined }}
          error={submitted ? endDate.error : undefined}
        />
        <Text style={styles.hint}>Déjalo vacío si es un tratamiento continuo.</Text>
      </FormCard>

      <SubmitButton label="Guardar horario" onPress={() => void submit()} loading={saving} />
      <Button mode="text" onPress={onCancel} disabled={saving}>
        Cancelar
      </Button>
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  factLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timePill: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  timeText: { fontFamily: fonts.display, fontSize: 15, color: colors.primary },
  notice: { flexDirection: 'row', gap: 8, backgroundColor: colors.accentTint, borderRadius: radius.md, padding: 12 },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.accentText },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  remove: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
