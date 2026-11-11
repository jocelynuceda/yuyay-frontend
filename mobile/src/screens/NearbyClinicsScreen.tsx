import { Linking, Platform, RefreshControl, ScrollView, Text } from 'react-native';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { findNearbyPlaces } from '../services/places';
import { fonts, makeStyles, useTheme } from '../theme';
import { kindLabel, RADIUS, type Place } from '../utils/places';

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

function openInMaps(p: Place) {
  const label = encodeURIComponent(p.name);
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${label}&ll=${p.lat},${p.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  Linking.openURL(url);
}

export function NearbyClinicsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const result = useFetch(findNearbyPlaces);

  if (result.loading && !result.data) return <LoadingView label="Buscando clínicas cerca de ti…" />;

  const denied = result.data?.status === 'denied';
  const places = result.data?.status === 'ok' ? result.data.places : null;
  const error = result.error ? 'No pudimos buscar clínicas cercanas. Revisa tu conexión e inténtalo de nuevo.' : null;

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={result.refreshing} onRefresh={result.refresh} tintColor={colors.primary} />
      }
    >
      {denied ? (
        <EmptyState
          title="Necesitamos tu ubicación"
          description="Actívala para ver hospitales y clínicas a tu alrededor."
          action={
            <SubmitButton
              label="Permitir ubicación"
              icon="crosshairs-gps"
              onPress={() => (Platform.OS === 'web' ? result.reload() : Linking.openSettings())}
            />
          }
        />
      ) : null}

      <StatusMessage message={error} />

      {result.data?.status === 'unavailable' ? (
        <EmptyState
          title="No pudimos ubicarte"
          description="Activa el GPS o sal a un lugar abierto y desliza hacia abajo para intentar de nuevo."
        />
      ) : null}

      {places ? (
        <Text style={styles.intro}>
          {places.length} lugares a menos de {RADIUS / 1000} km. Toca uno para abrirlo en el mapa.
        </Text>
      ) : null}

      {places?.length === 0 ? <EmptyState title="No encontramos lugares cerca" /> : null}

      {places?.map((p) => (
        <ListItem
          key={p.id}
          icon={p.kind === 'hospital' ? 'medical' : 'medkit-outline'}
          iconBg={p.kind === 'hospital' ? colors.primaryTint : colors.accentTint}
          iconFg={p.kind === 'hospital' ? colors.primary : colors.accentText}
          title={p.name}
          subtitle={[kindLabel[p.kind], formatDistance(p.distance), p.address].filter(Boolean).join(' · ')}
          onPress={() => openInMaps(p)}
          right={
            p.phone ? (
              <IconButton
                icon="call-outline"
                label={`Llamar a ${p.name}`}
                color={colors.primary}
                onPress={() => Linking.openURL(`tel:${p.phone?.replace(/[^\d+]/g, '')}`)}
              />
            ) : p.emergency ? (
              <Badge label="Emergencia" tone="amber" />
            ) : null
          }
        />
      ))}

      <Text style={styles.credit}>Datos de lugares © colaboradores de OpenStreetMap</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  credit: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 8 },
}));
