import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import { ToastProvider } from '../src/contexts/ToastContext'
import { ConsultationsPanel } from '../src/pages/care/ConsultationsPanel'
import { HandoffsPanel } from '../src/pages/care/HandoffsPanel'
import { todayIso } from '../src/schemas/common'
import { api } from '../src/services/http'
import type { Handoff, HandoffDetail, Page } from '../src/types'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')

function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  t.after(() => { api.defaults.adapter = previous })
}

const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })

async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const render = (view: ReactNode) => act(async () => root.render(
    <MemoryRouter><ToastProvider>{view}</ToastProvider></MemoryRouter>,
  ))
  t.after(async () => {
    await act(async () => root.unmount())
    container.remove()
  })
  await render(node)
  return { container, render }
}

async function click(root: ParentNode, label: string) {
  const button = [...root.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)
  assert.ok(button, `Falta el botón ${label}`)
  await act(async () => button.click())
}

const handoff: Handoff = {
  id: 1, careSubjectId: 4, createdByUserId: 8, reason: 'Control anual', questions: '¿Repetir el examen?',
  createdAt: '2026-11-06T14:00:00Z',
}
const older: Handoff = { ...handoff, id: 2, reason: 'Control anterior', createdAt: '2026-10-02T14:00:00Z' }
const detail: HandoffDetail = {
  ...handoff,
  items: [{
    healthEntryId: 11, healthEntryVersionId: 12, categoryCode: 'EXAM_RESULT', versionNumber: 1, changeType: 'CREATED',
    title: 'Hemograma de octubre', details: null, dose: null, frequency: null, occurredOn: null,
    confidenceLevel: 'CONFIRMED', notes: null, declaredAt: '2026-11-05T14:00:00Z',
  }],
}

test('El historial de arreglos se ordena y abre el detalle privado bajo demanda', async (t) => {
  const requests: InternalAxiosRequestConfig[] = []
  let finishDetail = () => {}
  mockApi(t, async (config) => {
    requests.push(config)
    if (config.url === '/care-subjects/4/handoffs') return ok(config, [older, handoff])
    if (config.url === '/handoffs/2') {
      throw new AxiosError('Not found', 'ERR_BAD_REQUEST', config, undefined, {
        ...ok(config, { message: 'Resumen no encontrado.' }), status: 404, statusText: 'Not Found',
      })
    }
    assert.equal(config.url, '/handoffs/1')
    if (requests.length === 2) await new Promise<void>((resolve) => { finishDetail = resolve })
    return ok(config, detail)
  })
  const { container } = await mount(t, <HandoffsPanel subjectId={4} />)

  assert.deepEqual([...container.querySelectorAll('h3')].map((heading) => heading.textContent), ['Control anual', 'Control anterior'])
  assert.equal(requests.length, 1)
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/personas/4/traspaso/nuevo')
  assert.equal(container.querySelector('a[href^="/traspaso/"]'), null)

  await click(container, 'Ver resumen')
  assert.match(container.querySelector('[role="status"]')?.textContent ?? '', /Cargando resumen/)
  await click(container, 'Ocultar resumen')
  assert.equal(requests[1]?.signal?.aborted, true)
  await act(async () => finishDetail())
  assert.doesNotMatch(container.textContent ?? '', /Hemograma|cancelada/)
  await click(container, 'Ver resumen')
  assert.match(container.textContent ?? '', /¿Repetir el examen\?/)
  assert.match(container.textContent ?? '', /Hemograma de octubre/)
  await click(container, 'Ver resumen')
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Resumen no encontrado/)
  assert.doesNotMatch(container.textContent ?? '', /Hemograma de octubre|¿Repetir el examen\?/)
  assert.ok(requests.every(({ method }) => method === 'get'))
})

test('El historial solicita la página del backend y permite regresar a la primera', async (t) => {
  const pages: number[] = []
  mockApi(t, async (config) => {
    assert.equal(config.url, '/care-subjects/4/handoffs')
    const { page, size } = config.params
    pages.push(page)
    const result: Page<Handoff> = {
      content: [page === 0 ? handoff : older], number: page, size, totalElements: 11, totalPages: 2,
    }
    return ok(config, result)
  })
  const { container } = await mount(t, <HandoffsPanel subjectId={4} />)
  assert.match(container.textContent ?? '', /Control anual/)
  await click(container, 'Siguiente')
  assert.match(container.textContent ?? '', /Control anterior/)
  assert.doesNotMatch(container.textContent ?? '', /Control anual/)
  assert.equal(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label'), 'Página 2')
  await click(container, 'Anterior')
  assert.match(container.textContent ?? '', /Control anual/)
  assert.deepEqual(pages, [0, 1, 0])
})

test('El historial cancela la carga anterior y distingue error recuperable de lista vacía', async (t) => {
  const requests: InternalAxiosRequestConfig[] = []
  let finishList = () => {}
  mockApi(t, async (config) => {
    requests.push(config)
    if (config.url === '/care-subjects/4/handoffs') {
      await new Promise<void>((resolve) => { finishList = resolve })
      return ok(config, [handoff])
    }
    assert.equal(config.url, '/care-subjects/5/handoffs')
    if (requests.length === 2) {
      throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, {
        ...ok(config, { message: 'No tienes acceso a estos resúmenes.' }), status: 403, statusText: 'Forbidden',
      })
    }
    return ok(config, [])
  })
  const { container, render } = await mount(t, <HandoffsPanel subjectId={4} />)
  assert.match(container.querySelector('[role="status"]')?.textContent ?? '', /Cargando resúmenes/)
  await render(<HandoffsPanel subjectId={5} />)
  assert.equal(requests[0]?.signal?.aborted, true)
  await act(async () => finishList())
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /No tienes acceso/)
  assert.doesNotMatch(container.textContent ?? '', /Control anual|Aún no hay resúmenes/)
  await click(container, 'Reintentar')
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.match(container.textContent ?? '', /Aún no hay resúmenes/)
})

test('Las próximas consultas de un cuidador ofrecen Calendar con hora guardada o todo el día', async (t) => {
  const today = todayIso()
  const consultation = { id: 1, careSubjectId: 4, createdByUserId: 8, date: today, createdAt: `${today}T00:00:00Z` }
  mockApi(t, async (config) => ok(config, config.url?.endsWith('/changes') ? [] : [
    { ...consultation, reason: 'Con hora', time: '10:30:00', notes: 'No compartir' },
    { ...consultation, id: 2, reason: 'Sin hora', time: null, notes: null },
    { ...consultation, id: 3, reason: 'Consulta pasada', date: '2000-01-01', time: null, notes: null },
  ]))
  const urls: string[] = []
  t.mock.method(window, 'open', (url: string) => { urls.push(url); return null })
  const { container } = await mount(t, <ConsultationsPanel subjectId={4} subjectName="Rosa" isPrincipal={false} />)

  const link = container.querySelector<HTMLAnchorElement>('a[href*="calendar.google.com"]')
  assert.ok(link)
  assert.equal(link.rel, 'noopener noreferrer')
  assert.equal(new URL(link.href).searchParams.get('text'), 'Cita de Rosa: Con hora')
  assert.doesNotMatch(link.href, /details|compartir/)
  assert.doesNotMatch([...container.querySelectorAll('li')].find((item) => item.textContent?.includes('Consulta pasada'))?.textContent ?? '', /Google Calendar/)
  assert.deepEqual(urls, [])

  await click(container, 'Agregar a Google Calendar')
  assert.equal(container.querySelector<HTMLInputElement>('dialog input[type="time"]')?.value, '09:00')
  await click(container, 'Cancelar')
  assert.deepEqual(urls, [])
  await click(container, 'Agregar a Google Calendar')
  const input = container.querySelector<HTMLInputElement>('dialog input[type="time"]')
  assert.ok(input)
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    setValue?.call(input, '23:30')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(container, 'Abrir Google Calendar')
  const start = new Date(`${today}T23:30:00`).toISOString().replace(/[-:]|\.000/g, '')
  assert.equal(new URL(urls[0]!).searchParams.get('dates')?.split('/')[0], start)
  await click(container, 'Agregar a Google Calendar')
  await click(container, 'Todo el día')
  assert.match(new URL(urls[1]!).searchParams.get('dates') ?? '', new RegExp(`^${today.replaceAll('-', '')}/\\d{8}$`))
  assert.equal(container.querySelector('dialog[open]'), null)
})
