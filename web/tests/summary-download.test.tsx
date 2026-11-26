import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { act, type ReactNode } from 'react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { CreateHandoffLink } = await import('../src/pages/handoff/HandoffLinkStep')
const { HandoffPublicPage } = await import('../src/pages/public/HandoffPublicPage')
const { getHandoffSummaryPdf } = await import('../src/services/api/handoffs')
const { api, publicApi } = await import('../src/services/http')

const serverTime = '2030-01-01T00:00:00Z'
const snapshot = 'Texto revisado del registro.\n'.repeat(200) + 'FIN DEL SNAPSHOT'
const view = { handoffId: 2, careSubjectName: 'Paciente de prueba', reason: 'Control', questions: 'Pregunta registrada', createdAt: serverTime,
  serverTime, accessExpiresAt: '2030-01-01T00:01:00Z', accessGrant: 'grant-en-memoria', downloadAllowed: true,
  items: [{ healthEntryVersionId: 19, categoryCode: 'EXAM_RESULT', title: 'Examen compartido', details: snapshot,
    confidenceLevel: 'CONFIRMED', declaredAt: serverTime }] }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
function mockApi(t: TestContext, fn: AxiosAdapter) {
  const old = api.defaults.adapter, oldPublic = publicApi.defaults.adapter
  api.defaults.adapter = fn; publicApi.defaults.adapter = fn
  t.after(() => { api.defaults.adapter = old; publicApi.defaults.adapter = oldPublic })
}
async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>))
  return container
}
async function click(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  assert.ok(button, text)
  await act(async () => button.click())
}
async function fill(container: HTMLElement, id: string, value: string) {
  const field = container.querySelector<HTMLInputElement>(id)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function identify(container: HTMLElement) {
  await fill(container, '#visitorName', 'Pedro de prueba')
  await fill(container, '#visitorRole', 'Médico')
  await fill(container, '#accessCode', '123456')
  await click(container, 'Ver resumen')
}
function fakeClock(t: TestContext) {
  let now = 1000
  t.mock.method(performance, 'now', () => now)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  return async (elapsed: number) => { await act(async () => { now += elapsed; t.mock.timers.tick(elapsed) }) }
}

test('descarga apagada; cancelar, cerrar y Escape no autorizan; confirmar envía el permiso', async (t) => {
  fakeClock(t)
  let payload: unknown
  mockApi(t, async (config) => {
    if (config.method === 'post') {
      payload = JSON.parse(config.data)
      return ok(config, { id: 7, token: 'permitido', expiresAt: serverTime, accessCodeRequired: true, allowDownload: true })
    }
    return ok(config, { code: '123456', consumed: false, serverTime, expiresAt: '2030-01-01T00:00:30Z', periodSeconds: 30 })
  })
  const container = await mount(t, <CreateHandoffLink handoffId={2} subjectName="Lucía" />)
  assert.match(container.textContent!, /Lucía · Resumen para la consulta/)
  assert.match(container.textContent!, /La copia podrá conservarse después de que venza el enlace/)
  assert.doesNotMatch(container.textContent!, /Ajusta los tiempos para continuar|Opcional\. Al activarlo/)
  const box = container.querySelector<HTMLInputElement>('input[type=checkbox]')!
  assert.equal(box.checked, false)
  await act(async () => box.click())
  assert.equal(box.checked, false)
  assert.ok(container.querySelector('dialog[open]'))
  await click(container, 'Volver')
  assert.equal(box.checked, false)
  await act(async () => box.click())
  await act(async () => container.querySelector('dialog')!.dispatchEvent(new window.Event('cancel', { bubbles: true, cancelable: true })))
  assert.equal(box.checked, false)
  assert.equal(container.querySelector('dialog[open]'), null)
  await act(async () => box.click())
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label=Cerrar]')!.click())
  assert.equal(box.checked, false)
  await act(async () => box.click())
  await click(container, 'Autorizar descarga')
  assert.equal(box.checked, true)
  await act(async () => box.click())
  assert.equal(box.checked, false)
  await act(async () => box.click())
  await click(container, 'Autorizar descarga')
  await click(container, 'Generar enlace y código')
  assert.deepEqual(payload, { expiresInMinutes: 1440, sessionWindowMinutes: 30, allowDownload: true, requireAccessCode: true })
  assert.match(container.textContent!, /Descarga del resumen en PDF autorizada/)
})

test('backend antiguo que ignora permiso: revoca, explica y no expone el token', async (t) => {
  const paths: string[] = []
  mockApi(t, async (config) => {
    paths.push(`${config.method} ${config.url}`)
    return ok(config, config.method === 'post' ? { id: 7, token: 'NO-EXPONER', accessCodeRequired: true } : {})
  })
  const container = await mount(t, <CreateHandoffLink handoffId={2} />)
  await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
  await click(container, 'Autorizar descarga')
  await click(container, 'Generar enlace y código')
  assert.deepEqual(paths, ['post /handoffs/2/sessions', 'delete /handoff-sessions/7'])
  assert.match(container.textContent!, /todavía no admite el permiso de descarga/)
  assert.doesNotMatch(container.innerHTML, /NO-EXPONER|Enlace listo/)
})

test('lector conserva snapshot completo, etiqueta plazo y descarga el PDF servidor usando grant solo en cabecera', async (t) => {
  fakeClock(t)
  let downloads = 0, blobs = 0, request: InternalAxiosRequestConfig | undefined
  t.mock.method(URL, 'createObjectURL', (pdf: Blob) => { assert.equal(pdf.type, 'application/pdf'); blobs++; return 'blob:pdf' })
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', function (this: HTMLAnchorElement) {
    assert.equal(this.download, 'resumen-clinico-yuyay.pdf'); downloads++
  })
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.method === 'post') return ok(config, view)
    request = config
    return ok(config, new Blob(['%PDF-1.7\nServidor'], { type: 'application/pdf' }))
  })
  const container = await mount(t, <HandoffPublicPage token="seguro" />)
  assert.doesNotMatch(container.textContent!, /Descargar PDF/)
  await identify(container)
  assert.ok(container.textContent!.includes(snapshot))
  assert.match(container.textContent!, /Solo lectura.*Lectura hasta el/)
  await click(container, 'Descargar PDF')
  assert.equal(downloads, 1); assert.equal(blobs, 1)
  assert.equal(request?.url, '/public/handoff-sessions/seguro/summary.pdf')
  assert.equal(request?.headers.get('X-Handoff-Access'), 'grant-en-memoria')
  assert.equal(request?.headers.get('Authorization'), undefined)
  assert.equal(request?.params, undefined)
  assert.doesNotMatch(container.innerHTML, /grant-en-memoria/)
  assert.equal(window.localStorage.length, 0); assert.equal(window.sessionStorage.length, 0)
})

test('permiso ausente/falso o plazo ausente nunca muestran descarga', async (t) => {
  fakeClock(t)
  let response = { ...view } as Record<string, unknown>
  mockApi(t, async (config) => ok(config, config.url?.endsWith('/access-requirements') ? { accessCodeRequired: true } : response))
  for (const change of [{ downloadAllowed: undefined }, { downloadAllowed: false }, { accessExpiresAt: null }]) {
    response = { ...view, ...change }
    const container = await mount(t, <HandoffPublicPage token="sin-permiso" />)
    await identify(container)
    assert.doesNotMatch(container.textContent!, /Descargar PDF/)
  }
})

test('lectura reanudada autorizada descarga con cookie de mismo origen sin inventar una cabecera grant', async (t) => {
  fakeClock(t)
  let request: InternalAxiosRequestConfig | undefined
  t.mock.method(URL, 'createObjectURL', () => 'blob:cookie')
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {})
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.method === 'post') return ok(config, { ...view, accessGrant: null })
    request = config
    return ok(config, new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
  })
  const container = await mount(t, <HandoffPublicPage token="cookie-autorizada" />)
  await identify(container)
  await click(container, 'Descargar PDF')
  assert.equal(request?.url, '/public/handoff-sessions/cookie-autorizada/summary.pdf')
  assert.equal(request?.headers.get('X-Handoff-Access'), undefined)
  assert.notEqual(request?.withCredentials, true, 'no habilita cookies entre orígenes')
})

test('410 rechaza descarga sin crear archivo, muestra error y permite reintentar', async (t) => {
  fakeClock(t)
  let blobs = 0
  t.mock.method(URL, 'createObjectURL', () => { blobs++; return 'blob:prohibido' })
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.method === 'post') return ok(config, view)
    throw new AxiosError('Vencido', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, new Blob()), status: 410 })
  })
  const container = await mount(t, <HandoffPublicPage token="revocado" />)
  await identify(container)
  await click(container, 'Descargar PDF')
  assert.equal(blobs, 0)
  assert.match(container.querySelector('[role=alert]')!.textContent!, /ya no está disponible/)
  assert.equal([...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Descargar PDF')!.disabled, false)
})

test('al expirar aborta una descarga pendiente y no guarda una respuesta tardía', async (t) => {
  const advance = fakeClock(t)
  let release: (() => void) | undefined, signal: AbortSignal | undefined, blobs = 0
  t.mock.method(URL, 'createObjectURL', () => { blobs++; return 'blob:tardio' })
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.method === 'post') return ok(config, view)
    signal = config.signal as AbortSignal
    await new Promise<void>((resolve) => { release = resolve })
    return ok(config, new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
  })
  const container = await mount(t, <HandoffPublicPage token="caduca" />)
  await identify(container)
  await click(container, 'Descargar PDF')
  await advance(60000)
  assert.equal(signal?.aborted, true)
  await act(async () => release!())
  assert.equal(blobs, 0)
  assert.doesNotMatch(container.textContent!, /FIN DEL SNAPSHOT|Descargar PDF/)
  assert.match(container.textContent!, /Terminó el tiempo de lectura/)
})

test('no descarga HTML ni JSON servidos con éxito por una ruta antigua', async (t) => {
  mockApi(t, async (config) => ok(config, new Blob(['<html>sitio</html>'], { type: 'text/html' })))
  await assert.rejects(getHandoffSummaryPdf('token', 'grant'), /no devolvió un PDF válido/)
})
