import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://reader.example.test/', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { publicApi } = await import('../src/services/http')
publicApi.defaults.baseURL = '/api/v1'
const { ReadingCookiePanel } = await import('../src/pages/public/ReadingCookiePanel')
const { HandoffPublicPage } = await import('../src/pages/public/HandoffPublicPage')
const { rememberReading, supportsReadingCookie } = await import('../src/services/api/readingCookie')
const serverTime = '2030-01-01T00:00:00Z'
const view = { handoffId: 7, careSubjectName: 'Persona de prueba', reason: 'Contenido confidencial', questions: null,
  createdAt: serverTime, items: [], serverTime, accessExpiresAt: '2030-01-01T00:00:30Z' }
const ok = (config: InternalAxiosRequestConfig, data: unknown, status = 200) => ({ config, data, status, statusText: 'OK', headers: {} })

function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = publicApi.defaults.adapter
  publicApi.defaults.adapter = adapter
  t.after(() => { publicApi.defaults.adapter = previous })
}
async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const render = async (next: ReactNode) => { await act(async () => root.render(<MemoryRouter>{next}</MemoryRouter>)) }
  await render(node)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  return { container, render }
}
async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === label)
  assert.ok(button, label)
  await act(async () => button.click())
}
async function fill(container: HTMLElement, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!
  assert.ok(input, selector)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
function fakeClock(t: TestContext) {
  let now = 1000
  t.mock.method(performance, 'now', () => now)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  return async (elapsed: number) => { await act(async () => { now += elapsed; t.mock.timers.tick(elapsed) }) }
}

test('la cookie solo se ofrece en contexto seguro y API del mismo origen', t => {
  const previous = publicApi.defaults.baseURL
  t.after(() => { publicApi.defaults.baseURL = previous; Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true }) })
  publicApi.defaults.baseURL = '/api/v1'
  assert.equal(supportsReadingCookie(), true)
  publicApi.defaults.baseURL = 'https://api.other.test/api/v1'
  assert.equal(supportsReadingCookie(), false)
  publicApi.defaults.baseURL = '/api/v1'
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
  assert.equal(supportsReadingCookie(), false)
})

test('minimizar, reducir, rechazar y mover con teclado conservan foco sin consentir', async t => {
  let requests = 0
  mockApi(t, async config => { requests++; return ok(config, null, 204) })
  const { container } = await mount(t, <ReadingCookiePanel token="enlace" grant="secreto" />)
  assert.ok(container.querySelector('aside[aria-labelledby="reading-cookie-title"]'))
  await click(container, 'Minimizar')
  assert.equal(document.activeElement?.textContent?.trim(), 'Permiso de lectura')
  await click(container, 'Permiso de lectura')
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Minimizar')
  await click(container, 'Reducir a un escudo')
  const shield = container.querySelector<HTMLButtonElement>('button')!
  assert.equal(document.activeElement, shield)
  await act(async () => { shield.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
  assert.ok(shield.classList.contains('right-4'))
  await act(async () => { shield.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
  assert.ok(shield.classList.contains('left-4'))
  await click(container, 'Abrir el permiso de lectura')
  await click(container, 'Ahora no')
  assert.equal(document.activeElement?.getAttribute('aria-label'), 'Abrir el permiso de lectura')
  assert.equal(requests, 0)
})

test('aceptar envía el grant en header una sola vez y verifica que el navegador guardó la cookie', async t => {
  const requests: InternalAxiosRequestConfig[] = []
  let release: (() => void) | undefined
  mockApi(t, async config => {
    requests.push(config)
    if (config.method === 'post') { await new Promise<void>(resolve => { release = resolve }); return ok(config, null, 204) }
    return ok(config, view)
  })
  const { container } = await mount(t, <ReadingCookiePanel token="token/a" grant="grant-confidencial" />)
  await click(container, 'Aceptar')
  assert.ok([...container.querySelectorAll('button')].every(button => button.disabled))
  await click(container, 'Guardando…')
  assert.equal(requests.length, 1)
  await act(async () => { release!() })
  assert.deepEqual(requests.map(r => r.url), ['/public/handoff-sessions/token%2Fa/reading-cookie', '/public/handoff-sessions/token%2Fa/resume'])
  assert.equal(requests[0].headers.get('X-Handoff-Access'), 'grant-confidencial')
  assert.equal(requests[1].headers.get('X-Handoff-Access'), undefined)
  assert.doesNotMatch(container.innerHTML, /grant-confidencial/)
  assert.equal(window.sessionStorage.length, 0)
  assert.equal(window.localStorage.length, 0)
  assert.match(container.querySelector('[role="status"]')!.textContent!, /guardado/)
  assert.equal(document.activeElement, container.querySelector('[role="status"]'), 'el foco no se pierde al retirar el panel')
})

test('un 204 sin cookie real no anuncia éxito; conserva lectura y permite reintentar', async t => {
  mockApi(t, async config => ok(config, null, 204))
  const { container } = await mount(t, <ReadingCookiePanel token="enlace" grant="grant" />)
  await click(container, 'Aceptar')
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /Puedes seguir leyendo/)
  assert.ok([...container.querySelectorAll('button')].every(button => !button.disabled))
  assert.equal(container.querySelector('[role="status"]'), null)
})

test('resume no válido o sin vencimiento no acredita un permiso guardado', async t => {
  mockApi(t, async config => config.method === 'post' ? ok(config, null, 204) : ok(config, { ...view, accessExpiresAt: undefined }))
  await assert.rejects(rememberReading('enlace', 'grant'))
})

test('el panel aparece solo tras abrir con código; rechazar no persiste ni vuelve a pedir el resumen', async t => {
  const requests: InternalAxiosRequestConfig[] = []
  mockApi(t, async config => {
    requests.push(config)
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.url?.endsWith('/resume')) return ok(config, null, 204)
    assert.ok(config.url?.endsWith('/open'))
    return ok(config, { ...view, accessGrant: 'grant-solo-memoria' })
  })
  const { container } = await mount(t, <HandoffPublicPage token="enlace" />)
  assert.equal(container.querySelector('aside'), null)
  await fill(container, '#visitorName', 'Ana Vega')
  await fill(container, '#visitorRole', 'Médico')
  await fill(container, '#accessCode', '123456')
  await click(container, 'Ver resumen')
  assert.match(container.textContent!, /Contenido confidencial/)
  assert.ok(container.querySelector('aside'))
  await click(container, 'Ahora no')
  assert.match(container.textContent!, /Contenido confidencial/)
  assert.equal(requests.filter(r => r.method === 'post').length, 1)
  assert.doesNotMatch(container.innerHTML, /grant-solo-memoria/)
})

test('reanudación válida evita pedir identidad/código y borra contenido al vencer con reloj del servidor', async t => {
  const advance = fakeClock(t)
  t.mock.method(Date, 'now', () => 0)
  const requests: InternalAxiosRequestConfig[] = []
  mockApi(t, async config => {
    requests.push(config)
    return ok(config, config.url?.endsWith('/access-requirements') ? { accessCodeRequired: true } : view)
  })
  const { container } = await mount(t, <HandoffPublicPage token="enlace" />)
  assert.match(container.textContent!, /Contenido confidencial/)
  assert.equal(container.querySelector('form'), null)
  assert.equal(container.querySelector('aside'), null)
  assert.equal(requests.length, 2)
  assert.ok(requests.every(r => r.method === 'get' && !r.headers.has('X-Handoff-Access')))
  await advance(30000)
  assert.doesNotMatch(container.textContent!, /Contenido confidencial/)
  assert.match(container.textContent!, /Terminó el tiempo de lectura/)
})

test('resume ya vencido no muestra contenido sensible', async t => {
  mockApi(t, async config => ok(config, config.url?.endsWith('/access-requirements') ? { accessCodeRequired: true } : { ...view, accessExpiresAt: serverTime }))
  const { container } = await mount(t, <HandoffPublicPage token="enlace" />)
  assert.doesNotMatch(container.textContent!, /Contenido confidencial/)
  assert.match(container.textContent!, /Terminó el tiempo de lectura/)
})

test('una lectura abierta se retira sin recargar cuando el cuidador revoca el enlace', async t => {
  const advance = fakeClock(t)
  let checks = 0
  let resumes = 0
  mockApi(t, async config => {
    if (config.url?.endsWith('/resume')) { resumes++; return ok(config, view) }
    assert.ok(config.url?.endsWith('/access-requirements'))
    if (++checks === 1) return ok(config, { accessCodeRequired: true })
    throw new AxiosError('Revocado', undefined, config, undefined, ok(config, {}, 410))
  })
  const { container } = await mount(t, <HandoffPublicPage token="consulta" />)
  assert.match(container.textContent!, /Contenido confidencial/)
  await advance(10000)
  assert.match(container.textContent!, /Ya no tienes acceso a este resumen/)
  assert.equal(container.querySelector('article, form, aside'), null)
  assert.doesNotMatch(container.textContent!, /Persona de prueba|Contenido confidencial/)
  await advance(10000)
  assert.equal(checks, 2)
  assert.equal(resumes, 1)
})

test('un enlace antiguo sin cookie oculta la lectura hasta revalidar al volver a la pestaña', async t => {
  let checks = 0
  let opens = 0
  let finish: (() => void) | undefined
  mockApi(t, async config => {
    if (config.url?.endsWith('/open')) { opens++; return ok(config, { ...view, accessExpiresAt: null }) }
    assert.ok(config.url?.endsWith('/access-requirements'))
    checks++
    if (checks === 2) await new Promise<void>(resolve => { finish = resolve })
    if (checks === 3) throw new AxiosError('Eliminado', undefined, config, undefined, ok(config, {}, 404))
    return ok(config, { accessCodeRequired: false })
  })
  const { container } = await mount(t, <HandoffPublicPage token="anterior" />)
  await fill(container, '#visitorName', 'Ana Vega')
  await fill(container, '#visitorRole', 'Médico')
  await click(container, 'Ver resumen')
  await act(async () => { window.dispatchEvent(new window.Event('pagehide')) })
  assert.ok(container.querySelector('article')?.closest('[hidden]'))
  await act(async () => { window.dispatchEvent(new window.Event('pageshow')) })
  await act(async () => { window.dispatchEvent(new window.Event('focus')) })
  assert.equal(checks, 2)
  assert.match(container.textContent!, /Lectura en pausa/)
  await act(async () => finish!())
  assert.equal(container.querySelector('article')!.closest('[hidden]'), null)
  await act(async () => { window.dispatchEvent(new window.Event('focus')) })
  assert.equal(container.querySelector('article'), null)
  assert.equal(opens, 1)
})

test('un fallo de conexión pausa la lectura y al recuperarse conserva el vencimiento original', async t => {
  const advance = fakeClock(t)
  let checks = 0
  mockApi(t, async config => {
    if (config.url?.endsWith('/resume')) return ok(config, view)
    if (++checks === 2) throw new Error('Sin conexión')
    return ok(config, { accessCodeRequired: true })
  })
  const { container } = await mount(t, <HandoffPublicPage token="consulta" />)
  await advance(10000)
  assert.ok(container.querySelector('article')!.closest('[hidden]'))
  assert.match(container.textContent!, /Lectura en pausa/)
  await act(async () => { window.dispatchEvent(new window.Event('online')) })
  assert.equal(container.querySelector('article')!.closest('[hidden]'), null)
  await advance(20000)
  assert.match(container.textContent!, /Terminó el tiempo de lectura/)
  assert.equal(container.querySelector('article'), null)
})

for (const status of [403, 404, 410]) {
  test(`resume ${status} conserva el acceso por código sin ofrecer guardar`, async t => {
    mockApi(t, async config => {
      if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
      throw new AxiosError('No disponible', 'ERR_BAD_REQUEST', config, undefined, ok(config, {}, status))
    })
    const { container } = await mount(t, <HandoffPublicPage token="enlace" />)
    assert.ok(container.querySelector('#accessCode'))
    assert.equal(container.querySelector('aside'), null)
    assert.doesNotMatch(container.textContent!, /Contenido confidencial/)
  })
}

test('enlace anterior no intenta reanudar y cambio de token descarta respuesta pendiente', async t => {
  let release: (() => void) | undefined
  let staleSignal: AbortSignal | undefined
  const requests: string[] = []
  mockApi(t, async config => {
    requests.push(config.url!)
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: !config.url.includes('/anterior/') })
    staleSignal = config.signal as AbortSignal
    await new Promise<void>(resolve => { release = resolve })
    return ok(config, view)
  })
  const { container, render } = await mount(t, <HandoffPublicPage token="primero" />)
  await render(<HandoffPublicPage token="anterior" />)
  assert.equal(staleSignal?.aborted, true)
  await act(async () => { release!() })
  assert.doesNotMatch(container.textContent!, /Contenido confidencial/)
  assert.ok(container.querySelector('form'))
  assert.equal(container.querySelector('#accessCode'), null)
  assert.equal(requests.filter(url => url.includes('/anterior/resume')).length, 0)
})
