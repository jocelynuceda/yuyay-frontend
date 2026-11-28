import { ConsultationSummaryScreen } from './ConsultationSummaryScreen';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CategoryIcon } from '../components/CategoryIcon';
import { ClampedText } from '../components/ClampedText';
import { ConfidenceBadge, confidenceLabel } from '../components/ConfidenceBadge';
import { EmptyState } from '../components/EmptyState';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { TextSheet } from '../components/TextSheet';
import { useFetch } from '../hooks/useFetch';
import { createHandoff, getHealthCategories, getHealthEntries } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { HealthEntry, HomeStackParamList } from '../types';
import { categoryMeta, fallbackCategory } from '../utils/categories';
import { createAttemptKey } from '../utils/attemptKey';
import { formatDate } from '../utils/format';
import { manualHandoffInput } from '../utils/manualHandoff';
import { newSummaryRequestId } from '../utils/summaryRequestId';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewHandoff'>;

export function NewHandoffScreen(props: Props) {
  return props.route.params.consultationId
    ? <ConsultationSummaryScreen {...props} />
    : <ManualHandoffScreen {...props} />;
}

function ManualHandoffScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, isPrincipal } = route.params;
  const categories = useFetch(getHealthCategories);
  const entries = useFetch(() => getHealthEntries(subjectId), [subjectId]);
  // null = todavía no se tocó: se marcan todos los registros
  const [picked, setPicked] = useState<Set<number> | null>(null);
  // Detalle completo abierto en el panel inferior
  const [reading, setReading] = useState<{ title: string; text: string } | null>(null);
  const [reason, setReason] = useState('');
  const [questions, setQuestions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [attemptKey] = useState(() => createAttemptKey(newSummaryRequestId));

  if (entries.loading && !entries.data) return <LoadingView />;

  const all = entries.data ?? [];
  const selected = new Set(all.filter((entry) => picked === null || picked.has(entry.id)).map((entry) => entry.id));

  function toggle(ids: number[]) {
    const next = new Set(selected);
    const allOn = ids.every((id) => next.has(id));
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    setPicked(next);
  }

  const reasonError = submitted && !reason.trim() ? 'Cuenta brevemente el motivo.' : undefined;
  const pickError = submitted && selected.size === 0 ? 'Elige al menos un registro.' : undefined;

  async function handleSave() {
    setSubmitted(true);
    if (!reason.trim() || selected.size === 0 || saving || entries.loading || entries.error || categories.loading || categories.error || conflict) return;
    setSaving(true);
    setError(null);
    try {
      const input = manualHandoffInput(all, selected, reason, questions);
      const handoff = await createHandoff(subjectId, { ...input, requestId: attemptKey(input) });
      navigation.replace('HandoffView', { subjectId, handoffId: handoff.id, isPrincipal });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setPicked(new Set(selected));
        setConflict(true);
        setError('Los registros cambiaron. Recarga y revisa su contenido antes de crear el resumen.');
      } else {
        setError(e instanceof ApiError ? e.message : 'No pudimos crear el resumen.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={entries.error ?? categories.error ?? error} />

      <FormCard title="Motivo">
        <FormField
          label="¿Por qué van al médico?"
          icon="stethoscope"
          value={reason}
          onChangeText={setReason}
          maxLength={200}
          error={reasonError}
        />
      </FormCard>

      <FormCard title="Preguntas para el médico (opcional)">
        <TextArea
          value={questions}
          onChangeText={setQuestions}
          placeholder="¿Puede tomar el nuevo jarabe con sus pastillas? ¿Cada cuánto el control?"
        />
      </FormCard>

      <FormCard title={`Registros a incluir (${selected.size})`}>
        {all.length === 0 ? (
          <EmptyState title="No hay registros" description="Agrega registros de salud para poder resumirlos." />
        ) : (
          (categories.data ?? []).map((c) => {
            const items = all.filter((e) => e.categoryCode === c.code);
            if (items.length === 0) return null;
            const meta = categoryMeta[c.code] ?? fallbackCategory;
            const ids = items.map((e) => e.id);
            const allOn = ids.every((id) => selected.has(id));
            return (
              <View key={c.code} style={styles.group}>
                <Pressable onPress={() => toggle(ids)} style={styles.groupHeader} accessibilityRole="button">
                  <CategoryIcon code={c.code} size={16} style={styles.groupIcon} />
                  <Text style={styles.groupTitle}>{meta.plural}</Text>
                  <Text style={styles.groupToggle}>{allOn ? 'Quitar todos' : 'Marcar todos'}</Text>
                </Pressable>
                {items.map((e) => (
                  <EntryOption
                    key={e.id}
                    entry={e}
                    checked={selected.has(e.id)}
                    onToggle={() => toggle([e.id])}
                    onReadAll={(title, text) => setReading({ title, text })}
                  />
                ))}
              </View>
            );
          })
        )}
        {pickError ? <Text style={[formStyles.error, { color: colors.danger }]}>{pickError}</Text> : null}
      </FormCard>

      {conflict || entries.error || categories.error ? (
        <SubmitButton label="Recargar para revisar" loading={entries.loading || categories.loading} onPress={() => {
          setPicked(new Set(selected));
          setConflict(false);
          setError('Revisa los registros actualizados. Se conservaron el motivo, las preguntas y tus elecciones.');
          entries.reload();
          categories.reload();
        }} />
      ) : (
        <SubmitButton label="Crear resumen" onPress={handleSave} loading={saving || entries.loading || categories.loading} />
      )}

      <TextSheet title={reading?.title ?? ''} text={reading?.text ?? null} onClose={() => setReading(null)} />
    </FormScroll>
  );
}

/** Fila de la lista: casilla para elegir el registro y, aparte, el botón para leer todo el detalle. */
function EntryOption({ entry, checked, onToggle, onReadAll }: {
  entry: HealthEntry;
  checked: boolean;
  onToggle: () => void;
  onReadAll: (title: string, text: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Si el detalle quedó recortado en pantalla
  const [clipped, setClipped] = useState(false);
  const v = entry.latestVersion;
  const title = v.title;
  const extra = [v.details, v.notes].filter(Boolean).join('\n');
  const doseFrequency = [v.dose, v.frequency].filter(Boolean).join(' · ');
  // Etiqueta explícita: así el lector de pantalla no recita el texto largo del OCR ni la copia invisible.
  // El detalle solo se lee si se ve completo; si quedó recortado, se llega con el botón Ver todo.
  const label = [
    title,
    doseFrequency,
    confidenceLabel(v.confidenceLevel),
    v.occurredOn ? formatDate(v.occurredOn) : '',
    clipped ? '' : extra,
  ].filter(Boolean).join(', ');

  return (
    <View style={styles.item}>
      <Pressable
        onPress={onToggle}
        style={styles.itemRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={22}
          color={checked ? colors.primary : colors.muted}
          style={{ marginTop: 1 }}
        />
        <View style={formStyles.flex}>
          <Text style={styles.itemTitle}>{title}</Text>
          {doseFrequency ? <Text style={styles.itemMeta}>{doseFrequency}</Text> : null}
          <View style={{ marginTop: 4 }}>
            <ConfidenceBadge level={v.confidenceLevel} />
          </View>
          {v.occurredOn ? <Text style={styles.itemMeta}>{formatDate(v.occurredOn)}</Text> : null}
          {extra ? <ClampedText text={extra} style={styles.itemMeta} onClippedChange={setClipped} /> : null}
        </View>
      </Pressable>
      {clipped ? (
        // Fuera de la casilla: así el lector de pantalla llega al botón por separado
        <Pressable
          onPress={() => onReadAll(title, extra)}
          hitSlop={8}
          style={styles.moreButton}
          accessibilityRole="button"
          accessibilityLabel={`Ver todo el detalle de ${title}`}
        >
          <Text style={styles.more}>Ver todo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  group: { gap: 4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  groupIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  groupToggle: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  item: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // 44 = 12 de relleno + 22 del ícono + 10 de separación: alinea el botón con el texto
  moreButton: { alignSelf: 'flex-start', marginLeft: 44, marginTop: -6, paddingBottom: 10 },
  itemTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  itemMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  more: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
}));
