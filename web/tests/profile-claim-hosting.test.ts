import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('la política de hosting de entrega prohíbe caché y referencias', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const source of ['/entrega', '/entrega/:path*']) {
    const rule = config.headers?.find((item: { source: string }) => item.source === source)
    assert.ok(rule, 'Falta la política HTTP para ' + source)
    const headers = new Map<string, string>(rule.headers.map((item: { key: string; value: string }) => [item.key.toLowerCase(), item.value]))
    assert.match(headers.get('cache-control') ?? '', /(?:^|,\s*)no-store(?:,|$)/)
    assert.equal(headers.get('referrer-policy'), 'no-referrer')
    assert.equal(headers.get('cdn-cache-control'), 'no-store')
    assert.equal(headers.get('vercel-cdn-cache-control'), 'no-store')
  }
})
