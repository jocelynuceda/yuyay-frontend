// Reintentos automáticos y timeout del cliente HTTP (services/http.ts) con un adaptador simulado.
import assert from 'node:assert/strict'
import test from 'node:test'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as http from '../src/services/http'

type Step = 'ok' | 'network' | 'timeout' | number

/** Responde según una lista de pasos (un paso por intento) y cuenta los intentos por URL. */
function scripted(steps: Step[]) {
  const attempts: { method: string; url: string; auth?: string }[] = []
  const adapter = async (config: InternalAxiosRequestConfig) => {
    attempts.push({ method: (config.method ?? 'get').toUpperCase(), url: config.url ?? '', auth: config.headers?.Authorization as string | undefined })
    const step = steps[Math.min(attempts.length - 1, steps.length - 1)]
    if (step === 'ok') return { status: 200, statusText: 'OK', data: { ok: true }, headers: {}, config }
    if (step === 'network') throw new AxiosError('Network Error', 'ERR_NETWORK', config)
    if (step === 'timeout') throw new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED', config)
    const response = { status: step, statusText: String(step), data: { message: `HTTP ${step}` }, headers: {}, config }
    throw new AxiosError(`HTTP ${step}`, AxiosError.ERR_BAD_RESPONSE, config, null, response as never)
  }
  http.api.defaults.adapter = adapter as never
  http.publicApi.defaults.adapter = adapter as never
  return attempts
}

test('timeout de 15 s en api y publicApi', () => {
  assert.equal(http.REQUEST_TIMEOUT_MS, 15000)
  assert.equal(http.api.defaults.timeout, 15000)
  assert.equal(http.publicApi.defaults.timeout, 15000)
})

test('GET: dos fallas de red y luego responde -> 3 intentos y termina bien', async () => {
  const attempts = scripted(['network', 'network', 'ok'])
  const start = Date.now()
  const { data } = await http.api.get('/care-subjects')
  assert.deepEqual(data, { ok: true })
  assert.equal(attempts.length, 3)
  assert.ok(Date.now() - start >= 300 + 600 - 30, 'espera 300 ms y luego 600 ms')
})

test('GET: 503 en los tres intentos -> se rinde con mensaje amigable', async () => {
  const attempts = scripted([503])
  await assert.rejects(http.api.get('/notifications'), (error: Error) => {
    assert.equal(error.message, 'El servidor tuvo un problema. Inténtalo de nuevo más tarde.')
    return true
  })
  assert.equal(attempts.length, 1 + http.MAX_RETRIES)
})

test('GET: un timeout no se reintenta (ya esperó 15 s) y explica que el servidor tardó', async () => {
  const attempts = scripted(['timeout', 'ok'])
  await assert.rejects(http.api.get('/users/me'), (error: Error) => {
    assert.equal(error.message, 'El servidor tardó demasiado en responder. Inténtalo de nuevo.')
    return true
  })
  assert.equal(attempts.length, 1)
})

test('GET: si cambia la sesión durante la espera, no se reenvía con el token del otro usuario', async () => {
  http.clearTokens()
  http.setTokens({ accessToken: 'ANA', refreshToken: 'R-ANA' })
  const attempts = scripted(['network', 'ok'])
  const pending = http.api.get('/care-subjects')
  // Ana cierra sesión y entra Bruno mientras el reintento espera sus 300 ms
  setTimeout(() => {
    http.clearTokens()
    http.setTokens({ accessToken: 'BRUNO', refreshToken: 'R-BRUNO' })
  }, 100)
  await assert.rejects(pending, (error: unknown) => {
    assert.equal((error as { name?: string }).name, 'CanceledError')
    return true
  })
  await new Promise((r) => setTimeout(r, 400))
  assert.deepEqual(attempts.map((a) => a.auth), ['Bearer ANA'], 'nunca sale con Bearer BRUNO')
  http.clearTokens()
})

test('POST, PATCH y DELETE no se reintentan (podrían duplicar cambios)', async () => {
  for (const send of [
    () => http.api.post('/care-subjects', { name: 'Rosa' }),
    () => http.api.patch('/care-subjects/1', { name: 'Rosa' }),
    () => http.api.delete('/care-subjects/1'),
  ]) {
    const attempts = scripted(['network', 'ok'])
    await assert.rejects(send())
    assert.equal(attempts.length, 1)
  }
})

test('GET: 500 y 4xx no se reintentan', async () => {
  for (const status of [500, 400, 403, 404]) {
    const attempts = scripted([status, 'ok'])
    await assert.rejects(http.api.get('/care-subjects'))
    assert.equal(attempts.length, 1, `HTTP ${status}`)
  }
})

test('GET: cancelar durante la espera detiene los reintentos', async () => {
  const attempts = scripted(['network', 'ok'])
  const controller = new AbortController()
  const pending = http.api.get('/care-subjects', { signal: controller.signal })
  setTimeout(() => controller.abort(), 100)
  await assert.rejects(pending, (error: unknown) => {
    assert.ok(error instanceof Error && (error as { name?: string }).name === 'CanceledError')
    return true
  })
  await new Promise((r) => setTimeout(r, 400))
  assert.equal(attempts.length, 1, 'no hubo segundo intento')
})

test('GET sin conexión del navegador: falla de inmediato, sin reintentos', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } })
  try {
    const attempts = scripted(['network', 'ok'])
    await assert.rejects(http.api.get('/care-subjects'))
    assert.equal(attempts.length, 1)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor)
  }
})

test('publicApi (vista del médico y del delegado) también reintenta lecturas', async () => {
  const attempts = scripted([502, 'ok'])
  const { data } = await http.publicApi.get('/public/handoff-sessions/abc')
  assert.deepEqual(data, { ok: true })
  assert.equal(attempts.length, 2)
})

test('el reintento usa el access token vigente', async () => {
  http.clearTokens()
  http.setTokens({ accessToken: 'A1', refreshToken: 'R1' })
  const attempts = scripted(['network', 'ok'])
  await http.api.get('/care-subjects')
  assert.deepEqual(attempts.map((a) => a.auth), ['Bearer A1', 'Bearer A1'])
  http.clearTokens()
})
