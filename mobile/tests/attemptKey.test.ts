import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttemptKey } from '../src/utils/attemptKey.ts';

test('repeats the key for the same content and renews it when the content changes', () => {
  let next = 0;
  const keyFor = createAttemptKey(() => `id-${++next}`);
  const first = keyFor({ reason: 'Control', healthEntryIds: [1] });

  assert.equal(keyFor({ reason: 'Control', healthEntryIds: [1] }), first);
  assert.notEqual(keyFor({ reason: 'Otro', healthEntryIds: [1] }), first);
});
