import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { JSDOM } from 'jsdom'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { act, type ReactNode } from 'react'
import type { CategoryCode, HealthEntry, Page } from '../src/types'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', pretendToBeVisual: true })
dom.window.scrollTo = () => {}
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})
const { createRoot } = await import('react-dom/client')
const { Link, MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
const { default: EntriesRoute } = await import('../src/pages/entries/EntriesRoute')
const { default: EntryDetailRoute } = await import('../src/pages/entries/EntryDetailRoute')
const { EntriesPanel } = await import('../src/pages/entries/EntriesPanel')
const { ToastProvider } = await import('../src/contexts/ToastContext')
const { api, clearTokens, setTokens } = await import('../src/services/http')
const { getHealthEntry, listHealthEntries } = await import('../src/services/api/healthEntries')

const subject = { id: 4, name: 'Persona ficticia', birthDate: null, notes: null, createdAt: '2026-01-01T00:00:00Z', myRole: 'CAREGIVER' }
function entry(id: number, title: string, category: CategoryCode = 'CONDITION'): HealthEntry {
  return { id, careSubjectId: 4, categoryCode: category, categoryName: category === 'CONDITION' ? 'Condición' : 'Alergia',
    createdBy: { id: 8, name: 'Cuidador' }, createdAt: '2026-01-01T00:00:00Z', deletedAt: null,
    latestVersion: { id: id + 100, versionNumber: 1, changeType: 'CREATED', title, details: 'Detalle revisado', dose: null,
      frequency: null, occurredOn: null, confidenceLevel: 'CONFIRMED', notes: null, declaredBy: { id: 8, name: 'Cuidador' },
      declaredAt: '2026-01-01T00:00:00Z', sourceAttachmentId: null } }
}
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
const denied = (config: InternalAxiosRequestConfig, status = 403, message = 'Se retiró el acceso.') =>
  new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, { message }), status })
const gate = () => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => { release = resolve })
  return { wait, release }
}
function page(content: HealthEntry[], number = 0, size = 10, totalElements = content.length): Page<HealthEntry> {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) }
}
function isForbidden(error: unknown) {
  return error instanceof AxiosError && error.response?.status === 403
}
function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  t.after(() => { api.defaults.adapter = previous })
}
function LocationMarker() {
  const location = useLocation()
  return <><output data-testid="location">{location.pathname}{location.search}</output><output data-testid="state">{JSON.stringify(location.state)}</output></>
}
function EntryRoutes() {
  return <><LocationMarker /><Routes>
    <Route path="/people/:id/entries" element={<EntriesRoute />} />
    <Route path="/people/:id/entries/:entryId" element={<EntryDetailRoute />} />
    <Route path="/people/:id" element={<p>Perfil clínico de la persona</p>} />
  </Routes></>
}
async function mount(t: TestContext, node: ReactNode, initialPath = '/') {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const render = async (next: ReactNode) => { await act(async () => root.render(<MemoryRouter initialEntries={[initialPath]}><ToastProvider>{next}</ToastProvider></MemoryRouter>)) }
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await render(node)
  return { container, render }
}
function textOf(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[aria-hidden="true"]').forEach((child) => child.remove())
  return clone.textContent?.trim()
}
async function click(container: ParentNode, label: string, selector = 'button') {
  const node = [...container.querySelectorAll<HTMLElement>(selector)].find((candidate) => textOf(candidate) === label)
  assert.ok(node, `Falta ${label}`)
  await act(async () => { node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) })
}
async function fill(container: ParentNode, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)
  assert.ok(input, selector)
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

test('la categoría usa la página real del backend y conserva filtros al ir al detalle y Regresar', async (t) => {
  const selected = entry(11, 'Condición página dos')
  const queries: Record<string, unknown>[] = []
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/4') return ok(config, subject)
    if (config.url === '/care-subjects/4/health-entries/11') return ok(config, selected)
    if (config.url === '/care-subjects/4/health-entries/11/versions') return ok(config, [selected.latestVersion])
    assert.equal(config.url, '/care-subjects/4/health-entries')
    queries.push({ ...config.params })
    const { category, page: number, size } = config.params
    return ok(config, page([category === 'ALLERGY' ? entry(12, 'Alergia filtrada', 'ALLERGY') : selected], number, size, number === 1 ? 11 : 1))
  })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries?category=CONDITION&page=2&size=10')
  const location = () => container.querySelector('[data-testid="location"]')?.textContent
  assert.equal(container.querySelector('h1')?.textContent, 'Condiciones')
  assert.deepEqual(queries[0], { category: 'CONDITION', page: 1, size: 10, sort: 'createdAt,desc' })
  await click(container, 'Condición página dos')
  assert.equal(location(), '/people/4/entries/11')
  assert.deepEqual(JSON.parse(container.querySelector('[data-testid="state"]')!.textContent!), { returnTo: '/people/4/entries?category=CONDITION&page=2' })
  await click(container, 'Regresar', 'a')
  assert.equal(location(), '/people/4/entries?category=CONDITION&page=2')
  assert.deepEqual(queries[1], queries[0])
  await click(container, 'Alergias')
  assert.equal(location(), '/people/4/entries?category=ALLERGY')
  assert.equal(container.querySelector('h1')?.textContent, 'Alergias')
  const sizeSelect = container.querySelector<HTMLSelectElement>('nav[aria-label="Paginación"] select')!
  await act(async () => { sizeSelect.value = '25'; sizeSelect.dispatchEvent(new window.Event('change', { bubbles: true })) })
  assert.equal(location(), '/people/4/entries?category=ALLERGY&size=25')
  assert.deepEqual(queries.at(-1), { category: 'ALLERGY', page: 0, size: 25, sort: 'createdAt,desc' })
  await click(container, 'Regresar al perfil clínico', 'a')
  assert.equal(location(), '/people/4?tab=entries')
})

test('nuevo registro preselecciona categoría; cancelar no escribe y guardar muestra la categoría elegida en página uno conservando tamaño', async (t) => {
  let writes = 0
  const pages: number[] = []
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/4') return ok(config, subject)
    assert.equal(config.url, '/care-subjects/4/health-entries')
    if (config.method === 'post') {
      writes++
      const body = JSON.parse(config.data)
      assert.equal(body.categoryCode, 'ALLERGY')
      assert.equal(body.title, 'Alergia nueva')
      return ok(config, entry(30, body.title, 'ALLERGY'))
    }
    assert.equal(config.params.category, writes ? 'ALLERGY' : 'CONDITION')
    assert.equal(config.params.size, 25)
    pages.push(config.params.page)
    return ok(config, page([entry(writes ? 30 : 11, writes ? 'Alergia nueva' : 'Registro previo', writes ? 'ALLERGY' : 'CONDITION')], config.params.page, 25, writes ? 27 : 26))
  })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries?category=CONDITION&page=2&size=25')
  await click(container, 'Nuevo registro')
  assert.equal(container.querySelector<HTMLInputElement>('input[name="categoryCode"]:checked')?.value, 'CONDITION')
  await fill(container, '#entry-title', 'Borrador cancelado')
  await click(container, 'Cancelar')
  assert.equal(writes, 0)
  assert.equal(container.querySelector('form'), null)
  assert.deepEqual(pages, [1])
  await click(container, 'Nuevo registro')
  const allergyRadio = container.querySelector<HTMLInputElement>('input[name="categoryCode"][value="ALLERGY"]')!
  await act(async () => { allergyRadio.click() })
  await fill(container, '#entry-title', 'Alergia nueva')
  await click(container, 'Registrar')
  assert.equal(writes, 1)
  assert.equal(container.querySelector('form'), null)
  assert.equal(container.querySelector('[data-testid="location"]')?.textContent, '/people/4/entries?category=ALLERGY&size=25')
  assert.deepEqual(pages, [1, 0])
  assert.match(container.textContent!, /Alergia nueva/)
  assert.doesNotMatch(container.textContent!, /Registro previo|Borrador cancelado/)
})

test('cambiar página, filtro o persona oculta filas anteriores, cancela respuestas pendientes y no muestra datos tras 403', async (t) => {
  let finishPage!: () => void
  let pendingSignal: AbortSignal | undefined
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/5/health-entries') {
      throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, { message: 'No tienes acceso a esta persona.' }), status: 403 })
    }
    assert.equal(config.url, '/care-subjects/4/health-entries')
    if (config.params.page === 1) {
      pendingSignal = config.signal as AbortSignal
      await new Promise<void>((resolve) => { finishPage = resolve })
      return ok(config, page([entry(2, 'Página obsoleta')], 1, 10, 11))
    }
    const allergy = config.params.category === 'ALLERGY'
    return ok(config, page([entry(1, allergy ? 'Alergia vigente' : 'Condición anterior', allergy ? 'ALLERGY' : 'CONDITION')]))
  })
  const view = (subjectId: number, category: CategoryCode, pageNumber: number) => <EntriesPanel subjectId={subjectId}
    params={{ category, page: pageNumber, size: 10 }} onParamsChange={() => {}} onOpenEntry={() => {}} />
  const { container, render } = await mount(t, view(4, 'CONDITION', 1))
  assert.match(container.textContent!, /Condición anterior/)
  await render(view(4, 'CONDITION', 2))
  assert.match(container.querySelector('[role="status"]')?.textContent ?? '', /Cargando registros/)
  assert.doesNotMatch(container.textContent!, /Condición anterior|Página obsoleta/)
  assert.equal(container.querySelector('nav[aria-label="Paginación"]'), null)
  await render(view(4, 'ALLERGY', 1))
  assert.equal(pendingSignal?.aborted, true)
  await act(async () => { finishPage() })
  assert.match(container.textContent!, /Alergia vigente/)
  assert.doesNotMatch(container.textContent!, /Condición anterior|Página obsoleta/)
  await render(view(5, 'ALLERGY', 1))
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /No tienes acceso/)
  assert.doesNotMatch(container.textContent!, /Alergia vigente|Condición anterior|Página obsoleta/)
})

test('una página fuera de rango permite volver al inicio aun cuando la categoría esté vacía', async (t) => {
  const pages: number[] = []
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/4') return ok(config, subject)
    assert.equal(config.url, '/care-subjects/4/health-entries')
    pages.push(config.params.page)
    return ok(config, page([], config.params.page, config.params.size))
  })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries?category=CONDITION&page=99')
  assert.match(container.textContent!, /Esta página no existe/)
  await click(container, 'Ir a la primera página')
  assert.deepEqual(pages, [98, 0])
  assert.equal(container.querySelector('[data-testid="location"]')?.textContent, '/people/4/entries?category=CONDITION')
  assert.match(container.textContent!, /No hay registros de condiciones/)
})

test('una denegación retira el registro abierto, cancela lecturas tardías y protege la reentrada', async (t) => {
  const loaded = entry(11, 'Registro privado ficticio')
  const staleSubject = gate()
  const staleEntry = gate()
  const staleEntryStarted = gate()
  let subjectReads = 0
  let entryReads = 0
  let accessRemoved = false
  let staleSubjectSignal: AbortSignal | undefined
  mockApi(t, async (config) => {
    switch (config.url) {
      case '/care-subjects/4':
        if (++subjectReads === 2) {
          staleSubjectSignal = config.signal as AbortSignal
          await staleSubject.wait
        } else if (accessRemoved) throw denied(config, 404)
        return ok(config, subject)
      case '/care-subjects/4/health-entries/11':
        if (++entryReads === 2) {
          staleEntryStarted.release()
          await staleEntry.wait
        }
        return ok(config, loaded)
      case '/care-subjects/4/health-entries/11/versions': return ok(config, [loaded.latestVersion])
      case '/care-subjects/4/health-entries': throw denied(config)
      default: assert.fail(`Petición inesperada ${config.url}`)
    }
  })
  const path = '/people/4/entries/11'
  const { container } = await mount(t, <><Link to={path}>Volver al detalle</Link><EntryRoutes /></>, path)
  assert.match(container.textContent!, /Registro privado ficticio/)
  assert.match(container.textContent!, /Persona ficticia/)
  await act(async () => {
    window.dispatchEvent(new window.Event('focus'))
    document.dispatchEvent(new window.Event('visibilitychange'))
  })
  assert.equal(subjectReads, 2, 'focus y visibilitychange comparten la comprobación pendiente')
  const lateRead = assert.rejects(getHealthEntry(4, 11), { code: 'ERR_CANCELED' })
  await staleEntryStarted.wait
  await act(async () => {
    accessRemoved = true
    await assert.rejects(listHealthEntries(4), isForbidden)
  })
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /No tienes acceso/)
  assert.doesNotMatch(container.textContent!, /Registro privado ficticio|Persona ficticia|Detalle revisado/)
  assert.equal(container.querySelector('dialog'), null)
  assert.equal(staleSubjectSignal?.aborted, true)

  await act(async () => { staleSubject.release(); staleEntry.release(); await lateRead })
  assert.doesNotMatch(container.textContent!, /Registro privado ficticio|Persona ficticia/)
  await click(container, 'Regresar', 'a')
  await click(container, 'Volver al detalle', 'a')
  assert.equal(subjectReads, 3, 'la entrada verifica de nuevo los permisos')
  assert.equal(entryReads, 2, 'la entrada denegada no vuelve a consultar el registro')
  assert.doesNotMatch(container.textContent!, /Registro privado ficticio|Persona ficticia/)
})

test('un 403 al borrar conserva el registro mientras la persona siga accesible y lo retira al perder el permiso', async (t) => {
  const loaded = entry(11, 'Registro de solo lectura')
  let accessible = true
  let subjectReads = 0
  mockApi(t, async (config) => {
    switch (config.url) {
      case '/care-subjects/4':
        subjectReads++
        if (!accessible) throw denied(config, 410)
        return ok(config, subject)
      case '/care-subjects/4/health-entries/11':
        if (config.method === 'delete') throw denied(config, 403, 'Solo el autor puede borrar el registro.')
        return ok(config, loaded)
      case '/care-subjects/4/health-entries/11/versions': return ok(config, [loaded.latestVersion])
      default: assert.fail(`Petición inesperada ${config.url}`)
    }
  })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries/11')
  await click(container, 'Borrar')
  await click(container, 'Borrar registro')
  assert.equal(subjectReads, 2)
  assert.match(container.querySelector('dialog[open] [role="alert"]')?.textContent ?? '', /Solo el autor/)
  assert.equal(container.querySelector('h1')?.textContent, 'Registro de solo lectura')
  await click(container, 'Cancelar')
  await click(container, 'Borrar')
  accessible = false
  await click(container, 'Borrar registro')
  assert.equal(subjectReads, 3)
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Se retiró el acceso/)
  assert.doesNotMatch(container.textContent!, /Registro de solo lectura|Persona ficticia|Detalle revisado/)
  assert.equal(container.querySelector('dialog'), null)
})

test('la denegación de lectura de un registro se muestra sin esperar a que llegue su historial', async (t) => {
  const loaded = entry(11, 'Registro que deja de ser accesible')
  const staleHistory = gate()
  let saved = false
  let subjectReads = 0
  mockApi(t, async (config) => {
    switch (config.url) {
      case '/care-subjects/4':
        subjectReads++
        return ok(config, subject)
      case '/care-subjects/4/health-entries/11':
        if (config.method === 'patch') {
          saved = true
          return ok(config, entry(11, 'Título editado'))
        }
        if (saved) throw denied(config, 403, 'El registro ya no está disponible para ti.')
        return ok(config, loaded)
      case '/care-subjects/4/health-entries/11/versions':
        if (saved) await staleHistory.wait
        return ok(config, [loaded.latestVersion])
      default: assert.fail(`Petición inesperada ${config.url}`)
    }
  })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries/11')
  assert.equal(container.querySelector('h1')?.textContent, loaded.latestVersion.title)
  await click(container, 'Editar')
  await fill(container, '#entry-title', 'Título editado')
  await click(container, 'Guardar cambios')
  assert.equal(saved, true)
  assert.equal(subjectReads, 2)
  assert.match(container.textContent!, /Persona ficticia/)
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /El registro ya no está disponible/)
  assert.doesNotMatch(container.textContent!, /Registro que deja de ser accesible|Detalle revisado/)
  await act(async () => staleHistory.release())
  assert.doesNotMatch(container.textContent!, /Registro que deja de ser accesible|Detalle revisado/)
})

test('una denegación de otra persona o de una sesión anterior no cierra el registro activo', async (t) => {
  const loaded = entry(11, 'Registro de la sesión actual')
  const oldSession = gate()
  const oldReadStarted = gate()
  setTokens({ accessToken: 'demo-anterior', refreshToken: 'demo-renovación-anterior' })
  t.after(clearTokens)
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/5/health-entries') throw denied(config)
    if (config.url === '/care-subjects/4/health-entries') {
      assert.equal(config.headers.get('Authorization'), 'Bearer demo-anterior')
      oldReadStarted.release()
      await oldSession.wait
      throw denied(config)
    }
    assert.equal(config.headers.get('Authorization'), 'Bearer demo-actual')
    if (config.url === '/care-subjects/4') return ok(config, subject)
    if (config.url === '/care-subjects/4/health-entries/11') return ok(config, loaded)
    if (config.url === '/care-subjects/4/health-entries/11/versions') return ok(config, [loaded.latestVersion])
    assert.fail(`Petición inesperada ${config.url}`)
  })
  const lateDenial = assert.rejects(listHealthEntries(4), { code: 'ERR_CANCELED' })
  await oldReadStarted.wait
  setTokens({ accessToken: 'demo-actual', refreshToken: 'demo-renovación-actual' })
  const { container } = await mount(t, <EntryRoutes />, '/people/4/entries/11')
  await act(async () => {
    await assert.rejects(listHealthEntries(5), isForbidden)
    oldSession.release()
    await lateDenial
  })
  assert.equal(container.querySelector('h1')?.textContent, 'Registro de la sesión actual')
  assert.equal(container.querySelector('[role="alert"]'), null)
})
