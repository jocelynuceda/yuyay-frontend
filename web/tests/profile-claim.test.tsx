import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { beforeEach, afterEach, type TestContext } from 'node:test'
import { act, type ReactNode } from 'react'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthContextValue } from '../src/contexts/auth-context'
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, BrowserRouter, Routes, Route, Link } = await import('react-router-dom')
const { AuthContext } = await import('../src/contexts/auth-context')
const { AuthProvider } = await import('../src/contexts/AuthContext')
const { ThemeProvider } = await import('../src/contexts/ThemeContext')
const { ProfileClaimPanel } = await import('../src/pages/claims/ProfileClaimPanel')
const { ProfileClaimPage } = await import('../src/pages/claims/ProfileClaimPage')
const { default: AppRoutes } = await import('../src/routes/AppRoutes')
const { api, publicApi, clearTokens } = await import('../src/services/http')
const claim = await import('../src/utils/profileClaim')
const { getPostLoginTarget } = await import('../src/utils/redirect')

const user = { id: 71, name: 'Cuenta ficticia QA', email: 'qa@example.invalid', role: 'USER' as const, createdAt: '2026-01-01T00:00:00Z' }
const authResponse = { user, accessToken: 'access-ficticio', refreshToken: 'refresh-ficticio', tokenType: 'Bearer', expiresInSeconds: 900 }
const subject = { id: 5, name: 'Persona ficticia QA', birthDate: '2000-01-01', notes: null, createdAt: '2026-01-01T00:00:00Z', myRole: 'PRINCIPAL' as const }
const policy = { textVersion: '1', thirdPartyQuestion: '', options: [{ type: 'SELF', label: 'Este perfil es para mí.',
  description: 'Decidiré sobre mis datos.', scope: 'OWN_DATA', confirmationText: 'Confirmo que este perfil corresponde a mi persona.' }] }
const invitation = { id: 9, careSubjectId: 5, invitedEmail: 'titular@example.invalid', validUntil: '2099-01-01T00:00:00Z',
  exchangedAt: null as string | null, revokedAt: null as string | null, pending: true }
const result = { careSubjectId: 5, name: 'Persona ficticia QA', role: 'PRINCIPAL' as const, claimedAt: '2026-11-27T12:00:00Z' }
const secret = 'llave-ficticia-no-publicar-123456789'
const previousApi = api.defaults.adapter, previousPublic = publicApi.defaults.adapter
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
const failure = (config: InternalAxiosRequestConfig, status: number, message = 'El enlace ya fue utilizado') =>
  new AxiosError('Error técnico que no debe mostrarse', '', config, undefined, { ...ok(config, { message }), status })

beforeEach(() => {
  clearTokens()
  claim.forgetClaimAttempts(user.id)
  claim.clearClaimToken()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  api.defaults.adapter = previousApi
  publicApi.defaults.adapter = previousPublic
  claim.forgetClaimAttempts(user.id)
  claim.clearClaimToken()
  clearTokens()
})

function authenticated(): AuthContextValue {
  return { user, isAuthenticated: true, isLoading: false, restoreError: null, retryRestore: async () => {},
    login: async () => true, register: async () => true, loginWithGoogle: async () => true, logout: async () => {}, updateUser: () => {} }
}
async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(node))
  return container
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.ok(check(), 'El estado esperado debe aparecer')
}
async function click(node: ParentNode, text: string) {
  const button = [...node.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)
  assert.ok(button, text)
  await act(async () => button.click())
}
async function link(node: ParentNode, text: string) {
  const anchor = [...node.querySelectorAll('a')].find((item) => item.textContent?.trim() === text)
  assert.ok(anchor, text)
  await act(async () => anchor.click())
}
async function fill(node: ParentNode, selector: string, value: string) {
  const input = node.querySelector<HTMLInputElement>(selector)!
  assert.ok(input, selector)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function check(node: ParentNode) {
  const box = node.querySelector<HTMLInputElement>('input[type=checkbox]')!
  assert.ok(box)
  await act(async () => box.click())
}

test('el arranque elimina el token antes de recursos externos y no lo persiste', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const page = new JSDOM(html, { url: 'http://localhost/entrega/' + secret, runScripts: 'dangerously' })
  assert.equal(page.window.location.pathname, '/entrega')
  assert.equal((page.window as Window).__yuyayClaimToken, secret)
  assert.equal(page.window.history.state, null)
  assert.equal('claimMatch' in page.window, false)
  assert.equal(page.window.localStorage.length, 0)
  assert.equal(page.window.sessionStorage.length, 0)
  assert.equal(page.window.document.querySelector('meta[name=referrer]')?.getAttribute('content'), 'no-referrer')
  page.window.close()
})

test('solo se admiten redirecciones internas y se conserva la ruta de entrega', () => {
  assert.equal(getPostLoginTarget({ from: { pathname: '/entrega' } }), '/entrega')
  for (const pathname of ['//externo.invalid', '/\\externo.invalid', '/\texterno.invalid', 'https://externo.invalid', '/login', '/a/../login']) {
    assert.equal(getPostLoginTarget({ from: { pathname } }), '/')
  }
})

test('ruta pública: permite login y registro, vuelve al canje y no transfiere automáticamente', async (t) => {
  const posts: string[] = []
  api.defaults.adapter = publicApi.defaults.adapter = async (config) => {
    if (config.method === 'post') posts.push(config.url!)
    if (config.url === '/auth/login') return ok(config, authResponse)
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    throw new Error('Solicitud inesperada')
  }
  const node = await mount(t, <ThemeProvider><AuthProvider><MemoryRouter initialEntries={['/entrega/' + secret]}>
    <AppRoutes />
  </MemoryRouter></AuthProvider></ThemeProvider>)
  await until(() => node.textContent?.includes('Recibir mi perfil') ?? false)
  assert.equal(posts.length, 0)
  assert.equal(node.textContent?.includes(secret), false)
  await link(node, 'Iniciar sesión')
  await until(() => !!node.querySelector('#auth-email'))
  await link(node, 'Regístrate')
  await until(() => !!node.querySelector('#auth-name'))
  await link(node, 'Inicia sesión')
  await until(() => !!node.querySelector('#auth-email'))
  await fill(node, '#auth-email', user.email)
  await fill(node, '#auth-password', 'Ficticia123')
  await click(node, 'Entrar')
  await until(() => node.textContent?.includes('Sesión actual:') ?? false)
  assert.equal(node.textContent?.includes('Recibir mi perfil'), true)
  assert.deepEqual(posts, ['/auth/login'])
  assert.equal(Object.keys(window.localStorage).filter((key) => key.startsWith('yuyay.claim-check.')).length, 0)
})

test('emite, reemite y revoca desde Cuidadores sin mostrar la llave de entrega', async (t) => {
  let invitations: typeof invitation[] = []
  const emitted: unknown[] = []
  const revoked: string[] = []
  api.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/authorization-declarations')) return ok(config, [{ type: 'LEGAL_REPRESENTATION' }])
    if (config.method === 'delete') { revoked.push(config.url!); invitations = invitations.map((item) => ({ ...item, revokedAt: '2026-11-27T00:00:00Z', pending: false })); return ok(config, null) }
    if (config.method === 'post') { emitted.push(JSON.parse(config.data)); invitations = [{ ...invitation }]; return ok(config, invitation) }
    return ok(config, invitations)
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-email'))
  await fill(node, '#claim-email', invitation.invitedEmail)
  await check(node)
  await click(node, 'Enviar invitación de entrega')
  await until(() => node.textContent?.includes('Invitación emitida.') ?? false)
  assert.deepEqual(emitted, [{ invitedEmail: invitation.invitedEmail }])
  assert.equal(node.textContent?.includes(secret), false)
  await click(node, 'Revocar invitación')
  const dialog = node.querySelector('dialog')!
  await click(dialog, 'Revocar invitación')
  await until(() => node.textContent?.includes('Invitación revocada.') ?? false)
  assert.deepEqual(revoked, ['/care-subjects/5/claim-invitations/9'])
  await click(node, 'Preparar nueva invitación')
  assert.equal(node.querySelector<HTMLInputElement>('#claim-email')?.value, invitation.invitedEmail)
  assert.equal(node.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked, false)
  await check(node)
  await click(node, 'Enviar invitación de entrega')
  assert.equal(emitted.length, 2)
})

test('el contraste es informativo, retira el DNI y nunca afirma verificar identidad o edad', async (t) => {
  api.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/identity-check')) { assert.deepEqual(JSON.parse(config.data), { dni: '00000000' }); return ok(config, { result: 'MISMATCH', checkedAt: '2026-11-27T00:00:00Z' }) }
    return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : [])
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-dni'))
  await fill(node, '#claim-dni', '00000000')
  await click(node, 'Contrastar nombre')
  assert.equal(node.querySelector<HTMLInputElement>('#claim-dni')?.value, '')
  assert.match(node.textContent!, /El nombre no coincide/)
  assert.match(node.textContent!, /No acredita identidad ni verifica edad/)
})

test('solo principal ve la gestión y un perfil ficticio no ofrece emisión', async (t) => {
  let reads = 0
  api.defaults.adapter = async (config) => { reads++; return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'FICTITIOUS' }] : []) }
  const caregiver = await mount(t, <ProfileClaimPanel subject={{ ...subject, myRole: 'CAREGIVER' }} onChanged={() => {}} />)
  assert.equal(caregiver.textContent, '')
  assert.equal(reads, 0)
  const principal = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => principal.textContent?.includes('Un perfil declarado ficticio') ?? false)
  assert.equal(principal.querySelector('#claim-email'), null)
})

test('canje explícito envía únicamente token y muestra el rol devuelto por el servidor', async (t) => {
  claim.rememberClaimToken(secret)
  const bodies: unknown[] = []
  let complete!: (value: any) => void
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') { bodies.push(JSON.parse(config.data)); return new Promise((resolve) => { complete = (data) => resolve(ok(config, data)) }) }
    return ok(config, policy)
  }
  const node = await mount(t, <AuthContext.Provider value={authenticated()}><MemoryRouter><ProfileClaimPage /></MemoryRouter></AuthContext.Provider>)
  await until(() => !!node.querySelector('input[type=checkbox]'))
  assert.equal(bodies.length, 0)
  await check(node)
  const button = [...node.querySelectorAll('button')].find((item) => item.textContent?.includes('Confirmar y recibir'))!
  await act(async () => { button.click(); button.click() })
  assert.deepEqual(bodies, [{ token: secret }])
  await act(async () => complete(result))
  assert.match(node.textContent!, /Ya administras tu perfil/)
  assert.match(node.textContent!, /titular y cuidador principal/)
  assert.equal(node.querySelector('a[href="/people/5?tab=caregivers"]')?.textContent, 'Abrir mi perfil y revisar cuidadores')
  assert.equal(node.textContent?.includes(secret), false)
})

for (const status of [403, 404, 409]) {
  test('canje rechazado ' + status + ' no expone información del perfil ni repite la operación', async (t) => {
    claim.rememberClaimToken(secret)
    let writes = 0
    api.defaults.adapter = async (config) => {
      if (config.method === 'post') { writes++; throw failure(config, status, 'Enlace usado: ' + secret) }
      return ok(config, policy)
    }
    const node = await mount(t, <AuthContext.Provider value={authenticated()}><MemoryRouter><ProfileClaimPage /></MemoryRouter></AuthContext.Provider>)
    await until(() => !!node.querySelector('input[type=checkbox]'))
    await check(node)
    await click(node, 'Confirmar y recibir mi perfil')
    assert.equal(writes, 1)
    assert.ok(node.querySelector('[role=alert]'))
    assert.equal(node.textContent?.includes(secret), false)
    assert.equal(node.textContent?.includes(subject.name), false)
    assert.equal(node.querySelector('input[type=checkbox]'), null)
  })
}

test('canje incierto conserva la protección al salir por enlace y volver con Atrás', async (t) => {
  claim.rememberClaimToken(secret)
  let writes = 0
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') { writes++; throw new AxiosError('Respuesta perdida', 'ERR_NETWORK', config) }
    return ok(config, policy)
  }
  window.history.replaceState(null, '', '/entrega')
  const node = await mount(t, <AuthContext.Provider value={authenticated()}><BrowserRouter><Routes>
    <Route path="/entrega" element={<ProfileClaimPage />} />
    <Route path="/people" element={<Link to="/entrega">Volver a la entrega</Link>} />
  </Routes></BrowserRouter></AuthContext.Provider>)
  await until(() => !!node.querySelector('input[type=checkbox]'))
  await check(node)
  await click(node, 'Confirmar y recibir mi perfil')
  assert.match(node.textContent!, /No sabemos si se completó/)
  await link(node, 'Comprobar mis personas')
  await act(async () => window.history.back())
  await until(() => node.textContent?.includes('No sabemos si se completó') ?? false)
  assert.equal(writes, 1)
  assert.equal(node.querySelector('input[type=checkbox]'), null)
  const markers = Object.keys(window.localStorage).filter((key) => key.startsWith('yuyay.claim-check.v1.'))
  assert.equal(markers.length, 1)
  assert.equal(window.localStorage.getItem(markers[0]), '1')
  assert.equal(markers[0].includes(secret), false)
  assert.equal(markers[0].includes(user.email), false)
})

test('resultado incierto de servidor 500 no permite otro canje aunque se invoque de nuevo', async () => {
  const config = { headers: {} } as InternalAxiosRequestConfig
  let writes = 0
  const model = claim.createClaimAttempt(async () => { writes++; throw failure(config, 500) }, secret)
  await model.submit()
  await model.submit()
  assert.equal(model.getSnapshot().phase, 'uncertain')
  assert.equal(writes, 1)
  model.dispose()
})

test('la ruta sin token orienta a revisar las personas y volver al correo sin consultar datos privados', async (t) => {
  let requests = 0
  api.defaults.adapter = async (config) => { requests++; return ok(config, {}) }
  const node = await mount(t, <AuthContext.Provider value={authenticated()}><MemoryRouter><ProfileClaimPage /></MemoryRouter></AuthContext.Provider>)
  assert.match(node.textContent!, /Vuelve a abrir el enlace del correo/)
  assert.equal(requests, 0)
})

test('registro desde la entrega conserva el destino después de aceptar los términos de prueba', async (t) => {
  claim.rememberClaimToken(secret)
  const writes: string[] = []
  api.defaults.adapter = publicApi.defaults.adapter = async (config) => {
    if (config.method === 'post') writes.push(config.url!)
    if (config.url === '/auth/register') return ok(config, authResponse)
    if (config.url === '/auth/terms') return ok(config, { version: '1.0', text: 'Términos de prueba\nContenido enteramente ficticio.' })
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    throw new Error('Solicitud inesperada')
  }
  const node = await mount(t, <ThemeProvider><AuthProvider><MemoryRouter initialEntries={['/entrega']}>
    <AppRoutes />
  </MemoryRouter></AuthProvider></ThemeProvider>)
  await until(() => node.textContent?.includes('Crear una cuenta') ?? false)
  await link(node, 'Crear una cuenta')
  await until(() => !!node.querySelector('#auth-name'))
  await fill(node, '#auth-name', user.name)
  await fill(node, '#auth-email', user.email)
  await fill(node, '#auth-password', 'Ficticia123')
  await fill(node, '#auth-confirm', 'Ficticia123')
  await click(node, 'Leer los términos de uso y el aviso de privacidad')
  await until(() => node.textContent?.includes('Contenido enteramente ficticio.') ?? false)
  const close = node.querySelector<HTMLButtonElement>('button[aria-label=Cerrar]')!
  await act(async () => close.click())
  await check(node)
  await click(node, 'Registrarme')
  await until(() => node.textContent?.includes('Sesión actual:') ?? false)
  assert.deepEqual(writes, ['/auth/register'])
})

test('las condiciones configurables se deciden en el servidor y se conserva el correo tras su rechazo', async (t) => {
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') throw failure(config, 409, 'Este perfil no cumple la edad mínima configurada.')
    return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : [])
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-email'))
  await fill(node, '#claim-email', invitation.invitedEmail)
  await check(node)
  await click(node, 'Enviar invitación de entrega')
  assert.match(node.querySelector('[role=alert]')?.textContent ?? '', /edad mínima configurada/)
  assert.equal(node.querySelector<HTMLInputElement>('#claim-email')?.value, invitation.invitedEmail)
})

test('un fieldError de emisión queda junto al campo, sin perder el correo', async (t) => {
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') throw new AxiosError('Axios técnico', '', config, undefined, { ...ok(config, {
      message: 'Datos inválidos', fieldErrors: [{ field: 'invitedEmail', message: 'Revisa el correo destinatario.' }],
    }), status: 400 })
    return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : [])
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-email'))
  await fill(node, '#claim-email', invitation.invitedEmail)
  await check(node)
  await click(node, 'Enviar invitación de entrega')
  assert.equal(node.querySelector('#claim-email-error')?.textContent, 'Revisa el correo destinatario.')
  assert.equal(node.querySelector<HTMLInputElement>('#claim-email')?.value, invitation.invitedEmail)
})

test('una emisión incierta no permite repetir antes de consultar el historial', async (t) => {
  let writes = 0
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') { writes++; throw new AxiosError('Respuesta perdida', 'ERR_NETWORK', config) }
    return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : [])
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-email'))
  await fill(node, '#claim-email', invitation.invitedEmail)
  await check(node)
  await click(node, 'Enviar invitación de entrega')
  await click(node, 'Enviar invitación de entrega')
  assert.equal(writes, 1)
  assert.match(node.textContent!, /No se pudo confirmar la emisión/)
  await click(node, 'Actualizar estado y permisos')
  await until(() => {
    const button = node.querySelector<HTMLButtonElement>('button[type=submit]')
    return !!button && !button.disabled
  })
})

test('al volver a la ventana se consultan el estado de entrega y los permisos del perfil', async (t) => {
  let refreshes = 0
  let reads = 0
  api.defaults.adapter = async (config) => { reads++; return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : []) }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => { refreshes++ }} />)
  await until(() => !!node.querySelector('#claim-email'))
  const initialReads = reads
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  assert.equal(refreshes, 1)
  assert.ok(reads > initialReads)
})

test('la incertidumbre de una cuenta no bloquea la invitación de otra cuenta', async (t) => {
  const config = { headers: {} } as InternalAxiosRequestConfig
  const pending = claim.acquireClaimAttempt(user.id, secret, async () => { throw new AxiosError('Respuesta perdida', 'ERR_NETWORK', config) })
  await pending.initialized
  await pending.submit()
  claim.forgetClaimAttempts(user.id)
  const other = { ...user, id: 72, email: 'otra-cuenta@example.invalid' }
  t.after(() => claim.forgetClaimAttempts(other.id))
  claim.rememberClaimToken('otra-invitacion-ficticia-para-revision')
  api.defaults.adapter = async (request) => ok(request, policy)
  const node = await mount(t, <AuthContext.Provider value={{ ...authenticated(), user: other }}><MemoryRouter><ProfileClaimPage /></MemoryRouter></AuthContext.Provider>)
  await until(() => node.textContent?.includes('Sesión actual:') === true || node.textContent?.includes('Una entrega anterior') === true)
  assert.match(node.textContent!, /Sesión actual:/, 'Otra cuenta e invitación deben continuar sin heredar el indicador ajeno')
})

test('se puede cerrar una incertidumbre revisada sin volver a enviar el canje', async (t) => {
  claim.rememberClaimToken(secret)
  let posts = 0
  api.defaults.adapter = async (config) => {
    if (config.method === 'post') { posts++; throw new AxiosError('Respuesta perdida', 'ERR_NETWORK', config) }
    return ok(config, policy)
  }
  const node = await mount(t, <AuthContext.Provider value={authenticated()}><MemoryRouter initialEntries={['/entrega']}><Routes>
    <Route path="/entrega" element={<ProfileClaimPage />} />
    <Route path="/people" element={<Link to="/entrega">Volver a la entrega</Link>} />
  </Routes></MemoryRouter></AuthContext.Provider>)
  await until(() => !!node.querySelector('input[type=checkbox]'))
  await check(node)
  await click(node, 'Confirmar y recibir mi perfil')
  await link(node, 'Comprobar mis personas')
  await link(node, 'Volver a la entrega')
  await click(node, 'Ya comprobé mis personas; cerrar revisión')
  assert.match(node.textContent!, /Revisión cerrada/)
  assert.equal(posts, 1)
  assert.equal(Object.keys(window.localStorage).filter((key) => key.startsWith('yuyay.claim-')).length, 0)
})

test('otra invitación de la misma cuenta no hereda ni limpia la incertidumbre pendiente', async () => {
  const fail = async () => { throw new AxiosError('Sin respuesta', 'ERR_NETWORK') }
  const first = claim.acquireClaimAttempt(user.id, secret, fail)
  await first.initialized
  await first.submit()
  const keys = Object.keys(window.localStorage)
  assert.equal(keys.length, 1)
  const second = claim.acquireClaimAttempt(user.id, 'llave-de-otro-perfil-ficticio-para-qa', async () => result)
  await second.initialized
  assert.equal(second.getSnapshot().historyRequired, false)
  await second.submit()
  claim.releaseClaimAttempt(user.id, 'llave-de-otro-perfil-ficticio-para-qa')
  assert.deepEqual(Object.keys(window.localStorage), keys)
  assert.equal(first.getSnapshot().phase, 'uncertain')
})

test('logout y reapertura de la misma invitación exigen revisión antes de habilitar otro envío', async () => {
  let posts = 0
  const send = async () => { posts++; throw new AxiosError('Sin respuesta', 'ERR_NETWORK') }
  const first = claim.acquireClaimAttempt(user.id, secret, send)
  await first.initialized
  await first.submit()
  claim.forgetClaimAttempts(user.id)
  const reopened = claim.acquireClaimAttempt(user.id, secret, send)
  await reopened.initialized
  assert.equal(reopened.getSnapshot().historyRequired, true)
  await reopened.submit()
  reopened.acknowledgeHistory()
  assert.equal(reopened.getSnapshot().historyRequired, true, 'No se limpia sin visitar las personas')
  assert.equal(posts, 1)
  reopened.visitHistory()
  reopened.acknowledgeHistory()
  assert.equal(reopened.getSnapshot().historyRequired, false)
  assert.equal(Object.keys(window.localStorage).length, 0)
  assert.equal(posts, 1, 'Comprobar el historial no provoca un POST')
})

test('la respuesta tardía de una cuenta cerrada no expone su resultado ni elimina su indicador', async () => {
  let complete!: (value: typeof result) => void
  const model = claim.acquireClaimAttempt(user.id, secret, () => new Promise((resolve) => { complete = resolve }))
  await model.initialized
  const request = model.submit()
  const keys = Object.keys(window.localStorage)
  claim.forgetClaimAttempts(user.id)
  complete(result)
  await request
  assert.equal(model.getSnapshot().result, null)
  assert.deepEqual(Object.keys(window.localStorage), keys)
})

test('cerrar una revisión resuelta no elimina otra revisión pendiente del mismo usuario', async () => {
  const send = async () => { throw new AxiosError('Sin respuesta', 'ERR_NETWORK') }
  const first = claim.acquireClaimAttempt(user.id, secret, send)
  const second = claim.acquireClaimAttempt(user.id, 'segunda-llave-ficticia-independiente', send)
  await Promise.all([first.initialized, second.initialized])
  await first.submit()
  await second.submit()
  assert.equal(Object.keys(window.localStorage).length, 2)
  first.visitHistory()
  first.acknowledgeHistory()
  assert.equal(first.getSnapshot().phase, 'resolved')
  claim.releaseClaimAttempt(user.id, secret)
  assert.equal(second.getSnapshot().phase, 'uncertain')
  assert.equal(Object.keys(window.localStorage).length, 1)
  assert.equal(claim.acquireClaimAttempt(user.id, 'segunda-llave-ficticia-independiente', send), second)
})

test('el DNI no aparece en el error visible aunque la respuesta lo incluya', async (t) => {
  api.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/identity-check')) throw failure(config, 400, 'No se pudo contrastar el documento 00000000')
    return ok(config, config.url?.endsWith('/authorization-declarations') ? [{ type: 'LEGAL_REPRESENTATION' }] : [])
  }
  const node = await mount(t, <ProfileClaimPanel subject={subject} onChanged={() => {}} />)
  await until(() => !!node.querySelector('#claim-dni'))
  await fill(node, '#claim-dni', '00000000')
  await click(node, 'Contrastar nombre')
  assert.equal(node.querySelector<HTMLInputElement>('#claim-dni')?.value, '')
  assert.equal(node.textContent?.includes('00000000'), false)
  assert.match(node.querySelector('[role=alert]')?.textContent ?? '', /\[documento\]/)
})

test('logout y cambio de cuenta vuelven al mismo enlace y respetan el correo invitado', async (t) => {
  claim.rememberClaimToken(secret)
  t.after(() => claim.forgetClaimAttempts(72))
  let exchanges = 0
  api.defaults.adapter = publicApi.defaults.adapter = async (config) => {
    if (config.url === '/auth/login') {
      const email = JSON.parse(config.data).email
      return ok(config, email === 'titular@example.invalid'
        ? { ...authResponse, accessToken: 'holder-access-ficticio', user: { ...user, id: 72, email } }
        : authResponse)
    }
    if (config.url === '/auth/logout') return ok(config, null)
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    if (config.url === '/claim-invitations/exchange') {
      exchanges++
      if (config.headers.get('Authorization') !== 'Bearer holder-access-ficticio') throw failure(config, 403, 'Este enlace fue emitido para otra cuenta')
      return ok(config, result)
    }
    throw new Error('Solicitud inesperada')
  }
  const node = await mount(t, <ThemeProvider><AuthProvider><MemoryRouter initialEntries={['/entrega']}><AppRoutes /></MemoryRouter></AuthProvider></ThemeProvider>)
  await until(() => node.textContent?.includes('Iniciar sesión') ?? false)
  await link(node, 'Iniciar sesión')
  await until(() => !!node.querySelector('#auth-email'))
  await fill(node, '#auth-email', user.email)
  await fill(node, '#auth-password', 'Ficticia123')
  await click(node, 'Entrar')
  await until(() => !!node.querySelector('input[type=checkbox]'))
  await check(node)
  await click(node, 'Confirmar y recibir mi perfil')
  assert.match(node.textContent!, /no corresponde a esta cuenta/)
  await click(node, 'Usar otra cuenta')
  await until(() => !!node.querySelector('#auth-email'))
  await fill(node, '#auth-email', 'titular@example.invalid')
  await fill(node, '#auth-password', 'Ficticia123')
  await click(node, 'Entrar')
  await until(() => !!node.querySelector('input[type=checkbox]'))
  await check(node)
  await click(node, 'Confirmar y recibir mi perfil')
  await until(() => node.textContent?.includes('Ya administras tu perfil') ?? false)
  assert.equal(exchanges, 2, 'La primera cuenta fue rechazada; la destinataria hizo el canje')
  assert.equal(Object.keys(window.localStorage).filter((key) => key.startsWith('yuyay.claim-check.')).length, 0)
})

test('sin acceso al almacenamiento se exige revisión y un resultado incierto sigue bloqueado en memoria', async () => {
  const oldGet = window.Storage.prototype.getItem
  const oldSet = window.Storage.prototype.setItem
  try {
    window.Storage.prototype.getItem = () => { throw new Error('Almacenamiento bloqueado') }
    window.Storage.prototype.setItem = () => { throw new Error('Almacenamiento bloqueado') }
    let posts = 0
    const model = claim.acquireClaimAttempt(user.id, secret, async () => { posts++; throw new AxiosError('Sin respuesta', 'ERR_NETWORK') })
    await model.initialized
    assert.equal(model.getSnapshot().historyRequired, true)
    await model.submit()
    assert.equal(posts, 0)
    model.visitHistory()
    model.acknowledgeHistory()
    await model.submit()
    await model.submit()
    assert.equal(posts, 1)
    assert.equal(model.getSnapshot().phase, 'uncertain')
  } finally {
    window.Storage.prototype.getItem = oldGet
    window.Storage.prototype.setItem = oldSet
  }
})
