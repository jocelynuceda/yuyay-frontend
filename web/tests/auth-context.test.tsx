// Pruebas de AuthContext renderizado con React (StrictMode) en jsdom,
// contra un backend simulado con refresh de un solo uso y rotación (reglas del PR #50).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import assert from 'node:assert/strict'
import test from 'node:test'
import { StrictMode, act, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '../src/contexts/AuthContext'
import { ToastProvider } from '../src/contexts/ToastContext'
import { useAuth } from '../src/hooks/useAuth'
import AppRoutes from '../src/routes/AppRoutes'
import * as http from '../src/services/http'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

function backend() {
  let n = 0
  const active = new Map<string, boolean>()
  const calls = { refresh: 0, login: 0 }
  const state = {
    refresh: 'ok' as 'ok' | 'network' | '401',
    latency: 0,
    loginOk: true,
    loginWait: null as Promise<void> | null,
  }
  const issue = (name = 'Ana') => {
    n += 1
    const p = { accessToken: `A${n}`, refreshToken: `R${n}`, tokenType: 'Bearer', expiresInSeconds: 3600, user: { id: 1, name } }
    active.set(p.refreshToken, true)
    return p
  }
  const fail = (config: any, status: number) => Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true, config, response: { status, data: { message: `HTTP ${status}` }, headers: {}, config },
  })
  const adapter = async (config: any) => {
    const body = config.data ? JSON.parse(config.data) : {}
    if (config.url.endsWith('/auth/refresh')) {
      calls.refresh += 1
      if (state.refresh === 'network') throw Object.assign(new Error('Network Error'), { isAxiosError: true, config, code: 'ERR_NETWORK' })
      if (state.refresh === '401' || !active.get(body.refreshToken)) throw fail(config, 401)
      active.set(body.refreshToken, false)
      const pair = issue()
      await new Promise((r) => setTimeout(r, state.latency))
      return { status: 200, data: pair, headers: {}, config }
    }
    if (config.url.endsWith('/auth/login')) {
      calls.login += 1
      await (state.loginWait ?? new Promise((r) => setTimeout(r, 10)))
      if (!state.loginOk) throw fail(config, 401)
      return { status: 200, data: issue('Login'), headers: {}, config }
    }
    if (config.url.endsWith('/auth/logout')) {
      active.set(body.refreshToken, false)
      return { status: 204, data: '', headers: {}, config }
    }
    if (config.url.endsWith('/care-subjects')) {
      return { status: 200, data: [], headers: {}, config }
    }
    throw fail(config, 404)
  }
  return { adapter, calls, state, issue, active: () => [...active].filter(([, a]) => a).map(([t]) => t) }
}

let ctx: ReturnType<typeof useAuth>
function Probe() {
  const value = useAuth()
  useEffect(() => { ctx = value }, [value])
  return null
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Espera hasta que se cumpla la condición (o falla al vencer el plazo) en vez de un retraso fijo. */
async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('La condición no se cumplió a tiempo')
    await act(async () => { await wait(10) })
  }
}

async function mount(prepare: (b: ReturnType<typeof backend>, s: MemoryStorage) => void, children?: ReactNode) {
  const storage = new MemoryStorage()
  ;(globalThis as any).sessionStorage = storage
  http.clearTokens()
  const b = backend()
  http.api.defaults.adapter = b.adapter
  http.publicApi.defaults.adapter = b.adapter
  prepare(b, storage)
  // The provider cases reuse this module. Seed the session after clearing it.
  // The HTTP suite covers a true reload with a fresh module.
  const refreshToken = storage.getItem('yuyay.refreshToken')
  if (refreshToken) http.setTokens({ refreshToken, accessToken: '' })
  const root = createRoot(document.getElementById('root')!)
  await act(async () => {
    root.render(<StrictMode><AuthProvider><Probe />{children}</AuthProvider></StrictMode>)
  })
  await act(async () => { await wait(30) })
  return { b, storage, root }
}

test('A. Restaurar sin red: conserva el token, expone restoreError y retryRestore recupera la sesión', async (t) => {
  const { b, storage, root } = await mount((b, s) => { b.issue(); s.setItem('yuyay.refreshToken', 'R1'); b.state.refresh = 'network' })
  t.after(async () => { await act(async () => root.unmount()) })
  assert.equal(ctx.user, null)
  assert.equal(ctx.isLoading, false)
  assert.ok(ctx.restoreError, 'debe haber mensaje para mostrar Reintentar')
  assert.equal(storage.getItem('yuyay.refreshToken'), 'R1', 'el token se conserva')
  b.state.refresh = 'ok'
  await act(async () => { await ctx.retryRestore() })
  assert.equal(ctx.user?.name, 'Ana')
  assert.equal(ctx.restoreError, null)
})

test('B. Restaurar con 401: borra el token y no ofrece reintentar', async (t) => {
  const { storage, root } = await mount((b, s) => { b.issue(); s.setItem('yuyay.refreshToken', 'R1'); b.state.refresh = '401' })
  t.after(async () => { await act(async () => root.unmount()) })
  assert.equal(ctx.user, null)
  assert.equal(ctx.restoreError, null)
  assert.equal(ctx.isLoading, false)
  assert.equal(storage.getItem('yuyay.refreshToken'), null)
})

test('C. Restaurar en StrictMode (efectos dobles): un solo /auth/refresh y queda autenticado', async (t) => {
  const { b, root } = await mount((b, s) => { b.issue(); s.setItem('yuyay.refreshToken', 'R1') })
  t.after(async () => { await act(async () => root.unmount()) })
  assert.equal(b.calls.refresh, 1)
  assert.equal(ctx.user?.name, 'Ana')
  assert.equal(ctx.isLoading, false)
})

test('D. Login: isLoading no se activa mientras se envía y un error llega al formulario', async (t) => {
  const { b, root } = await mount(() => {})
  t.after(async () => { await act(async () => root.unmount()) })
  b.state.loginOk = false
  let pending!: Promise<void>
  await act(async () => { pending = ctx.login('a@b.c', 'x'); void pending.catch(() => {}); await wait(2) })
  assert.equal(ctx.isLoading, false, 'isLoading se activó durante el envío del login')
  await act(async () => { await assert.rejects(pending) })
  b.state.loginOk = true
  await act(async () => { pending = ctx.login('a@b.c', 'x'); await wait(2) })
  assert.equal(ctx.isLoading, false, 'isLoading se activó durante el envío del login')
  await act(async () => { await pending })
  assert.equal(ctx.user?.name, 'Login')
})

test('E. Login mientras se restaura: gana el login y el refresh rotado por la restauración queda revocado', async (t) => {
  const storage = new MemoryStorage()
  ;(globalThis as any).sessionStorage = storage
  http.clearTokens()
  const b = backend()
  http.api.defaults.adapter = b.adapter
  http.publicApi.defaults.adapter = b.adapter
  b.issue(); storage.setItem('yuyay.refreshToken', 'R1'); b.state.latency = 60
  http.setTokens({ refreshToken: 'R1', accessToken: '' })
  const root = createRoot(document.getElementById('root')!)
  t.after(async () => { await act(async () => root.unmount()) })
  await act(async () => { root.render(<StrictMode><AuthProvider><Probe /></AuthProvider></StrictMode>) })
  await act(async () => { await ctx.login('a@b.c', 'x') })
  await act(async () => { await wait(120) })
  assert.equal(ctx.user?.name, 'Login', 'la restauración tardía no reemplaza al login')
  assert.equal(ctx.isLoading, false, 'el login debe terminar el loader de la restauración reemplazada')
  const loginRefresh = storage.getItem('yuyay.refreshToken')
  assert.deepEqual(b.active(), [loginRefresh], 'solo queda activo el refresh del login')
})

function RouteLocation() {
  return <output id="pathname">{useLocation().pathname}</output>
}

function routesAt(path: string) {
  return <MemoryRouter initialEntries={[path]}><ToastProvider><RouteLocation /><AppRoutes /></ToastProvider></MemoryRouter>
}

function seedFailedRestore(b: ReturnType<typeof backend>, storage: MemoryStorage) {
  storage.setItem('yuyay.refreshToken', b.issue().refreshToken)
  b.state.refresh = 'network'
}

function buttonWithText(label: string) {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === label)
  assert.ok(button, `Falta el botón "${label}"`)
  return button
}

// Después de recuperar la sesión: /login lleva al inicio (dashboard); las rutas privadas se quedan donde estaban.
const afterRestore: Record<string, string> = { '/': '/', '/login': '/', '/people': '/people' }

for (const path of ['/', '/login', '/people']) {
  test(`La ruta ${path} permite recuperar la sesión después de un fallo de red`, async (t) => {
    const { b, storage, root } = await mount(seedFailedRestore, routesAt(path))
    t.after(async () => { await act(async () => root.unmount()) })

    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /conexión/)
    assert.equal(document.getElementById('pathname')?.textContent, path)
    assert.equal(storage.getItem('yuyay.refreshToken'), 'R1')
    assert.equal(b.calls.refresh, 1)

    b.state.refresh = 'ok'
    await act(async () => { buttonWithText('Reintentar').click() })
    await waitFor(() => ctx.user?.name === 'Ana' && document.getElementById('pathname')?.textContent === afterRestore[path])

    assert.equal(ctx.user?.name, 'Ana')
    assert.equal(document.getElementById('pathname')?.textContent, afterRestore[path])
    assert.equal(storage.getItem('yuyay.refreshToken'), 'R2')
    assert.equal(b.calls.refresh, 2)
  })
}

test('Elegir iniciar sesión de nuevo cierra la sesión guardada y lleva al login', async (t) => {
  const { b, storage, root } = await mount(seedFailedRestore, routesAt('/register'))
  t.after(async () => { await act(async () => root.unmount()) })

  await act(async () => { buttonWithText('Iniciar sesión de nuevo').click() })
  assert.equal(document.getElementById('pathname')?.textContent, '/login')
  assert.equal(storage.getItem('yuyay.refreshToken'), null)
  assert.deepEqual(b.active(), [])
  assert.equal(ctx.restoreError, null)
})

test('La ruta de login conserva el formulario durante un intento que termina en 401', async (t) => {
  await import('../src/pages/auth/LoginPage')
  const { b, root } = await mount(() => {}, routesAt('/login'))
  t.after(async () => { await act(async () => root.unmount()) })
  const form = document.querySelector('form')
  assert.ok(form)

  b.state.loginOk = false
  let finishLogin!: () => void
  b.state.loginWait = new Promise((resolve) => { finishLogin = resolve })
  let failure!: Promise<void>
  await act(async () => {
    failure = assert.rejects(ctx.login('ana@example.test', 'sintética'), { message: 'HTTP 401' })
  })
  assert.equal(b.calls.login, 1)
  assert.equal(document.querySelector('form'), form)

  await act(async () => {
    finishLogin()
    await failure
  })
  assert.equal(document.querySelector('form'), form)
  assert.equal(document.getElementById('pathname')?.textContent, '/login')
})
