import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act, StrictMode } from 'react'
import { AuthContext } from '../src/contexts/auth-context'
import { forgetSummarySession, summarySession } from '../src/utils/summaryAttempts'
import { api } from '../src/services/http'
import { ConsultationSummaryPage } from '../src/pages/handoff/ConsultationSummaryPage'
import { createSummaryReview } from '../src/utils/summaryReview'
import type { ConsultationPreparation, ConfirmPreparation } from '../src/types/consultationPreparation'
import type { HandoffDetail } from '../src/types'

const version = {
  id: 31, versionNumber: 1, changeType: 'CREATED' as const, title: 'Registro ficticio',
  details: 'Detalle revisado', dose: null, frequency: null, occurredOn: null,
  confidenceLevel: 'CONFIRMED' as const, notes: 'Nota revisada', declaredBy: { id: 1, name: 'Ficticio' },
  declaredAt: '2026-11-21T00:00:00Z', sourceAttachmentId: null,
}
const preparation: ConsultationPreparation = {
  consultationId: 5, careSubjectId: 2, reason: 'Control ficticio', preparationToken: 'token-original',
  categories: [{ categoryCode: 'ALLERGY', entries: [{ entryId: 12, versionId: 31, version }] }],
}
const saved: HandoffDetail = {
  id: 9, careSubjectId: 2, createdByUserId: 1, reason: 'Guardado', questions: 'Pregunta guardada',
  createdAt: '2026-11-21T00:00:00Z',
  items: [{ ...version, healthEntryId: 12, healthEntryVersionId: 31, categoryCode: 'ALLERGY' }],
}
function model(confirm: (body: ConfirmPreparation) => Promise<HandoffDetail>, prepare = async () => preparation) {
  return createSummaryReview({
    prepare, confirm, newId: () => crypto.randomUUID(),
    status: (error) => (error as { status?: number }).status,
    errorMessage: () => 'Error ficticio',
  })
}
test('conserva la versión visible, selección, campos y cuerpo exacto ante un resultado incierto', async () => {
  const bodies: ConfirmPreparation[] = []
  const review = model(async (body) => {
    bodies.push(body)
    if (bodies.length === 1) throw { status: 503 }
    return saved
  })
  await review.load()
  review.edit({ reason: 'Motivo editado', questions: 'Preguntas editadas' })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'uncertain')
  review.edit({ reason: 'Cambio prohibido' })
  assert.equal(review.cancel(), false)
  await review.save()
  assert.equal(bodies[0], bodies[1])
  assert.deepEqual(bodies[1].entries, [{ entryId: 12, versionId: 31 }])
  assert.equal(bodies[1].preparationToken, 'token-original')
  assert.equal(bodies[1].reason, 'Motivo editado')
  assert.equal(review.getSnapshot().saved, saved)
})
test('409 recarga las versiones sin perder el texto y exige una nueva revisión', async () => {
  let reads = 0
  const bodies: ConfirmPreparation[] = []
  const review = model(async (body) => {
    bodies.push(body)
    if (bodies.length === 1) throw { status: 409 }
    return saved
  }, async () => ++reads === 1 ? preparation : {
    ...preparation, preparationToken: 'token-nuevo',
    categories: [{ categoryCode: 'ALLERGY', entries: [{ entryId: 12, versionId: 32, version: { ...version, id: 32, title: 'Actualizado' } }] }],
  })
  await review.load()
  review.edit({ reason: 'Mi motivo', questions: 'Mi pregunta' })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'editing')
  assert.equal(review.getSnapshot().reason, 'Mi motivo')
  assert.equal(review.getSnapshot().questions, 'Mi pregunta')
  await review.save()
  assert.equal(bodies.length, 1)
  review.review()
  await review.save()
  assert.notEqual(bodies[0].requestId, bodies[1].requestId)
  assert.equal(bodies[1].preparationToken, 'token-nuevo')
  assert.deepEqual(bodies[1].entries, [{ entryId: 12, versionId: 32 }])
})
test('cancelar y desmarcar no escriben; preparación vacía permite guardar', async () => {
  let writes = 0
  const review = model(async () => { writes++; return saved })
  await review.load()
  review.edit({ selected: [] })
  assert.equal(review.cancel(), true)
  await review.save()
  assert.equal(writes, 0)
  const empty = model(async (body) => { assert.deepEqual(body.entries, []); return saved }, async () => ({ ...preparation, categories: [] }))
  await empty.load()
  empty.review()
  await empty.save()
  assert.equal(empty.getSnapshot().phase, 'saved')
})
test('403 borra los datos privados y 400 permite corregir el formulario', async () => {
  for (const status of [400, 401, 403, 404]) {
    const review = model(async () => { throw { status } })
    await review.load()
    review.review()
    await review.save()
    assert.equal(review.getSnapshot().phase, status === 400 ? 'editing' : 'error')
    if (status !== 400) assert.equal(review.getSnapshot().preparation, null)
  }
})


test('un fallo al recargar tras 409 conserva el borrador para volver a intentar la preparación', async () => {
  let reads = 0
  const review = model(async () => { throw { status: 409 } }, async () => {
    if (++reads === 2) throw { status: 503 }
    return preparation
  })
  await review.load()
  review.edit({ reason: 'Motivo conservado', questions: 'Pregunta conservada', selected: [] })
  review.review()
  await review.save()
  assert.equal(review.getSnapshot().phase, 'error')
  await review.load()
  assert.equal(review.getSnapshot().reason, 'Motivo conservado')
  assert.equal(review.getSnapshot().questions, 'Pregunta conservada')
  assert.deepEqual(review.getSnapshot().selected, [])
  assert.equal(review.getSnapshot().phase, 'editing')
})

test('pulsar guardar dos veces comparte la escritura y cancelar una carga no guarda', async () => {
  let writes = 0
  let release!: () => void
  const review = model(async () => {
    writes++
    await new Promise<void>((resolve) => { release = resolve })
    return saved
  })
  await review.load()
  review.review()
  const first = review.save()
  await review.save()
  assert.equal(writes, 1)
  release()
  await first
  assert.equal(review.getSnapshot().phase, 'saved')
  let finishLoad!: (value: ConsultationPreparation) => void
  const cancelled = model(async () => { throw new Error('No debe guardar') },
    () => new Promise<ConsultationPreparation>((resolve) => { finishLoad = resolve }))
  const loading = cancelled.load()
  assert.equal(cancelled.cancel(), true)
  finishLoad(preparation)
  await loading
  assert.equal(cancelled.getSnapshot().preparation, null)
})

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, BrowserRouter, Routes, Route, Link } = await import('react-router-dom')
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
async function mount(t: TestContext) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<MemoryRouter><ConsultationSummaryPage subjectId={2} consultationId={5} /></MemoryRouter>))
  return container
}
async function click(root: ParentNode, text: string) {
  const button = [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  assert.ok(button, text)
  await act(async () => button.click())
}
test('la pantalla precarga, excluye registros, muestra el resultado y no comparte automáticamente', async (t) => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous })
  const writes: ConfirmPreparation[] = []
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, preparation)
    assert.equal(config.url, '/consultations/5/preparation/confirm')
    writes.push(JSON.parse(config.data))
    return ok(config, { ...saved, items: [] })
  }
  const container = await mount(t)
  assert.equal((container.querySelector('textarea') as HTMLTextAreaElement).value, 'Control ficticio')
  assert.match(container.textContent ?? '', /Detalle revisado|Nota revisada/)
  await act(async () => (container.querySelector('input[type=checkbox]') as HTMLInputElement).click())
  await click(container, 'Revisar resumen')
  assert.equal(writes.length, 0)
  assert.doesNotMatch(container.textContent ?? '', /Detalle revisado/)
  await click(container, 'Validar y guardar')
  assert.deepEqual(writes[0].entries, [])
  assert.match(container.textContent ?? '', /Resumen guardado|Pregunta guardada/)
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/people/2?tab=handoffs')
  assert.equal(writes.length, 1)
})
test('la pantalla vuelve a editar tras un 409 y cancelar no guarda', async (t) => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous })
  let gets = 0, posts = 0
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') { gets++; return ok(config, preparation) }
    posts++
    throw new AxiosError('Conflict', '', config, undefined, { ...ok(config, {}), status: 409 })
  }
  const container = await mount(t)
  await click(container, 'Revisar resumen')
  await click(container, 'Validar y guardar')
  assert.equal(gets, 2)
  assert.match(container.textContent ?? '', /información cambió/)
  assert.equal([...container.querySelectorAll('button')].some((b) => b.textContent === 'Validar y guardar'), false)
  await click(container, 'Cancelar')
  assert.equal(posts, 1)
})


async function historyStep(action: () => void) {
  await act(async () => {
    const changed = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
    action()
    await changed
    await new Promise((resolve) => setTimeout(resolve, 5))
  })
}

test('POST guardado y respuesta perdida: Atrás, reapertura y enlaces recuperan el resumen original', async (t) => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous })
  window.localStorage.clear()
  window.history.replaceState(null, '', '/appointments')
  const bodies: ConfirmPreparation[] = []
  const stored = new Map<string, HandoffDetail>()
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, preparation)
    const body: ConfirmPreparation = JSON.parse(config.data)
    bodies.push(body)
    if (!stored.has(body.requestId)) stored.set(body.requestId, saved)
    if (bodies.length === 1) throw new AxiosError('Respuesta perdida', 'ERR_NETWORK', config)
    return ok(config, stored.get(body.requestId))
  }
  const user = { id: 77, name: 'Ficticio', email: 'ficticio@example.invalid', role: 'USER', createdAt: '' }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => {
    await act(async () => root.unmount())
    forgetSummarySession(summarySession(user.id))
    window.localStorage.clear()
    container.remove()
  })
  await act(async () => root.render(
    <StrictMode>
      <AuthContext.Provider value={{ user, isAuthenticated: true, isLoading: false, restoreError: null,
        retryRestore: async () => {}, login: async () => true, register: async () => true, logout: async () => {}, loginWithGoogle: async () => true, updateUser: () => {} }}>
        <BrowserRouter>
          <Link to="/appointments">Ir a citas</Link>
          <Routes>
            <Route path="/appointments" element={<Link to="/summary">Abrir cita</Link>} />
            <Route path="/summary" element={<ConsultationSummaryPage subjectId={2} consultationId={5} />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </StrictMode>,
  ))
  const follow = async (text: string) => {
    const link = [...container.querySelectorAll('a')].find((link) => link.textContent === text)
    assert.ok(link, text)
    await act(async () => link.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
  }
  await follow('Abrir cita')
  await click(container, 'Revisar resumen')
  const saveButton = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Validar y guardar')!
  await act(async () => { saveButton.click(); saveButton.click() })
  assert.equal(bodies.length, 1)
  assert.equal(stored.size, 1)
  const close = new dom.window.Event('beforeunload', { cancelable: true })
  window.dispatchEvent(close)
  assert.equal(close.defaultPrevented, true)
  assert.equal(window.localStorage.getItem('yuyay.summary-history-check-required'), '1')
  assert.deepEqual(Object.keys(window.localStorage), ['yuyay.summary-history-check-required'])
  await historyStep(() => window.history.back())
  assert.equal(window.location.pathname, '/appointments')
  await follow('Abrir cita')
  assert.match(container.textContent ?? '', /No sabemos si se guardó/)
  assert.equal(container.querySelector('textarea'), null)
  await follow('Ir a citas')
  await follow('Abrir cita')
  assert.match(container.textContent ?? '', /No sabemos si se guardó/)
  await click(container, 'Reintentar el mismo guardado')
  assert.equal(stored.size, 1)
  assert.equal(bodies.length, 2)
  assert.deepEqual(bodies[0], bodies[1])
  assert.match(container.textContent ?? '', /Resumen guardado|Pregunta guardada/)
  assert.equal(window.localStorage.getItem('yuyay.summary-history-check-required'), null)
  const after = new dom.window.Event('beforeunload', { cancelable: true })
  window.dispatchEvent(after)
  assert.equal(after.defaultPrevented, false)
  await follow('Ir a citas')
  assert.equal(window.location.pathname, '/appointments')
})

test('tras recarga o reinicio la marca sin datos médicos exige comprobar el historial', async (t) => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous; window.localStorage.clear() })
  window.localStorage.setItem('yuyay.summary-history-check-required', '1')
  let reads = 0
  api.defaults.adapter = async (config) => { reads++; assert.equal(config.method, 'get'); return ok(config, preparation) }
  const container = await mount(t)
  assert.match(container.textContent ?? '', /Tras recargar o cerrar/)
  assert.equal(reads, 0)
  assert.equal(container.querySelector('textarea'), null)
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/people/2?tab=handoffs')
  assert.equal(window.localStorage.getItem('yuyay.summary-history-check-required'), '1')
  await click(container, 'Ya comprobé el historial; iniciar una revisión nueva')
  assert.equal(reads, 1)
  assert.ok(container.querySelector('textarea'))
  await click(container, 'Cancelar')
})

test('perder autorización elimina el contenido revisado y permite salir sin declarar cancelado el POST', async (t) => {
  const previous = api.defaults.adapter
  t.after(() => { api.defaults.adapter = previous; window.localStorage.clear() })
  window.localStorage.clear()
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, preparation)
    throw new AxiosError('Forbidden', '', config, undefined, { ...ok(config, {}), status: 403 })
  }
  const container = await mount(t)
  await click(container, 'Revisar resumen')
  await click(container, 'Validar y guardar')
  assert.match(container.textContent ?? '', /No tienes autorización/)
  assert.doesNotMatch(container.textContent ?? '', /Detalle revisado|Nota revisada|Control ficticio/)
  assert.equal(window.localStorage.getItem('yuyay.summary-history-check-required'), null)
  const close = new dom.window.Event('beforeunload', { cancelable: true })
  window.dispatchEvent(close)
  assert.equal(close.defaultPrevented, false)
  await click(container, 'Cancelar')
})
