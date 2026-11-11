import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceBetween, RADIUS, toPlaces, type NominatimResult } from '../src/utils/places.ts';

const here = { lat: -12.0464, lon: -77.0428 };
const result = (overrides: Partial<NominatimResult>): NominatimResult => ({
  osm_id: 1,
  category: 'amenity',
  type: 'hospital',
  name: 'Hospital Central',
  lat: String(here.lat + 0.001),
  lon: String(here.lon),
  ...overrides,
});

test('distanceBetween: cero en el mismo punto y ~111 m por milésima de grado de latitud', () => {
  assert.equal(distanceBetween(here.lat, here.lon, here.lat, here.lon), 0);
  assert.ok(Math.abs(distanceBetween(here.lat, here.lon, here.lat + 0.001, here.lon) - 111) < 1);
});

test('toPlaces: deja solo centros de salud con nombre, sin repetidos, dentro del radio y del más cercano al más lejano', () => {
  const places = toPlaces([
    result({ osm_id: 1, lat: String(here.lat + 0.01) }),
    result({ osm_id: 2, type: 'clinic', name: 'Clínica Sur', extratags: { phone: '+51 1 555' } }),
    result({ osm_id: 2 }),
    result({ osm_id: 3, type: 'pharmacy', name: 'Farmacia' }),
    result({ osm_id: 4, name: '' }),
    result({ osm_id: 5, category: 'building' }),
    result({ osm_id: 6, lat: String(here.lat + 1) }),
  ], here.lat, here.lon);

  assert.deepEqual(places.map((p) => p.id), [2, 1]);
  assert.equal(places[0].phone, '+51 1 555');
  assert.equal(places[0].emergency, false);
  assert.equal(places[1].emergency, true, 'los hospitales atienden emergencias');
  assert.ok(places.every((p) => p.distance <= RADIUS));
});
