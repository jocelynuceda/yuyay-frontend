import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { ChoiceChips, FormCard, SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import {
  createHandoffSession,
  deleteHandoff,
  getHandoff,
  getHandoffSessions,
  revokeHandoffSession,
} from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts, radius } from '../theme';
import type { HandoffItem, HandoffSession, HomeStackParamList } from '../types';
import { categoryMeta, fallbackCategory } from '../utils/categories';
import { confirmAction, shareText } from '../utils/confirm';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'HandoffView'>;

const expiryOptions = [
  { value: 2, label: '2 horas' },
  { value: 24, label: '1 día' },
  { value: 72, label: '3 días' },
];

/** Minutos que dura la vista una vez que el médico abre el enlace. */
const SESSION_WINDOW_MINUTES = 30;

const dateTime = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function sessionState(s: HandoffSession) {
  if (s.revokedAt) return { label: 'Revocado', tone: 'soft' } as const;
  if (new Date(s.expiresAt) < new Date()) return { label: 'Vencido', tone: 'soft' } as const;
  if (s.firstOpenedAt) return { label: 'Abierto', tone: 'accent' } as const;
  return { label: 'Sin abrir', tone: 'amber' } as const;
}

export function HandoffViewScreen({ route, navigation }: Props) {
  const { handoffId } = route.params;
  const [doctorMode, setDoctorMode] = useState(false);
  const [expiresIn, setExpiresIn] = useState(24);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const handoff = useFetch(() => getHandoff(handoffId), [handoffId]);
  const sessions = useFetch(() => getHandoffSessions(handoffId), [handoffId]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: !doctorMode });
  }, [navigation, doctorMode]);

  if (handoff.loading && !handoff.data) return <LoadingView />;
  if (!handoff.data) return <StatusMessage message={handoff.error ?? 'No encontramos el resumen.'} />;

  const h = handoff.data;
  const groups = groupByCategory(h.items);

  async function handleShare() {
    setSharing(true);
    setMessage(null);
    try {
      const s = await createHandoffSession(handoffId, expiresIn, SESSION_WINDOW_MINUTES);
      const result = await shareText(
        `Resumen de salud en Yuyay: "${h.reason}".\nCódigo de acceso: ${s.token}\nVence el ${dateTime.format(new Date(s.expiresAt))}.`,
      );
      sessions.reload();
      if (result === 'copied') setMessage({ text: 'Copiamos el código de acceso.', tone: 'info' });
      if (result === 'failed') setMessage({ text: `Código de acceso: ${s.token}`, tone: 'info' });
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : 'No pudimos crear el enlace.', tone: 'error' });
    } finally {
      setSharing(false);
    }
  }

  async function handleRevoke(sessionId: number) {
    if (!(await confirmAction('Revocar enlace', 'Quien tenga el código ya no podrá abrir el resumen.', 'Revocar'))) {
      return;
    }
    try {
      await revokeHandoffSession(sessionId);
      sessions.reload();
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : 'No pudimos revocar el enlace.', tone: 'error' });
    }
  }

  async function handleDelete() {
    if (!(await confirmAction('Borrar resumen', 'Los enlaces que compartiste dejarán de funcionar.', 'Borrar'))) return;
    try {
      await deleteHandoff(handoffId);
      navigation.goBack();
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : 'No pudimos borrar el resumen.', tone: 'error' });
    }
  }

  // Modo médico: letra grande, sin cabecera ni acciones
  if (doctorMode) {
    return (
      <SafeAreaView style={styles.doctor}>
        <ScrollView contentContainerStyle={styles.doctorContent}>
          <View style={styles.doctorTop}>
            <Text style={styles.doctorEyebrow}>RESUMEN DE SALUD · {formatDate(h.createdAt)}</Text>
            <Pressable
              onPress={() => setDoctorMode(false)}
              style={styles.doctorClose}
              accessibilityRole="button"
              accessibilityLabel="Salir del modo médico"
            >
              <Ionicons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <Text style={styles.doctorReason}>{h.reason}</Text>
          {groups.map(([code, items]) => (
            <View key={code} style={styles.doctorGroup}>
              <Text style={styles.doctorGroupTitle}>{(categoryMeta[code] ?? fallbackCategory).plural}</Text>
              {items.map((i) => (
                <View key={i.healthEntryId} style={styles.doctorItem}>
                  <Text style={styles.doctorItemTitle}>{i.title}</Text>
                  <ItemFacts item={i} large />
                </View>
              ))}
            </View>
          ))}
          {h.questions ? (
            <View style={styles.doctorQuestions}>
              <Text style={styles.doctorGroupTitle}>Preguntas</Text>
              <Text style={styles.doctorQuestionsText}>{h.questions}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{formatDate(h.createdAt)}</Text>
        <Text style={styles.reason}>{h.reason}</Text>
        {h.questions ? <Text style={styles.questions}>{h.questions}</Text> : null}
      </View>

      <SubmitButton label="Mostrar al médico" icon="monitor-eye" onPress={() => setDoctorMode(true)} />

      {message ? <StatusMessage message={message.text} tone={message.tone} /> : null}

      {groups.map(([code, items]) => {
        const meta = categoryMeta[code] ?? fallbackCategory;
        return (
          <FormCard key={code} title={meta.plural}>
            {items.map((i) => (
              <View key={i.healthEntryId} style={styles.item}>
                <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={16} color={meta.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{i.title}</Text>
                  <ItemFacts item={i} />
                </View>
              </View>
            ))}
          </FormCard>
        );
      })}

      <FormCard title="Compartir con un enlace temporal">
        <Text style={styles.help}>
          Se genera un código de un solo uso. Al abrirlo, el médico ve el resumen durante {SESSION_WINDOW_MINUTES}{' '}
          minutos.
        </Text>
        <ChoiceChips options={expiryOptions} selected={[expiresIn]} onToggle={setExpiresIn} />
        <SubmitButton label="Compartir" icon="share-variant" onPress={handleShare} loading={sharing} />
        {(sessions.data ?? []).map((s) => {
          const state = sessionState(s);
          const live = state.label === 'Sin abrir' || state.label === 'Abierto';
          return (
            <ListItem
              key={s.id}
              icon="link-outline"
              title={`Vence ${dateTime.format(new Date(s.expiresAt))}`}
              subtitle={s.firstOpenedAt ? `Abierto ${dateTime.format(new Date(s.firstOpenedAt))}` : null}
              dimmed={!live}
              right={
                <View style={styles.right}>
                  <Badge label={state.label} tone={state.tone} />
                  {live ? (
                    <IconButton
                      icon="close-circle-outline"
                      label="Revocar enlace"
                      color={colors.danger}
                      onPress={() => handleRevoke(s.id)}
                    />
                  ) : null}
                </View>
              }
            />
          );
        })}
      </FormCard>

      <Pressable onPress={handleDelete} style={styles.delete} accessibilityRole="button">
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={styles.deleteText}>Borrar resumen</Text>
      </Pressable>
    </ScrollView>
  );
}

function ItemFacts({ item, large }: { item: HandoffItem; large?: boolean }) {
  const facts = [item.dose && `Dosis: ${item.dose}`, item.frequency].filter(Boolean).join(' · ');
  return (
    <>
      {facts ? <Text style={large ? styles.doctorFacts : styles.itemMeta}>{facts}</Text> : null}
      {item.details ? <Text style={large ? styles.doctorDetails : styles.itemMeta}>{item.details}</Text> : null}
      {item.confidenceLevel === 'UNCERTAIN' ? <Badge label="Por confirmar" tone="amber" /> : null}
    </>
  );
}

/** Agrupa los registros por categoría, en el orden en que aparecen. */
function groupByCategory(items: HandoffItem[]) {
  const map = new Map<string, HandoffItem[]>();
  items.forEach((i) => map.set(i.categoryCode, [...(map.get(i.categoryCode) ?? []), i]));
  return [...map.entries()];
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 4 },
  list: { padding: 20, gap: 14, paddingBottom: 40 },
  hero: { backgroundColor: colors.soft, borderRadius: radius.lg, padding: 18, gap: 6 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 12, color: colors.softText, letterSpacing: 0.4 },
  reason: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  questions: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
  item: { flexDirection: 'row', gap: 10 },
  itemIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  deleteText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  doctor: { flex: 1, backgroundColor: colors.white },
  doctorContent: { padding: 24, gap: 20, paddingBottom: 48 },
  doctorTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doctorEyebrow: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, letterSpacing: 0.6 },
  doctorClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorReason: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.ink },
  doctorGroup: { gap: 10 },
  doctorGroupTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, letterSpacing: 0.4 },
  doctorItem: { borderLeftWidth: 4, borderLeftColor: colors.accent, paddingLeft: 14, gap: 4 },
  doctorItemTitle: { fontFamily: fonts.semibold, fontSize: 22, color: colors.ink },
  doctorFacts: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  doctorDetails: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 24, color: colors.muted },
  doctorQuestions: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 8 },
  doctorQuestionsText: { fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.ink },
});
