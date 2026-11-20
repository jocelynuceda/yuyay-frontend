// Ingreso y alta con Google en la web: el ID token de Google se cambia por la sesión normal de Yuyay.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import assert from 'node:assert/strict'
import test from 'node:test'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../src/contexts/AuthContext'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import { useAuth } from '../src/hooks/useAuth'
import LoginPage from '../src/pages/auth/LoginPage'
import { GoogleSignIn } from '../src/pages/auth/GoogleSignIn'
import * as http from '../src/services/http'
import {
  completeGoogleSignIn,
  GOOGLE_INVALID_TOKEN,
  GOOGLE_PASSWORD_ACCOUNT,
  GOOGLE_TERMS_REQUIRED,
  GOOGLE_UNAVAILABLE,
  googleErrorMessage,
  googleTermsRequired,
} from '../src/utils/googleAuth'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}
Object.assign(globalThis, { sessionStorage: new MemoryStorage(), localStorage: new MemoryStorage() })

const httpError = (status: number, data: Record<string, unknown> = {}) => Object.assign(new Error(`HTTP ${status}`), {
  isAxiosError: true,
  response: { status, data, headers: {}, config: {} },
})

test('Cada respuesta del backend tiene un mensaje claro', () => {
  assert.equal(googleErrorMessage(httpError(409)), GOOGLE_PASSWORD_ACCOUNT)
  assert.equal(googleErrorMessage(httpError(401)), GOOGLE_INVALID_TOKEN)
  assert.equal(googleErrorMessage(httpError(400)), GOOGLE_INVALID_TOKEN)
  assert.equal(googleErrorMessage(httpError(428)), GOOGLE_TERMS_REQUIRED)
  // Mientras el backend no publique /auth/google, se avisa y se ofrece el correo
  assert.equal(googleErrorMessage(httpError(404)), GOOGLE_UNAVAILABLE)
  assert.match(googleErrorMessage(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })), /conectar/)

  assert.deepEqual(googleTermsRequired(httpError(428, { currentVersion: '2026-11' })), { currentVersion: '2026-11' })
  assert.deepEqual(googleTermsRequired(httpError(428)), { currentVersion: null })
  assert.equal(googleTermsRequired(httpError(409)), null)
})

test('completeGoogleSignIn ingresa, informa errores y reintenta una vez tras aceptar los términos', async () => {
  const calls: (string | undefined)[][] = []
  const ok = async (idToken: string, version?: string) => { calls.push([idToken, version]) }
  assert.deepEqual(await completeGoogleSignIn('tok', ok), { status: 'signed-in' })
  assert.deepEqual(calls, [['tok', undefined]])

  assert.deepEqual(await completeGoogleSignIn(undefined, ok), { status: 'error', message: GOOGLE_INVALID_TOKEN })

  const conflict = async () => { throw httpError(409) }
  assert.deepEqual(await completeGoogleSignIn('tok', conflict, async () => 'v1'), { status: 'error', message: GOOGLE_PASSWORD_ACCOUNT })

  // Cuenta nueva: el backend pide los términos, la persona los acepta y se reintenta con la versión
  const sent: (string | undefined)[] = []
  const newAccount = async (_: string, version?: string) => {
    sent.push(version)
    if (!version) throw httpError(428, { currentVersion: '2026-11' })
  }
  const asked: (string | null)[] = []
  const accept = async (current: string | null) => { asked.push(current); return current }
  assert.deepEqual(await completeGoogleSignIn('tok', newAccount, accept), { status: 'signed-in' })
  assert.deepEqual(sent, [undefined, '2026-11'])
  assert.deepEqual(asked, ['2026-11'])

  // Si cancela los términos no se crea la cuenta ni se muestra un error
  sent.length = 0
  assert.deepEqual(await completeGoogleSignIn('tok', newAccount, async () => null), { status: 'cancelled' })
  assert.deepEqual(sent, [undefined])

  // Sin modal de términos todavía, se explica por qué no se creó la cuenta
  assert.deepEqual(await completeGoogleSignIn('tok', newAccount), { status: 'error', message: GOOGLE_TERMS_REQUIRED })
})

let ctx: ReturnType<typeof useAuth>
function Probe() {
  const value = useAuth()
  useEffect(() => { ctx = value }, [value])
  return null
}

test('loginWithGoogle envía el ID token a /auth/google y abre la sesión de Yuyay', async (t) => {
  http.clearTokens()
  const requests: { url?: string; body: unknown }[] = []
  http.publicApi.defaults.adapter = async (config) => {
    requests.push({ url: config.url, body: JSON.parse(config.data) })
    const data = { accessToken: 'A1', refreshToken: 'R1', tokenType: 'Bearer', expiresInSeconds: 3600, user: { id: 7, name: 'Ana' } }
    return { status: 200, statusText: 'OK', data, headers: {}, config }
  }
  const root = createRoot(document.getElementById('root')!)
  t.after(async () => { await act(async () => root.unmount()); http.clearTokens() })
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>))

  await act(async () => { await ctx.loginWithGoogle('google-id-token', '2026-11') })
  assert.deepEqual(requests, [{ url: '/auth/google', body: { idToken: 'google-id-token', acceptedTermsVersion: '2026-11' } }])
  assert.equal(ctx.user?.name, 'Ana')
  assert.equal(http.getAccessToken(), 'A1')
  assert.equal(http.getRefreshToken(), 'R1')
})

test('Sin ID de cliente configurado no aparece Google y el acceso con correo sigue igual', async (t) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  const noop = () => {}

  await act(async () => root.render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
          <GoogleSignIn mode="register" clientId="" onSignedIn={noop} onError={noop} />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  ))
  assert.doesNotMatch(container.textContent ?? '', /o con tu correo/)
  assert.ok(container.querySelector('input[type="email"]'))
  assert.match(container.textContent ?? '', /Entrar/)
})
