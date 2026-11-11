import * as Location from 'expo-location';
import { RADIUS, toPlaces, type NominatimResult, type Place } from '../utils/places';

/** Si el GPS no responde en este tiempo se usa la última ubicación conocida. */
const LOCATION_TIMEOUT_MS = 10000;

/**
 * Buscador público de OpenStreetMap: no necesita clave, pero pide identificar la app y no pasar de una
 * consulta por segundo (https://operations.osmfoundation.org/policies/nominatim/).
 */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_TERMS = ['hospital', 'clínica'];

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
  return toPlaces(results, lat, lon);
}

/** Posición actual; si el GPS tarda o falla, la última conocida. Null si no hay ninguna. */
async function currentPosition() {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS));
  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
    timeout,
  ]);
  return position ?? (await Location.getLastKnownPositionAsync().catch(() => null));
}

export type NearbyResult =
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'ok'; places: Place[] };

/** Pide permiso de ubicación y busca hospitales y clínicas cercanos. */
export async function findNearbyPlaces(): Promise<NearbyResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };
  const position = await currentPosition();
  if (!position) return { status: 'unavailable' };
  return { status: 'ok', places: await fetchPlaces(position.coords.latitude, position.coords.longitude) };
}
