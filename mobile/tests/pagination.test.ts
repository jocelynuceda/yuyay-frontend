import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPages } from '../src/services/pagination.ts';

test('existing collection screens receive all 101 records across backend pages', async () => {
  const requested: number[] = [];
  const items = await collectPages(async (number) => {
    requested.push(number);
    const count = Math.min(100, 101 - number * 100);
    return {
      content: Array.from({ length: count }, (_, i) => number * 100 + i + 1),
      number, size: 100, totalElements: 101, totalPages: 2,
    };
  });
  assert.deepEqual(requested, [0, 1]);
  assert.equal(items.length, 101);
  assert.equal(items[100], 101);
});

test('empty results and a failed later page are handled without silently returning a partial list', async () => {
  assert.deepEqual(await collectPages(async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 })), []);
  await assert.rejects(collectPages(async (number) => {
    if (number === 1) throw new Error('Network lost');
    return { content: [1], number: 0, size: 1, totalElements: 2, totalPages: 2 };
  }));
});

test('invalid totals, excessive page counts and missing progress fail explicitly', async () => {
  for (const totalPages of [-1, 1_000_001]) {
    await assert.rejects(collectPages(async () => ({
      content: [1], number: 0, size: 1, totalElements: totalPages, totalPages,
    })));
  }
  await assert.rejects(collectPages(async () => ({
    content: [], number: 0, size: 1, totalElements: 2, totalPages: 2,
  })));
});

test('legacy deployment arrays remain complete during the backend rollout', async () => {
  const legacy = Array.from({ length: 101 }, (_, i) => i);
  let calls = 0;
  assert.deepEqual(await collectPages(async () => { calls++; return legacy; }), legacy);
  assert.equal(calls, 1);
});
