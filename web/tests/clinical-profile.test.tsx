import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import type { CategoryCode, HealthEntry, Page } from '../src/types'
import { PROFILE_CATEGORIES } from '../src/utils/clinicalProfile'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { ClinicalProfile } = await import('../src/pages/entries/ClinicalProfile')
const { api } = await import('../src/services/http')

function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  t.after(() => { api.defaults.adapter = previous })
}
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
function entry(id: number, categoryCode: CategoryCode, title: string, createdAt: string, occurredOn = '2026-01-01'): HealthEntry {
  const user = { id: 8, name: 'Valentina' }
  return { id, careSubjectId: 4, categoryCode, categoryName: categoryCode, createdBy: user, createdAt, deletedAt: null,
    latestVersion: { id: id * 10, versionNumber: 1, changeType: 'CREATED', title, details: null, dose: null, frequency: null,
      occurredOn, confidenceLevel: 'CONFIRMED', notes: null, declaredBy: user, declaredAt: createdAt, sourceAttachmentId: null } }
}
const newestMedication = entry(2, 'MEDICATION', 'Medicación agregada hoy', '2026-11-20T10:00:00Z', '2020-01-01')
const olderMedication = entry(1, 'MEDICATION', 'Medicación agregada antes', '2026-11-19T10:00:00Z', '2026-11-19')
const exam = entry(3, 'EXAM_RESULT', 'Hemograma', '2026-11-20T12:00:00Z')
const zeroPage: Page<HealthEntry> = { content: [], number: 0, size: 1, totalElements: 0, totalPages: 0 }
async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const render = async (next: ReactNode) => { await act(async () => root.render(<MemoryRouter>{next}</MemoryRouter>)) }
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await render(node)
  return { container, render }
}
const header = (container: HTMLElement, code: CategoryCode) => container.querySelector<HTMLButtonElement>(`button[aria-controls="clinical-profile-4-${code}"]`)!
async function clickText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)
  assert.ok(button, text)
  await act(async () => { button.click() })
}

test('seis consultas de una fila dan totales completos y muestran sólo el último creado, incluidos exámenes', async (t) => {
  const requests: InternalAxiosRequestConfig[] = []
  const data = [olderMedication, newestMedication, exam]
  mockApi(t, async (config) => {
    requests.push(config)
    assert.equal(config.url, '/care-subjects/4/health-entries')
    assert.equal(config.params.page, 0)
    assert.equal(config.params.size, 1)
    assert.equal(config.params.sort, 'createdAt,desc')
    const category = data.filter((item) => item.categoryCode === config.params.category)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return ok(config, { content: category.slice(0, 1), totalElements: category.length, totalPages: category.length, number: 0, size: 1 })
  })
  const opened: number[] = [], added: CategoryCode[] = []
  let newEntries = 0
  const { container } = await mount(t, <ClinicalProfile subjectId={4} onOpenEntry={(item) => opened.push(item.id)}
    onAddEntry={(code) => added.push(code)} onNewEntry={() => { newEntries++ }} />)
  assert.deepEqual(PROFILE_CATEGORIES, ['ALLERGY', 'CONDITION', 'MEDICATION', 'IMMUNIZATION', 'EPISODE', 'EXAM_RESULT'])
  assert.equal(requests.length, 6)
  assert.deepEqual(new Set(requests.map((request) => request.params.category)), new Set(PROFILE_CATEGORIES))
  assert.equal(header(container, 'MEDICATION').querySelector('[aria-label]')!.getAttribute('aria-label'), '2 registros')
  assert.equal(header(container, 'CONDITION').querySelector('[aria-label]')!.getAttribute('aria-label'), '0 registros')
  assert.equal(header(container, 'EXAM_RESULT').querySelector('[aria-label]')!.getAttribute('aria-label'), '1 registro')
  for (const code of PROFILE_CATEGORIES) await act(async () => { header(container, code).click() })
  assert.match(container.textContent!, /Medicación agregada hoy/)
  assert.doesNotMatch(container.textContent!, /Medicación agregada antes/)
  assert.match(container.textContent!, /Hemograma/)
  assert.match(container.textContent!, /Aún no hay registros de condiciones/)
  const labels = ['Ver todas las alergias', 'Ver todas las condiciones', 'Ver todas las medicaciones', 'Ver todas las vacunas', 'Ver todos los episodios', 'Ver todos los exámenes']
  assert.deepEqual([...container.querySelectorAll('a')].map((link) => link.textContent), labels)
  assert.deepEqual([...container.querySelectorAll('a')].map((link) => link.getAttribute('href')),
    PROFILE_CATEGORIES.map((code) => `/people/4/entries?category=${code}`))
  await clickText(container, 'Nuevo registro')
  await clickText(container, 'Agregar medicación')
  await clickText(container, 'Agregar examen')
  const newest = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Medicación agregada hoy'))!
  await act(async () => { newest.click() })
  assert.equal(newEntries, 1)
  assert.deepEqual(added, ['MEDICATION', 'EXAM_RESULT'])
  assert.deepEqual(opened, [2])
  assert.equal(requests.length, 6, 'abrir acordeones no descarga el historial ni páginas siguientes')
})

test('initialCategory abre el recién guardado al remontar y conserva las elecciones durante renders normales', async (t) => {
  let requests = 0
  mockApi(t, async (config) => { requests++; return ok(config, zeroPage) })
  const props = { subjectId: 4, onOpenEntry: () => {}, onAddEntry: () => {} }
  const { container, render } = await mount(t, <ClinicalProfile key="first" {...props} initialCategory="EXAM_RESULT" />)
  assert.equal(header(container, 'EXAM_RESULT').getAttribute('aria-expanded'), 'true')
  assert.equal(header(container, 'MEDICATION').getAttribute('aria-expanded'), 'false')
  await act(async () => { header(container, 'MEDICATION').click() })
  await render(<ClinicalProfile key="first" {...props} initialCategory="CONDITION" />)
  assert.equal(header(container, 'MEDICATION').getAttribute('aria-expanded'), 'true')
  assert.equal(header(container, 'CONDITION').getAttribute('aria-expanded'), 'false')
  assert.equal(requests, 6)
  await render(<ClinicalProfile key="after-save" {...props} initialCategory="CONDITION" />)
  assert.equal(header(container, 'CONDITION').getAttribute('aria-expanded'), 'true')
  assert.equal(header(container, 'EXAM_RESULT').getAttribute('aria-expanded'), 'false')
  assert.equal(requests, 12)
})

test('un error de categoría no inventa cero ni bloquea las demás, y reintenta sólo esa consulta', async (t) => {
  const reads: CategoryCode[] = []
  let failMedication = true
  mockApi(t, async (config) => {
    reads.push(config.params.category)
    if (config.params.category === 'MEDICATION') {
      if (failMedication) throw new AxiosError('Timeout', 'ECONNABORTED', config)
      return ok(config, { ...zeroPage, content: [newestMedication], totalElements: 57, totalPages: 57 })
    }
    return ok(config, config.params.category === 'EXAM_RESULT' ? { ...zeroPage, content: [exam], totalElements: 1, totalPages: 1 } : zeroPage)
  })
  const { container } = await mount(t, <ClinicalProfile subjectId={4} initialCategory="MEDICATION" onOpenEntry={() => {}} onAddEntry={() => {}} />)
  assert.equal(reads.length, 6)
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /tardó demasiado/)
  assert.equal(header(container, 'MEDICATION').querySelector('[aria-label]'), null)
  assert.doesNotMatch(container.textContent!, /Aún no hay registros de medicación/)
  await act(async () => { header(container, 'EXAM_RESULT').click() })
  assert.match(container.textContent!, /Hemograma/)
  failMedication = false
  await clickText(container, 'Reintentar')
  assert.equal(reads.length, 7)
  assert.equal(reads.at(-1), 'MEDICATION')
  assert.equal(header(container, 'MEDICATION').querySelector('[aria-label]')!.getAttribute('aria-label'), '57 registros')
  assert.equal(container.querySelector('[role="alert"]'), null)
})

test('cambiar de persona cancela las seis cargas y descarta sus resultados tardíos', async (t) => {
  const stale: InternalAxiosRequestConfig[] = []
  const releases: (() => void)[] = []
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/4/health-entries') {
      stale.push(config)
      await new Promise<void>((resolve) => releases.push(resolve))
      return ok(config, { ...zeroPage, content: [newestMedication], totalElements: 1 })
    }
    assert.equal(config.url, '/care-subjects/5/health-entries')
    return ok(config, zeroPage)
  })
  const props = { onOpenEntry: () => {}, onAddEntry: () => {}, initialCategory: 'MEDICATION' as const }
  const { container, render } = await mount(t, <ClinicalProfile subjectId={4} {...props} />)
  assert.equal(stale.length, 6)
  await render(<ClinicalProfile subjectId={5} {...props} />)
  assert.ok(stale.every((request) => request.signal?.aborted))
  await act(async () => { releases.forEach((release) => release()) })
  assert.doesNotMatch(container.textContent!, /Medicación agregada hoy/)
  assert.match(container.textContent!, /Aún no hay registros de medicación/)
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/people/5/entries?category=MEDICATION')
})
