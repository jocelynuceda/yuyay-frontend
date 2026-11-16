// El perfil clínico de la web sigue a la app móvil (SubjectDetailScreen): una sección por categoría, sin exámenes.
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act } from 'react'
import { ClinicalProfile } from '../src/pages/entries/ClinicalProfile'
import { api } from '../src/services/http'
import type { CategoryCode, HealthEntry, Page } from '../src/types'
import { groupByCategory, PROFILE_CATEGORIES } from '../src/utils/clinicalProfile'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')

function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  t.after(() => { api.defaults.adapter = previous })
}

const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })

function entry(id: number, categoryCode: CategoryCode, title: string, extra: Partial<HealthEntry['latestVersion']> = {}, deletedAt: string | null = null): HealthEntry {
  const user = { id: 8, name: 'Valentina' }
  return {
    id, careSubjectId: 4, categoryCode, categoryName: categoryCode, createdBy: user, createdAt: '2026-11-15T10:00:00Z', deletedAt,
    latestVersion: {
      id: id * 10, versionNumber: 1, changeType: 'CREATED', title, details: null, dose: null, frequency: null,
      occurredOn: null, confidenceLevel: 'CONFIRMED', notes: null, declaredBy: user, declaredAt: '2026-11-15T10:00:00Z',
      sourceAttachmentId: null, ...extra,
    },
  }
}

const entries = [
  entry(1, 'MEDICATION', 'Losartán', { dose: '1 tableta', frequency: 'Cada 12 h' }),
  entry(2, 'ALLERGY', 'Penicilina', { confidenceLevel: 'UNCERTAIN' }),
  entry(3, 'EXAM_RESULT', 'Hemograma'),
  entry(4, 'MEDICATION', 'Borrado', {}, '2026-11-15T12:00:00Z'),
  entry(5, 'MEDICATION', 'Metformina'),
]

test('groupByCategory deja fuera los exámenes y los registros borrados', () => {
  assert.deepEqual(PROFILE_CATEGORIES, ['ALLERGY', 'CONDITION', 'MEDICATION', 'IMMUNIZATION', 'EPISODE'])
  const groups = groupByCategory(entries)
  assert.deepEqual(groups.get('MEDICATION')?.map((e) => e.latestVersion.title), ['Losartán', 'Metformina'])
  assert.deepEqual(groups.get('ALLERGY')?.map((e) => e.latestVersion.title), ['Penicilina'])
  assert.equal(groups.get('CONDITION')?.length, 0)
  assert.equal(groups.has('EXAM_RESULT'), false)
})

test('El perfil clínico junta todas las páginas, despliega categorías y avisa al abrir o agregar', async (t) => {
  const pages: number[] = []
  mockApi(t, async (config) => {
    assert.equal(config.url, '/care-subjects/4/health-entries')
    const { page, size } = config.params
    assert.equal(size, 100)
    pages.push(page)
    const content = page === 0 ? entries.slice(0, 3) : entries.slice(3)
    const result: Page<HealthEntry> = { content, number: page, size, totalElements: entries.length, totalPages: 2 }
    return ok(config, result)
  })
  const opened: number[] = []
  const added: CategoryCode[] = []
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => {
    await act(async () => root.unmount())
    container.remove()
  })
  await act(async () => root.render(
    <ClinicalProfile subjectId={4} onOpenEntry={(e) => opened.push(e.id)} onAddEntry={(c) => added.push(c)} />,
  ))

  assert.deepEqual(pages, [0, 1])
  const headers = [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')]
  assert.deepEqual(headers.map((b) => b.querySelector('span')?.textContent), ['Alergias', 'Condiciones', 'Medicación', 'Vacunas', 'Episodios'])
  assert.ok(headers.every((b) => b.getAttribute('aria-expanded') === 'false'))
  // Contador: 2 medicamentos vigentes (el borrado no cuenta), ninguno en condiciones
  const medication = headers[2]
  assert.equal(medication.querySelector('[aria-label]')?.getAttribute('aria-label'), '2 registros')
  assert.equal(headers[1].querySelector('[aria-label]'), null)

  // Se pueden abrir varias a la vez
  await act(async () => medication.click())
  await act(async () => headers[1].click())
  assert.equal(medication.getAttribute('aria-expanded'), 'true')
  assert.match(container.textContent ?? '', /Losartán.*1 tableta · Cada 12 h/)
  assert.match(container.textContent ?? '', /Aún no hay registros de condiciones\./)
  assert.doesNotMatch(container.textContent ?? '', /Borrado|Hemograma/)

  const losartan = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Losartán'))
  await act(async () => losartan?.click())
  assert.deepEqual(opened, [1])
  const add = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Agregar medicación')
  await act(async () => add?.click())
  assert.deepEqual(added, ['MEDICATION'])

  await act(async () => medication.click())
  assert.equal(medication.getAttribute('aria-expanded'), 'false')
  assert.doesNotMatch(container.textContent ?? '', /Losartán/)
})
