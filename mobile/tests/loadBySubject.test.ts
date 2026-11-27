import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBySubject } from '../src/utils/loadBySubject.ts';

test('keeps the lists that loaded and counts the ones that failed', async () => {
  const { loaded, failed } = await loadBySubject([1, 2], async (id) => {
    if (id === 2) throw new Error('offline');
    return ['a'];
  });
  assert.deepEqual([...loaded], [[1, ['a']]]);
  assert.equal(failed, 1);
});

test('reports every failure so an empty result is not taken as no data', async () => {
  const { loaded, failed } = await loadBySubject([1, 2], async () => { throw new Error('offline'); });
  assert.equal(loaded.size, 0);
  assert.equal(failed, 2);
});
