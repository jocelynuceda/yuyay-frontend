import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { FormCard, formStyles, SubmitButton } from '../components/FormKit';
import { FormField } from '../components/FormField';
import { FormScroll } from '../components/FormScroll';
import { HealthEntryCard } from '../components/HealthEntryCard';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import {
  clearDelegateSession,
  getDelegateConsultations,
  getDelegateEntries,
  loadDelegateSession,
  openDelegation,
  parseAccessCode,
} from '../services/delegate';
import { ApiError } from '../services/http';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { DelegateSession, RootStackParamList } from '../types';
import { categoryMeta } from '../utils/categories';
import { confirmAction } from '../utils/confirm';
import type { DelegateOwner } from '../utils/delegateStore';
import { formatDate, formatTime } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Delegate'>;

/** Acceso sin cuenta: pide el código (o llega con él en el enlace) y muestra lo que se compartió. */
export function DelegateScreen({ route }: Props) {
  const token = route.params?.token;
  const { status, user } = useAuth();
  const owner: DelegateOwner = status === 'authenticated' && user ? user.id : null;
  // El acceso cargado se asocia a su dueño y enlace: si cambian, se muestra la carga hasta leer el que corresponde
  const [loaded, setLoaded] = useState<{ owner: DelegateOwner; token?: string; session: DelegateSession | null }>();
  const session = loaded && loaded.owner === owner && loaded.token === token ? loaded.session : undefined;
  const setSession = (next: DelegateSession | null) => setLoaded({ owner, token, session: next });

  useEffect(() => {
    // Un enlace distinto al ya abierto es otro acceso: se muestra el formulario para canjearlo
    loadDelegateSession(owner)
      .then((saved) =>
        setLoaded({ owner, token, session: saved && (!token || saved.sourceToken === token) ? saved : null }),
      )
      .catch(() => setLoaded({ owner, token, session: null }));
  }, [token, owner]);

  if (session === undefined) return <LoadingView />;
  if (!session) return <AccessForm initialCode={token ?? ''} owner={owner} onOpen={setSession} />;
  return <SharedInfo session={session} owner={owner} onExit={() => setSession(null)} />;
}

/** Abrir el acceso es un botón y no algo automático: el enlace solo se puede usar una vez. */
function AccessForm({
  initialCode,
  owner,
  onOpen,
}: {
  initialCode: string;
  owner: DelegateOwner;
  onOpen: (session: DelegateSession) => void;
}) {
  const styles = useStyles();
  const [code, setCode] = useState(initialCode);
  const [submitted, setSubmitted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status } = useAuth();

  const parsed = parseAccessCode(code);

  async function handleOpen() {
    setSubmitted(true);
    if (!parsed) return;
    setOpening(true);
    setError(null);
    try {
      onOpen(await openDelegation(parsed, owner));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos abrir el acceso.');
      setOpening(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={formStyles.container}>
      <Text style={styles.intro}>
        {status === 'authenticated'
          ? 'Abre aquí un acceso que alguien te compartió para otra persona. No cambia tu sesión ni tus personas.'
          : 'Alguien te compartió información de salud en Yuyay. No necesitas una cuenta para verla.'}
      </Text>
      <StatusMessage message={error} />
      <FormCard title="Código de acceso">
        <FormField
          label="Código o enlace"
          icon="key-outline"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          error={submitted && !parsed ? 'Pega el código o el enlace que recibiste.' : undefined}
          hint="Solo se puede abrir una vez. Hazlo en el dispositivo donde lo vas a consultar."
        />
      </FormCard>
      <SubmitButton label="Abrir acceso" icon="key" onPress={handleOpen} loading={opening} />
    </FormScroll>
  );
}

function SharedInfo({
  session,
  owner,
  onExit,
}: {
  session: DelegateSession;
  owner: DelegateOwner;
  onExit: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const entries = useFetch(() => getDelegateEntries(session), [session.accessToken]);
  const consultations = useFetch(
    () => (session.includeConsultations ? getDelegateConsultations(session) : Promise.resolve([])),
    [session.accessToken],
  );

  if ((entries.loading && !entries.data) || (consultations.loading && !consultations.data)) return <LoadingView />;

  const groups = session.categoryCodes
    .map((code) => ({ code, items: (entries.data ?? []).filter((e) => e.categoryCode === code) }))
    .filter((g) => g.items.length > 0);

  const appointments = consultations.data ?? [];

  async function handleExit() {
    const ok = await confirmAction(
      'Salir del acceso',
      'El enlace ya se usó: para volver a entrar necesitarás uno nuevo.',
      'Salir',
    );
    if (!ok) return;
    await clearDelegateSession(owner);
    onExit();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={entries.refreshing || consultations.refreshing}
          onRefresh={() => {
            entries.refresh();
            consultations.refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <View>
        <Text style={styles.name}>{session.careSubjectName}</Text>
        <Text style={styles.intro}>
          Acceso de {session.granteeName}, hasta el {formatDate(session.expiresAt)}. Solo lectura.
        </Text>
      </View>

      <StatusMessage message={entries.error ?? consultations.error} />

      {entries.data && groups.length === 0 && appointments.length === 0 ? (
        <EmptyState title="Aún no hay información para mostrar" />
      ) : null}

      {appointments.length > 0 ? (
        <View style={styles.appointments}>
          <Text style={styles.sectionTight}>Citas</Text>
          {appointments.map((c) => (
            <View key={c.id} style={styles.appointment}>
              <Text style={styles.appointmentReason}>{c.reason}</Text>
              <Text style={styles.appointmentDate}>
                {[formatDate(c.date), c.time && formatTime(c.time)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {groups.map((g) => (
        <View key={g.code}>
          <Text style={styles.section}>{categoryMeta[g.code]?.plural ?? g.items[0].categoryName}</Text>
          {g.items.map((entry) => (
            <HealthEntryCard key={entry.id} entry={entry} />
          ))}
        </View>
      ))}

      <Pressable onPress={handleExit} hitSlop={8} accessibilityRole="button" style={styles.exit}>
        <Text style={styles.exitText}>Salir del acceso</Text>
      </Pressable>
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 14, paddingBottom: 40 },
  name: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: 10 },
  sectionTight: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  appointments: { gap: 10 },
  appointment: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 4 },
  appointmentReason: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  appointmentDate: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  exit: { alignSelf: 'center', paddingVertical: 8 },
  exitText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
}));
