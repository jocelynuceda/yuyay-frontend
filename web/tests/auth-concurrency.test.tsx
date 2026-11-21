import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '../src/contexts/AuthContext'
import { useAuth } from '../src/hooks/useAuth'
import { GoogleSignIn } from '../src/pages/auth/GoogleSignIn'
import * as http from '../src/services/http'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
}
Object.assign(globalThis, { sessionStorage: new MemoryStorage(), localStorage: new MemoryStorage() })

const failure = (status: number) => Object.assign(new Error(`HTTP ${status}`), {
  isAxiosError: true,
  response: { status, data: { code: 'TERMS_ACCEPTANCE_REQUIRED', currentVersion: '1.0' } },
})

async function mount(t: { after: (cleanup: () => Promise<void>) => void }) {
  http.clearTokens()
  let context!: ReturnType<typeof useAuth>
  function Probe() {
    const value = useAuth()
    useEffect(() => { context = value }, [value])
    return null
  }
  const requests: { url?: string; succeed: (name: string) => void; fail: (status: number) => void }[] = []
  const originalAdapter = http.publicApi.defaults.adapter
  http.publicApi.defaults.adapter = (config) => new Promise((resolve, reject) => {
    requests.push({
      url: config.url,
      succeed: (name) => resolve({ config, status: 200, statusText: 'OK', headers: {}, data: {
        accessToken: `access-${name}`, refreshToken: `refresh-${name}`, tokenType: 'Bearer', expiresInSeconds: 3600,
        user: { id: 7, name },
      } }),
      fail: (status) => reject(failure(status)),
    })
  })
  let callback!: (response: { credential: string }) => void
  Object.defineProperty(window, 'google', { configurable: true, value: { accounts: { id: {
    initialize(options: { callback: typeof callback }) { callback = options.callback }, renderButton() {},
  } } } })
  const events = { navigated: 0, errors: [] as string[] }
  const root = createRoot(document.getElementById('root')!)
  t.after(async () => {
    await act(async () => root.unmount())
    Reflect.deleteProperty(window, 'google')
    http.publicApi.defaults.adapter = originalAdapter
    http.clearTokens()
  })
  await act(async () => root.render(
    <AuthProvider><Probe /><GoogleSignIn mode="login" clientId="synthetic-client"
      onSignedIn={() => { events.navigated++ }} onError={(message) => { events.errors.push(message) }} /></AuthProvider>,
  ))
  const script = document.querySelector('script[src^="https://accounts.google.com/gsi/client"]')
  assert.ok(script)
  await act(async () => { script.dispatchEvent(new window.Event('load')) })
  return { requests, events, auth: () => context, google: () => callback({ credential: 'synthetic-token' }), root }
}

for (const obsoleteResponse of ['success', 401, 428] as const) {
  test(`Google reemplazado por contraseña: descarta ${obsoleteResponse} sin navegar ni abrir términos`, async (t) => {
    const app = await mount(t)
    let password!: Promise<boolean>
    await act(async () => { app.google(); password = app.auth().login('test@example.invalid', 'synthetic-password') })
    assert.deepEqual(app.requests.map((request) => request.url), ['/auth/google', '/auth/login'])
    await act(async () => {
      if (obsoleteResponse === 'success') app.requests[0].succeed('obsolete')
      else app.requests[0].fail(obsoleteResponse)
    })
    assert.deepEqual(app.events, { navigated: 0, errors: [] })
    assert.equal(document.querySelector('dialog[open]'), null)
    assert.equal(app.requests.length, 2, 'un 428 obsoleto no inicia la lectura de términos')
    assert.equal(http.getAccessToken(), null)
    assert.equal(app.auth().isAuthenticated, false)
    await act(async () => { app.requests[1].succeed('password'); assert.equal(await password, true) })
    assert.equal(http.getAccessToken(), 'access-password')
    assert.equal(app.auth().user?.name, 'password')
  })
}

test('Una respuesta Google descartada no oculta el error vigente de contraseña', async (t) => {
  const app = await mount(t)
  let password!: Promise<boolean>
  await act(async () => { app.google(); password = app.auth().login('test@example.invalid', 'synthetic-password') })
  await act(async () => { app.requests[0].succeed('obsolete') })
  await act(async () => {
    const rejected = assert.rejects(password, (error: unknown) => {
      assert.equal((error as { response?: { status: number } }).response?.status, 401)
      return true
    })
    app.requests[1].fail(401)
    await rejected
  })
  assert.deepEqual(app.events, { navigated: 0, errors: [] })
  assert.equal(document.querySelector('dialog[open]'), null)
  assert.equal(http.getAccessToken(), null)
})

test('Contraseña reemplazada por Google devuelve false y sólo Google confirma la sesión', async (t) => {
  const app = await mount(t)
  let password!: Promise<boolean>
  await act(async () => { password = app.auth().login('test@example.invalid', 'synthetic-password'); app.google() })
  assert.deepEqual(app.requests.map((request) => request.url), ['/auth/login', '/auth/google'])
  await act(async () => { app.requests[0].succeed('obsolete'); assert.equal(await password, false) })
  assert.equal(http.getAccessToken(), null)
  assert.equal(app.events.navigated, 0)
  await act(async () => { app.requests[1].succeed('google') })
  assert.equal(app.events.navigated, 1)
  assert.equal(app.auth().user?.name, 'google')
})

test('La respuesta Google tardía no reemplaza la sesión de contraseña que ya terminó', async (t) => {
  const app = await mount(t)
  let password!: Promise<boolean>
  await act(async () => { app.google(); password = app.auth().login('test@example.invalid', 'synthetic-password') })
  await act(async () => { app.requests[1].succeed('password'); await password })
  await act(async () => { app.requests[0].succeed('obsolete') })
  assert.equal(http.getAccessToken(), 'access-password')
  assert.equal(app.auth().user?.name, 'password')
  assert.equal(app.events.navigated, 0)
})

test('Cerrar sesión mientras Google espera impide que su respuesta vuelva a autenticar', async (t) => {
  const app = await mount(t)
  await act(async () => { app.google() })
  await act(async () => { await app.auth().logout() })
  await act(async () => { app.requests[0].succeed('obsolete') })
  assert.equal(http.getAccessToken(), null)
  assert.equal(app.auth().isAuthenticated, false)
  assert.equal(app.events.navigated, 0)
})
