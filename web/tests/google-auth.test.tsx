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
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { AuthProvider } = await import('../src/contexts/AuthContext')
const { ThemeProvider } = await import('../src/contexts/ThemeContext')
const { useAuth } = await import('../src/hooks/useAuth')
const { default: LoginPage } = await import('../src/pages/auth/LoginPage')
const { GoogleSignIn } = await import('../src/pages/auth/GoogleSignIn')
import * as http from '../src/services/http'
import type { RegistrationIdentity, TermsAcceptance } from '../src/types/auth'
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

const termsError = (code: 'TERMS_ACCEPTANCE_REQUIRED' | 'TERMS_VERSION_OUTDATED', currentVersion: string) =>
  httpError(428, { code, currentVersion })

test('Cada respuesta del backend tiene un mensaje claro', () => {
  assert.equal(googleErrorMessage(httpError(409)), GOOGLE_PASSWORD_ACCOUNT)
  assert.equal(googleErrorMessage(httpError(409, { code: 'GOOGLE_EMAIL_CONFLICT', message: 'Este correo usa otra cuenta de Google.' })), 'Este correo usa otra cuenta de Google.')
  assert.equal(googleErrorMessage(httpError(401)), GOOGLE_INVALID_TOKEN)
  assert.equal(googleErrorMessage(termsError('TERMS_ACCEPTANCE_REQUIRED', '1.0')), GOOGLE_TERMS_REQUIRED)
  assert.equal(googleErrorMessage(termsError('TERMS_VERSION_OUTDATED', '2.0')), GOOGLE_TERMS_REQUIRED)
  // Mientras el backend no publique /auth/google, se avisa y se ofrece el correo
  assert.equal(googleErrorMessage(httpError(404)), GOOGLE_UNAVAILABLE)
  assert.equal(googleErrorMessage(httpError(503, { code: 'GOOGLE_AUTH_UNAVAILABLE' })), GOOGLE_UNAVAILABLE)
  assert.match(googleErrorMessage(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })), /conectar/)

})

test('completeGoogleSignIn ingresa, informa errores y reintenta tras aceptar los términos', async () => {
  const calls: [string, TermsAcceptance | undefined][] = []
  const ok = async (idToken: string, acceptance?: TermsAcceptance) => { calls.push([idToken, acceptance]); return true }
  assert.deepEqual(await completeGoogleSignIn('tok', ok), { status: 'signed-in' })
  assert.deepEqual(calls, [['tok', undefined]])

  assert.deepEqual(await completeGoogleSignIn(undefined, ok), { status: 'error', message: GOOGLE_INVALID_TOKEN })

  const accept: () => Promise<TermsAcceptance> = async () => ({ termsAccepted: true, termsVersion: '1.0' })
  for (const [error, message] of [
    [httpError(400, { message: 'acceptedTermsVersion debe ser texto' }), 'acceptedTermsVersion debe ser texto'],
    [httpError(400, { code: 'TERMS_ACCEPTANCE_REQUIRED', message: 'El registro requiere aceptación.' }), 'El registro requiere aceptación.'],
    [httpError(404), GOOGLE_UNAVAILABLE],
    [httpError(409), GOOGLE_PASSWORD_ACCOUNT],
    [httpError(428, { currentVersion: '1.0', message: 'Falta otro requisito.' }), 'Falta otro requisito.'],
    [httpError(503), GOOGLE_UNAVAILABLE],
  ] as const) {
    const reject = async () => { throw error }
    const unexpectedReview = async () => assert.fail('Este error no debe abrir los términos')
    assert.deepEqual(await completeGoogleSignIn('tok', reject, unexpectedReview), { status: 'error', message })
  }

  // Cuenta nueva: el backend pide los términos, la persona los acepta y se reintenta con la versión
  const sent: (string | undefined)[] = []
  const newAccount = async (_: string, acceptance?: TermsAcceptance) => {
    sent.push(acceptance?.termsVersion)
    if (!acceptance) throw termsError('TERMS_ACCEPTANCE_REQUIRED', '1.0')
    return true
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

test('Una autenticación descartada cancela Google tanto al ingresar como al reintentar con términos', async () => {
  assert.deepEqual(await completeGoogleSignIn('tok', async () => false), { status: 'cancelled' })
  const superseded = async (_: string, acceptance?: TermsAcceptance) => {
    if (!acceptance) throw termsError('TERMS_ACCEPTANCE_REQUIRED', '1.0')
    return false
  }
  assert.deepEqual(await completeGoogleSignIn('tok', superseded, async () => ({ termsAccepted: true, termsVersion: '1.0' })), { status: 'cancelled' })
})

test('El alta pendiente permite cancelar o reintentar 429, 503 y fallos de conexión únicamente a petición del usuario', async () => {
  const identity = { dni: '01234567', fullName: 'Ana Flores', name: 'Anita' }
  const required = httpError(428, { code: 'REGISTRATION_DETAILS_REQUIRED' })
  for (const retryable of [httpError(429), httpError(503), Object.assign(new Error('Red'), { isAxiosError: true })]) {
    for (const retry of [false, true]) {
      const prompts: unknown[] = []
      let attempts = 0
      const signIn = async (_token: string, _terms?: TermsAcceptance, details?: RegistrationIdentity) => {
        attempts++
        if (!details) throw required
        if (attempts === 2) throw retryable
        assert.deepEqual(details, identity)
        return true
      }
      const result = await completeGoogleSignIn('tok', signIn, undefined, async (error) => {
        prompts.push(error)
        return error && !retry ? null : identity
      })
      assert.deepEqual(prompts, [undefined, retryable])
      assert.equal(attempts, retry ? 3 : 2)
      assert.equal(result.status, retry ? 'signed-in' : 'cancelled')
    }
  }
})

let ctx: ReturnType<typeof useAuth>
function Probe() {
  const value = useAuth()
  useEffect(() => { ctx = value }, [value])
  return null
}

test('loginWithGoogle envía el ID token y sólo adjunta acceptedTermsVersion al confirmar', async (t) => {
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

  await act(async () => {
    await ctx.loginWithGoogle('google-id-token')
    await ctx.loginWithGoogle('google-id-token', { termsAccepted: true, termsVersion: '1.0' })
  })
  assert.deepEqual(requests, [
    { url: '/auth/google', body: { idToken: 'google-id-token' } },
    { url: '/auth/google', body: { idToken: 'google-id-token', acceptedTermsVersion: '1.0' } },
  ])
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

test('El alta Google requiere términos vigentes y conserva los datos al corregir el DNI tras una respuesta tardía', async (t) => {
  http.clearTokens()
  const bodies: Record<string, unknown>[] = []
  const documentsRead: string[] = []
  let version = '1.0'
  let signedIn = 0
  let outerFormSubmits = 0
  let finishContrast: (() => void) | undefined
  const contrastError = 'Revisa el DNI y los nombres ingresados.'
  const errors: string[] = []
  const data = { accessToken: 'A1', refreshToken: 'R1', tokenType: 'Bearer', expiresInSeconds: 3600, user: { id: 7, name: 'Ana' } }
  http.publicApi.defaults.adapter = async (config) => {
    if (config.url === '/auth/terms') {
      documentsRead.push(version)
      return {
        status: 200, statusText: 'OK', data: { version, text: `TÉRMINOS DE YUYAY\nVersión ${version}\nDocumento de prueba` }, headers: {}, config,
      }
    }
    assert.equal(config.url, '/auth/google')
    const body = JSON.parse(config.data)
    bodies.push(body)
    if (!body.acceptedTermsVersion) throw termsError('TERMS_ACCEPTANCE_REQUIRED', version)
    if (version === '1.0') version = '2.0'
    if (body.acceptedTermsVersion !== version) throw termsError('TERMS_VERSION_OUTDATED', version)
    if (!body.dni) throw httpError(428, { code: 'REGISTRATION_DETAILS_REQUIRED' })
    if (body.dni === '11111111') {
      await new Promise<void>((resolve) => { finishContrast = resolve })
      throw httpError(400, { fieldErrors: [{ field: 'dni', message: contrastError }] })
    }
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
      <form onSubmit={(event) => { event.preventDefault(); outerFormSubmits++ }}>
        <GoogleSignIn mode="register" clientId="oauth-client-test" onSignedIn={() => { signedIn += 1 }} onError={(message) => errors.push(message)} />
      </form>
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
  async function type(id: string, value: string) {
    const input = document.getElementById(id) as HTMLInputElement | null
    assert.ok(input)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
    })
    return input
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
  assert.deepEqual(bodies, [{ idToken }, { idToken, acceptedTermsVersion: '1.0' }])
  assert.deepEqual(documentsRead, ['1.0', '2.0'])
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
    { idToken, acceptedTermsVersion: '1.0' },
    { idToken },
    { idToken, acceptedTermsVersion: '2.0' },
  ])
  assert.match(dialog()?.textContent ?? '', /Completa tu cuenta/)
  assert.doesNotMatch(dialog()?.textContent ?? '', /Ver mi nombre|Sí, soy yo/)
  assert.equal(signedIn, 0)
  await click(button('Crear cuenta con Google'))
  assert.match(dialog()?.textContent ?? '', /8 dígitos/)
  assert.equal(bodies.length, 4)
  await type('google-signup-dni', '11111111')
  const fullName = await type('google-signup-full-name', 'Ana Flores')
  const alias = await type('google-signup-name', 'Anita')
  const submit = button('Crear cuenta con Google')
  assert.ok(submit)
  await act(async () => { submit.click(); submit.click(); triggerGoogle?.({ credential: idToken }) })
  assert.equal(bodies.length, 5)
  assert.equal(submit.disabled, true)
  assert.ok(finishContrast)
  await act(async () => { finishContrast?.() })
  assert.match(dialog()?.textContent ?? '', new RegExp(contrastError))
  assert.equal(document.activeElement?.id, 'google-signup-dni')
  assert.equal(fullName.value, 'Ana Flores')
  assert.equal(alias.value, 'Anita')
  await type('google-signup-dni', '01234567')
  await click(button('Crear cuenta con Google'))
  assert.deepEqual(bodies.slice(4), [
    { idToken, acceptedTermsVersion: '2.0', dni: '11111111', fullName: 'Ana Flores', name: 'Anita' },
    { idToken, acceptedTermsVersion: '2.0', dni: '01234567', fullName: 'Ana Flores', name: 'Anita' },
  ])
  assert.equal(dialog(), null)
  assert.equal(outerFormSubmits, 0)
  assert.equal(signedIn, 1)
  assert.equal(http.getAccessToken(), 'A1')
  assert.deepEqual(errors, [])
})
