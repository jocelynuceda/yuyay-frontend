import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { act, useState, type ReactNode } from 'react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { NewHandoffPage } = await import('../src/pages/handoff/NewHandoffPage')
const { HandoffPublicPage } = await import('../src/pages/public/HandoffPublicPage')
const { api, publicApi } = await import('../src/services/http')

const reviewed = 'Texto revisado por el cuidador.\n'.repeat(180) + 'FIN DEL EXAMEN'
const version = { id: 19, versionNumber: 1, changeType: 'CREATED', title: 'Examen revisado', details: reviewed,
  notes: 'Llevar el documento original.', dose: null, frequency: null, occurredOn: '2026-11-20',
  confidenceLevel: 'CONFIRMED', declaredAt: '2026-11-21T12:00:00Z', sourceAttachmentId: 4 }
const entry = { id: 8, careSubjectId: 3, categoryCode: 'EXAM_RESULT', categoryName: 'Examen', latestVersion: version }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
const pageOf = (entries: unknown[]) => ({ content: entries, number: 0, size: 100, totalElements: entries.length, totalPages: 1 })
function adapter(t: TestContext, fn: AxiosAdapter) {
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
  assert.ok(button, `Falta ${text}`)
  await act(async () => button.click())
}
async function fill(container: HTMLElement, selector: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!
  assert.ok(field, selector)
  const prototype = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value)
    field.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
async function selectAndReview(container: HTMLElement) {
  for (let i = 0; i < 30 && !container.querySelector('input[type=checkbox]'); i++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  }
  const choices = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
  assert.ok(choices.length, container.textContent ?? '')
  await act(async () => choices[choices.length - 1].click())
  await click(container, 'Siguiente')
  assert.ok(container.textContent?.includes(reviewed), 'El paso del motivo debe conservar el texto completo seleccionado')
  await fill(container, '#handoff-reason', 'Revisar el examen')
  await click(container, 'Siguiente')
  assert.ok(container.textContent?.includes(reviewed), 'La revisión final debe mostrar todo el contenido')
}

test('Resumen manual muestra texto completo en pasos 2/3 y envía la versión revisada', async (t) => {
  let payload: any
  adapter(t, async (config) => {
    if (config.method === 'get') return ok(config, pageOf([entry]))
    payload = JSON.parse(config.data)
    return ok(config, { id: 12, items: [version] })
  })
  const container = await mount(t, <NewHandoffPage subjectId={3} />)
  await selectAndReview(container)
  await click(container, 'Crear resumen')
  assert.deepEqual(payload.expectedVersionIds, { 8: 19 })
  assert.deepEqual(payload.healthEntryIds, [8])
  assert.match(container.textContent!, /Resumen creado/)
})

test('409 bloquea repetir el guardado hasta recargar y revisar; conserva motivo', async (t) => {
  let attempts = 0, revision = 19
  adapter(t, async (config) => {
    if (config.method === 'get') return ok(config, pageOf([{ ...entry, latestVersion: { ...version, id: revision } }]))
    attempts++
    if (attempts === 1) {
      revision = 20
      throw new AxiosError('Cambió', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, {}), status: 409 })
    }
    assert.equal(JSON.parse(config.data).expectedVersionIds['8'], 20)
    return ok(config, { id: 12, items: [version] })
  })
  const container = await mount(t, <NewHandoffPage subjectId={3} />)
  await selectAndReview(container)
  await click(container, 'Crear resumen')
  assert.equal([...container.querySelectorAll('button')].find((b) => b.textContent === 'Crear resumen')?.disabled, true)
  await click(container, 'Actualizar registros y revisar')
  await click(container, 'Siguiente')
  assert.equal(container.querySelector<HTMLTextAreaElement>('#handoff-reason')?.value, 'Revisar el examen')
  await click(container, 'Siguiente')
  await click(container, 'Crear resumen')
  assert.equal(attempts, 2)
})

test('Vista del médico muestra contenido completo y solicita sólo el original de la versión compartida', async (t) => {
  let path = ''
  const originalOpen = window.open
  const originalCreate = URL.createObjectURL
  const tab = { opener: window, location: { href: '' }, close() {} }
  window.open = (() => tab) as any
  URL.createObjectURL = () => 'blob:original'
  t.after(() => { window.open = originalOpen; URL.createObjectURL = originalCreate })
  adapter(t, async (config) => {
    if (config.method === 'post') return ok(config, { careSubjectName: 'Lucía', createdAt: version.declaredAt,
      reason: 'Control', questions: null, items: [{ ...version, healthEntryVersionId: 19, categoryCode: 'EXAM_RESULT', hasSourceAttachment: true }] })
    path = config.url!
    return ok(config, new Blob(['original'], { type: 'image/png' }))
  })
  const container = await mount(t, <HandoffPublicPage token="enlace-de-prueba" />)
  await fill(container, '#visitorName', 'Médico de prueba')
  await fill(container, '#visitorRole', 'Médico')
  await click(container, 'Ver resumen')
  assert.ok(container.textContent?.includes(reviewed))
  // El temporizador de limpieza de la pestaña no debe alargar la prueba.
  const timer = globalThis.setTimeout
  globalThis.setTimeout = ((fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    const handle = timer(fn, ms, ...args); if (ms === 60000) handle.unref(); return handle
  }) as typeof setTimeout
  try { await click(container, 'Ver documento original') } finally { globalThis.setTimeout = timer }
  assert.equal(path, '/public/handoff-sessions/enlace-de-prueba/versions/19/source/content')
  assert.equal(tab.opener, null)
  assert.equal(tab.location.href, 'blob:original')
})


test('409 y recarga fallida permiten reintentar sin perder el motivo ni la selección revisada', async (t) => {
  let reads = 0, writes = 0
  adapter(t, async (config) => {
    if (config.method === 'get') {
      reads++
      if (reads === 2) throw new AxiosError('Timeout de lectura', 'ECONNABORTED', config)
      return ok(config, pageOf([{ ...entry, latestVersion: { ...version, id: reads === 1 ? 19 : 20 } }]))
    }
    writes++
    if (writes === 1) throw new AxiosError('Cambió', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, {}), status: 409 })
    const payload = JSON.parse(config.data)
    assert.equal(payload.reason, 'Revisar el examen')
    assert.deepEqual(payload.healthEntryIds, [8])
    assert.deepEqual(payload.expectedVersionIds, { 8: 20 })
    return ok(config, { id: 12, items: [version] })
  })
  const container = await mount(t, <NewHandoffPage subjectId={3} />)
  await selectAndReview(container)
  await click(container, 'Crear resumen')
  await click(container, 'Actualizar registros y revisar')
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /tardó demasiado/)
  assert.equal(writes, 1)
  await click(container, 'Reintentar carga de registros')
  assert.equal(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked, true)
  await click(container, 'Siguiente')
  assert.equal(container.querySelector<HTMLTextAreaElement>('#handoff-reason')!.value, 'Revisar el examen')
  await click(container, 'Siguiente')
  assert.ok(container.textContent?.includes(reviewed))
  await click(container, 'Crear resumen')
  assert.equal(reads, 3)
  assert.equal(writes, 2)
  assert.match(container.textContent!, /Resumen creado/)
})

const publicView = (name: string) => ({
  careSubjectName: name, createdAt: version.declaredAt, reason: 'Control', questions: null,
  items: [{ ...version, healthEntryVersionId: 19, categoryCode: 'EXAM_RESULT', hasSourceAttachment: true }],
})

async function identifyVisitor(container: HTMLElement) {
  await fill(container, '#visitorName', 'Médico de prueba')
  await fill(container, '#visitorRole', 'Médico')
  await click(container, 'Ver resumen')
}

test('cambiar el enlace borra la vista anterior y una respuesta tardía no abre el nuevo enlace', async (t) => {
  let finishPrevious: (() => void) | undefined
  const paths: string[] = []
  adapter(t, async (config) => {
    paths.push(config.url!)
    if (config.url?.includes('/enlace-2/')) {
      await new Promise<void>((resolve) => { finishPrevious = resolve })
    }
    const name = config.url?.includes('/enlace-1/') ? 'Paciente anterior' : config.url?.includes('/enlace-2/') ? 'Respuesta tardía' : 'Paciente actual'
    return ok(config, publicView(name))
  })
  function SwitchToken() {
    const [token, setToken] = useState(1)
    return <><button onClick={() => setToken((current) => current + 1)}>Cambiar enlace</button><HandoffPublicPage token={`enlace-${token}`} /></>
  }
  const container = await mount(t, <SwitchToken />)
  await identifyVisitor(container)
  assert.match(container.textContent!, /Paciente anterior/)
  await click(container, 'Cambiar enlace')
  assert.doesNotMatch(container.textContent!, /Paciente anterior/)
  assert.equal(container.querySelector<HTMLInputElement>('#visitorName')!.value, '')
  await identifyVisitor(container)
  assert.ok(finishPrevious)
  await click(container, 'Cambiar enlace')
  await act(async () => { finishPrevious!() })
  assert.doesNotMatch(container.textContent!, /Paciente anterior|Respuesta tardía/)
  assert.equal(container.querySelector<HTMLInputElement>('#visitorName')!.value, '')
  await identifyVisitor(container)
  assert.match(container.textContent!, /Paciente actual/)
  assert.deepEqual(paths, [1, 2, 3].map((id) => `/public/handoff-sessions/enlace-${id}/open`))
})

test('original expirado: cierra la pestaña, avisa el 410 y no crea una URL Blob', async (t) => {
  let closes = 0, blobUrls = 0, sourceReads = 0
  const originalOpen = window.open, originalCreate = URL.createObjectURL
  const tab = { opener: window, location: { href: '' }, close() { closes++ } }
  window.open = (() => tab) as any
  URL.createObjectURL = () => { blobUrls++; return 'blob:no-debe-crearse' }
  t.after(() => { window.open = originalOpen; URL.createObjectURL = originalCreate })
  adapter(t, async (config) => {
    if (config.method === 'post') return ok(config, publicView('Paciente de prueba'))
    sourceReads++
    assert.equal(config.responseType, 'blob')
    throw new AxiosError('Expirado', 'ERR_BAD_REQUEST', config, undefined, {
      ...ok(config, new Blob([JSON.stringify({ message: 'Enlace expirado' })], { type: 'application/json' })), status: 410,
    })
  })
  const container = await mount(t, <HandoffPublicPage token="expirado" />)
  await identifyVisitor(container)
  await click(container, 'Ver documento original')
  assert.equal(sourceReads, 1)
  assert.equal(closes, 1)
  assert.equal(blobUrls, 0)
  assert.equal(tab.location.href, '')
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /enlace ya no está disponible/)
  assert.equal([...container.querySelectorAll('button')].find((button) => button.textContent === 'Ver documento original')!.disabled, false)
})

test('popup bloqueado: informa el bloqueo sin solicitar el documento original', async (t) => {
  let sourceReads = 0
  const originalOpen = window.open
  window.open = () => null
  t.after(() => { window.open = originalOpen })
  adapter(t, async (config) => {
    if (config.method === 'post') return ok(config, publicView('Paciente de prueba'))
    sourceReads++
    return ok(config, new Blob(['no debe solicitarse']))
  })
  const container = await mount(t, <HandoffPublicPage token="bloqueado" />)
  await identifyVisitor(container)
  await click(container, 'Ver documento original')
  assert.equal(sourceReads, 0)
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /Permita abrir una nueva pestaña/)
})
