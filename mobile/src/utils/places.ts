// Lugares cercanos: conversión de los resultados de OpenStreetMap (sin dependencias de Expo).

/** Radio de búsqueda en metros. */
export const RADIUS = 3000;

export const kindLabel = { hospital: 'Hospital', clinic: 'Clínica', doctors: 'Consultorio' } as const;

export type Place = {
  id: number;
  name: string;
  kind: keyof typeof kindLabel;
  lat: number;
  lon: number;
  distance: number;
  address: string | null;
  phone: string | null;
  emergency: boolean;
};

export type NominatimResult = {
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
export function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convierte los resultados de Nominatim en lugares únicos dentro del radio, del más cercano al más lejano. */
export function toPlaces(results: NominatimResult[], lat: number, lon: number): Place[] {
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
