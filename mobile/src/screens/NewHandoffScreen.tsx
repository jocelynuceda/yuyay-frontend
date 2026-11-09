import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { FormCard, formStyles, SubmitButton, TextArea } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { createHandoff, getHealthCategories, getHealthEntries } from '../services/api';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { categoryMeta, fallbackCategory } from '../utils/categories';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewHandoff'>;

export function NewHandoffScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId } = route.params;
  const categories = useFetch(getHealthCategories);
  const entries = useFetch(() => getHealthEntries(subjectId), [subjectId]);
  // null = todavía no se tocó: se marcan todos los registros
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [reason, setReason] = useState('');
  const [questions, setQuestions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entries.loading && !entries.data) return <LoadingView />;

  const all = entries.data ?? [];
  const selected = picked ?? new Set(all.map((e) => e.id));

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
    if (!reason.trim() || selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const handoff = await createHandoff(subjectId, {
        reason: reason.trim(),
        questions: questions.trim(),
        healthEntryIds: [...selected],
      });
      navigation.replace('HandoffView', { handoffId: handoff.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos crear el resumen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <StatusMessage message={error ?? entries.error} />

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
                  <View style={[styles.groupIcon, { backgroundColor: colors[meta.bg] }]}>
                    <Ionicons name={meta.icon} size={16} color={colors[meta.fg]} />
                  </View>
                  <Text style={styles.groupTitle}>{meta.plural}</Text>
                  <Text style={styles.groupToggle}>{allOn ? 'Quitar todos' : 'Marcar todos'}</Text>
                </Pressable>
                {items.map((e) => {
                  const on = selected.has(e.id);
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => toggle([e.id])}
                      style={styles.item}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={on ? colors.primary : colors.muted}
                      />
                      <View style={formStyles.flex}>
                        <Text style={styles.itemTitle}>{e.latestVersion.title}</Text>
                        {e.latestVersion.dose || e.latestVersion.frequency ? (
                          <Text style={styles.itemMeta}>
                            {[e.latestVersion.dose, e.latestVersion.frequency].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })
        )}
        {pickError ? <Text style={[formStyles.error, { color: colors.danger }]}>{pickError}</Text> : null}
      </FormCard>

      <SubmitButton label="Crear resumen" onPress={handleSave} loading={saving} />
    </FormScroll>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  group: { gap: 4 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  groupIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  groupToggle: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  itemMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
}));
