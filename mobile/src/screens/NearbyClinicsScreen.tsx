import * as Location from 'expo-location';
import { Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { colors, fonts } from '../theme';

/** Radio de búsqueda en metros. */
const RADIUS = 3000;

/**
 * Buscador público de OpenStreetMap: no necesita clave, pero pide identificar la app y no pasar de una
 * consulta por segundo (https://operations.osmfoundation.org/policies/nominatim/).
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_TERMS = ['hospital', 'clínica'];

type Place = {
  id: number;
  name: string;
  kind: 'hospital' | 'clinic' | 'doctors';
  lat: number;
  lon: number;
  distance: number;
  address: string | null;
  phone: string | null;
  emergency: boolean;
};

const kindLabel = { hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultorio' } as const;

type NominatimResult = {
  osm_id: number;
  category: string;
  type: string;
  name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
};

/** Distancia en metros entre dos coordenadas (fórmula del haversine). */
function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPlaces(lat: number, lon: number): Promise<Place[]> {
  // Recuadro de búsqueda de ±RADIUS alrededor de la persona
  const dLat = RADIUS / 111320;
  const dLon = RADIUS / (111320 * Math.cos((lat * Math.PI) / 180));
  const viewbox = [lon - dLon, lat + dLat, lon + dLon, lat - dLat].join(',');

  const results: NominatimResult[] = [];
  for (const [i, term] of SEARCH_TERMS.entries()) {
    if (i > 0) await wait(1100);
    const params = new URLSearchParams({
      q: term,
      format: 'jsonv2',
      viewbox,
      bounded: '1',
      limit: '40',
      addressdetails: '1',
      extratags: '1',
      'accept-language': 'es',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { 'User-Agent': 'Yuyay/1.0 (app movil)' } });
    if (!res.ok) throw new Error(String(res.status));
    results.push(...((await res.json()) as NominatimResult[]));
  }

  const seen = new Set<number>();
  return results
    .map((r): Place | null => {
      if (r.category !== 'amenity' || !(r.type in kindLabel) || !r.name || seen.has(r.osm_id)) return null;
      seen.add(r.osm_id);
      const pLat = Number(r.lat);
      const pLon = Number(r.lon);
      const t = r.extratags ?? {};
      const street = [r.address?.road, r.address?.house_number].filter(Boolean).join(' ');
      return {
        id: r.osm_id,
        name: r.name,
        kind: r.type as Place['kind'],
        lat: pLat,
        lon: pLon,
        distance: distanceBetween(lat, lon, pLat, pLon),
        address: street || null,
        phone: t.phone ?? t['contact:phone'] ?? null,
        emergency: t.emergency === 'yes' || r.type === 'hospital',
      };
    })
    .filter((p): p is Place => p !== null && p.distance <= RADIUS)
    .sort((a, b) => a.distance - b.distance);
}

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

function openInMaps(p: Place) {
  const label = encodeURIComponent(p.name);
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${label}&ll=${p.lat},${p.lon}`
      : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  Linking.openURL(url);
}

/** Pide permiso de ubicación y busca los lugares; `denied` si la persona no dio permiso. */
async function findNearby(): Promise<{ denied: true } | { denied: false; places: Place[] }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { denied: true };
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { denied: false, places: await fetchPlaces(pos.coords.latitude, pos.coords.longitude) };
}

export function NearbyClinicsScreen() {
  const result = useFetch(findNearby);

  if (result.loading && !result.data) return <LoadingView label="Buscando clínicas cerca de ti…" />;

  const denied = result.data?.denied ?? false;
  const places = result.data && !result.data.denied ? result.data.places : null;
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

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  credit: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
