// Ingreso y alta con Google en la web: el ID token de Google se cambia por la sesión normal de Yuyay.
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
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../src/contexts/AuthContext'
import { ThemeProvider } from '../src/contexts/ThemeContext'
import { useAuth } from '../src/hooks/useAuth'
import LoginPage from '../src/pages/auth/LoginPage'
import { GoogleSignIn } from '../src/pages/auth/GoogleSignIn'
import * as http from '../src/services/http'
import type { TermsAcceptance } from '../src/types/auth'
import {
  completeGoogleSignIn,
  GOOGLE_INVALID_TOKEN,
  GOOGLE_PASSWORD_ACCOUNT,
  GOOGLE_TERMS_REQUIRED,
  GOOGLE_UNAVAILABLE,
  googleErrorMessage,
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
  assert.equal(googleErrorMessage(httpError(409, { code: 'GOOGLE_EMAIL_CONFLICT', message: 'Este correo usa otra cuenta de Google.' })), 'Este correo usa otra cuenta de Google.')
  assert.equal(googleErrorMessage(httpError(401)), GOOGLE_INVALID_TOKEN)
  assert.equal(googleErrorMessage(httpError(400, { code: 'TERMS_ACCEPTANCE_REQUIRED' })), GOOGLE_TERMS_REQUIRED)
  assert.equal(googleErrorMessage(httpError(400, { code: 'TERMS_VERSION_OUTDATED' })), GOOGLE_TERMS_REQUIRED)
  // Mientras el backend no publique /auth/google, se avisa y se ofrece el correo
  assert.equal(googleErrorMessage(httpError(404)), GOOGLE_UNAVAILABLE)
  assert.equal(googleErrorMessage(httpError(503, { code: 'GOOGLE_AUTH_UNAVAILABLE' })), GOOGLE_UNAVAILABLE)
  assert.match(googleErrorMessage(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })), /conectar/)

})

test('completeGoogleSignIn ingresa, informa errores y reintenta tras aceptar los términos', async () => {
  const calls: [string, TermsAcceptance | undefined][] = []
  const ok = async (idToken: string, acceptance?: TermsAcceptance) => { calls.push([idToken, acceptance]) }
  assert.deepEqual(await completeGoogleSignIn('tok', ok), { status: 'signed-in' })
  assert.deepEqual(calls, [['tok', undefined]])

  assert.deepEqual(await completeGoogleSignIn(undefined, ok), { status: 'error', message: GOOGLE_INVALID_TOKEN })

  const conflict = async () => { throw httpError(409) }
  const accept: () => Promise<TermsAcceptance> = async () => ({ termsAccepted: true, termsVersion: '1.0' })
  assert.deepEqual(await completeGoogleSignIn('tok', conflict, accept), { status: 'error', message: GOOGLE_PASSWORD_ACCOUNT })

  // Cuenta nueva: el backend pide los términos, la persona los acepta y se reintenta con la versión
  const sent: (string | undefined)[] = []
  const newAccount = async (_: string, acceptance?: TermsAcceptance) => {
    sent.push(acceptance?.termsVersion)
    if (!acceptance) throw httpError(400, { code: 'TERMS_ACCEPTANCE_REQUIRED' })
  }
  assert.deepEqual(await completeGoogleSignIn('tok', newAccount, accept), { status: 'signed-in' })
  assert.deepEqual(sent, [undefined, '1.0'])

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

  await act(async () => { await ctx.loginWithGoogle('google-id-token', { termsAccepted: true, termsVersion: '1.0' }) })
  assert.deepEqual(requests, [{ url: '/auth/google', body: { idToken: 'google-id-token', termsAccepted: true, termsVersion: '1.0' } }])
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

test('Google solicita los términos vigentes, cancela sin crear la cuenta y vuelve a pedir aceptación si cambian', async (t) => {
  http.clearTokens()
  const bodies: Record<string, unknown>[] = []
  let version = '1.0'
  let signedIn = 0
  const errors: string[] = []
  const data = { accessToken: 'A1', refreshToken: 'R1', tokenType: 'Bearer', expiresInSeconds: 3600, user: { id: 7, name: 'Ana' } }
  http.publicApi.defaults.adapter = async (config) => {
    if (config.url === '/auth/terms') return {
      status: 200, statusText: 'OK', data: { version, text: `TÉRMINOS DE YUYAY\nVersión ${version}\nDocumento de prueba` }, headers: {}, config,
    }
    assert.equal(config.url, '/auth/google')
    const body = JSON.parse(config.data)
    bodies.push(body)
    if (!body.termsAccepted) throw httpError(400, { code: 'TERMS_ACCEPTANCE_REQUIRED' })
    if (version === '1.0') version = '2.0'
    if (body.termsVersion !== version) throw httpError(400, { code: 'TERMS_VERSION_OUTDATED' })
    return { status: 200, statusText: 'OK', data, headers: {}, config }
  }

  let triggerGoogle: ((response: { credential: string }) => void) | undefined
  Object.defineProperty(window, 'google', {
    configurable: true,
    value: {
      accounts: { id: {
        initialize({ callback }: { callback: typeof triggerGoogle }) { triggerGoogle = callback },
        renderButton() {},
      } },
    },
  })
  const root = createRoot(document.getElementById('root')!)
  t.after(async () => {
    await act(async () => root.unmount())
    Reflect.deleteProperty(window, 'google')
    http.clearTokens()
  })
  await act(async () => root.render(
    <AuthProvider>
      <GoogleSignIn mode="register" clientId="oauth-client-test" onSignedIn={() => { signedIn += 1 }} onError={(message) => errors.push(message)} />
    </AuthProvider>,
  ))
  const script = document.querySelector('script[src^="https://accounts.google.com/gsi/client"]')
  assert.ok(script)
  await act(async () => { script.dispatchEvent(new window.Event('load')) })
  assert.ok(triggerGoogle)
  const idToken = 'token-sintetico'
  const start = () => act(async () => {
    triggerGoogle?.({ credential: idToken })
    triggerGoogle?.({ credential: idToken })
  })
  const dialog = () => document.querySelector('dialog[open]')
  const checkbox = () => dialog()?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  const button = (label: string) => [...(dialog()?.querySelectorAll('button') ?? [])].find((element) => element.textContent?.trim() === label)
  async function click(element: HTMLElement | undefined) {
    assert.ok(element)
    await act(async () => element.click())
  }

  await start()
  assert.equal(bodies.length, 1, 'ignora credenciales duplicadas mientras hay un intento en curso')
  assert.match(dialog()?.textContent ?? '', /Versión 1\.0/)
  assert.equal(checkbox()?.checked, false)
  assert.equal(button('Continuar con Google')?.disabled, true)
  await click(checkbox())
  await click(button('Continuar con Google'))
  assert.match(dialog()?.textContent ?? '', /Versión 2\.0/)
  assert.equal(checkbox()?.checked, false)
  assert.equal(button('Continuar con Google')?.disabled, true)
  await click(checkbox())
  await click(button('Cancelar'))
  assert.equal(dialog(), null)
  assert.deepEqual(bodies, [{ idToken }, { idToken, termsAccepted: true, termsVersion: '1.0' }])
  assert.equal(signedIn, 0)
  assert.equal(http.getAccessToken(), null)

  await start()
  assert.match(dialog()?.textContent ?? '', /Versión 2\.0/)
  assert.equal(checkbox()?.checked, false)
  assert.equal(button('Continuar con Google')?.disabled, true)
  await click(checkbox())
  await click(button('Continuar con Google'))
  assert.deepEqual(bodies, [
    { idToken },
    { idToken, termsAccepted: true, termsVersion: '1.0' },
    { idToken },
    { idToken, termsAccepted: true, termsVersion: '2.0' },
  ])
  assert.equal(signedIn, 1)
  assert.equal(http.getAccessToken(), 'A1')
  assert.deepEqual(errors, [])
})
