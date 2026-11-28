// El override de minimatch está limitado a @expo/fingerprint (GHSA-g3hv-75wg-m249).
// Fingerprint aún declara ^10; 11 conserva Minimatch/match/pattern/negate usados por su API.
// Node 24 cumple sus requisitos. Esta prueba y el export verifican la configuración real.
// Retirar el override cuando Expo incorpore la corrección en su propio rango de dependencias.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createFingerprintAsync } = require('expo/fingerprint') as {
  createFingerprintAsync(root: string, options: { platforms: string[] }): Promise<{
    hash: string;
    sources: { type: string; id?: string }[];
  }>;
};

test('Fingerprint genera una huella estable con el minimatch corregido y la configuración real', { timeout: 120_000 }, async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const first = await createFingerprintAsync(root, { platforms: ['android', 'ios'] });
  assert.ok(first.hash.length >= 32);
  assert.ok(first.sources.some((source) => source.type === 'contents' && source.id === 'expoConfig'));
  const second = await createFingerprintAsync(root, { platforms: ['android', 'ios'] });
  assert.equal(first.hash, second.hash, 'La misma configuración debe producir la misma huella');
});
