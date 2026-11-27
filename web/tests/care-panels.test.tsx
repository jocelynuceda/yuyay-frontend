import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import { ToastProvider } from '../src/contexts/ToastContext'
import { ConsultationsPanel } from '../src/pages/care/ConsultationsPanel'
import { HandoffsPanel } from '../src/pages/care/HandoffsPanel'
import { HandoffWorkspacePage } from '../src/pages/handoff/HandoffWorkspacePage'
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

test('El historial se ordena y ofrece páginas de detalle sin desplegar datos ni enlaces en la lista', async (t) => {
  const requests: InternalAxiosRequestConfig[] = []
  mockApi(t, async (config) => {
    requests.push(config)
    assert.equal(config.url, '/care-subjects/4/handoffs')
    return ok(config, [older, handoff])
  })
  const { container } = await mount(t, <HandoffsPanel subjectId={4} isPrincipal={false} userId={99} />)

  assert.deepEqual([...container.querySelectorAll('h3')].map((heading) => heading.textContent), ['Control anual', 'Control anterior'])
  assert.equal(requests.length, 1)
  assert.equal(container.querySelector('a')?.getAttribute('href'), '/people/4/handoff/new')
  assert.equal(container.querySelector('a[href^="/handoff/"]'), null)
  assert.equal(container.querySelector('a[href="/people/4/handoffs/1"]')?.textContent?.trim(), 'Ver resumen')
  assert.equal(container.querySelector('a[href="/people/4/handoffs/2"]')?.textContent?.trim(), 'Ver resumen')
  assert.equal(container.querySelector('[aria-expanded]'), null)
  assert.doesNotMatch(container.textContent ?? '', /Hemograma|cancelada/)
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
  const { container } = await mount(t, <HandoffsPanel subjectId={4} isPrincipal={false} userId={99} />)
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
  const { container, render } = await mount(t, <HandoffsPanel subjectId={4} isPrincipal={false} userId={99} />)
  assert.match(container.querySelector('[role="status"]')?.textContent ?? '', /Cargando resúmenes/)
  await render(<HandoffsPanel subjectId={5} isPrincipal={false} userId={99} />)
  assert.equal(requests[0]?.signal?.aborted, true)
  await act(async () => finishList())
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /No tienes acceso/)
  assert.doesNotMatch(container.textContent ?? '', /Control anual|Aún no hay resúmenes/)
  await click(container, 'Reintentar')
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.match(container.textContent ?? '', /Aún no hay resúmenes/)
})

test('el título de preguntas queda fuera de la tarjeta, conserva las líneas y se omite sin preguntas', async (t) => {
  const questions = '¿Cuándo repetir el examen?\n¿Qué debemos anotar?'
  mockApi(t, async (config) => {
    const id = config.url === '/handoffs/1' ? 1 : 2
    return ok(config, { ...detail, id, questions: id === 1 ? questions : '  \n ' })
  })
  const view = (id: number) => <HandoffWorkspacePage subjectId={4} handoffId={id} isPrincipal={false} userId={99} mode="detail" />
  const { container, render } = await mount(t, view(1))
  const section = container.querySelector('section[aria-label="Preguntas para el médico"]')!
  const title = section.querySelector('h2')!
  assert.equal(title.closest('.bg-card'), null)
  assert.equal(title.nextElementSibling?.textContent, questions)
  assert.ok(title.nextElementSibling?.matches('.bg-card.whitespace-pre-wrap'))
  assert.deepEqual([...container.querySelectorAll('section[aria-label] > h2')].map(h => h.textContent),
    ['Preguntas para el médico', 'Registros incluidos', 'Enlaces para el médico'])
  await render(view(2))
  assert.equal(container.querySelector('section[aria-label="Preguntas para el médico"]'), null)
})

test('Los enlaces del resumen solo se piden y se muestran a quien lo creó o al principal', async (t) => {
  const urls: string[] = []
  const opened = new Date(Date.now() - 40 * 60_000).toISOString()
  const later = new Date(Date.now() + 24 * 3600_000).toISOString()
  mockApi(t, async (config) => {
    urls.push(config.url ?? '')
    if (config.url === '/handoffs/1') return ok(config, detail)
    if (config.url === '/handoffs/1/sessions') {
      return ok(config, [{
        id: 3, handoffId: 1, expiresAt: later, sessionWindowMinutes: 30, firstOpenedAt: opened, revokedAt: null, createdAt: opened,
      }])
    }
    throw new Error(`Petición inesperada: ${config.url}`)
  })

  // Otro cuidador: no se piden los enlaces (el backend respondería 403) y no puede compartir
  const other = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal={false} userId={99} mode="detail" />)
  assert.ok(!urls.includes('/handoffs/1/sessions'))
  assert.match(other.container.textContent ?? '', /Solo quien creó este resumen o el cuidador principal/)
  assert.equal(other.container.querySelector('a[href="/people/4/handoffs/1/share"]'), null)
  assert.match(other.container.textContent ?? '', /Borrar resumen/)

  // Quien lo creó: ve sus enlaces; abierto hace 40 min con ventana de 30 ya cuenta como vencido
  const creator = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal={false} userId={8} mode="detail" />)
  assert.ok(urls.includes('/handoffs/1/sessions'))
  assert.match(creator.container.textContent ?? '', /Vencido/)
  assert.doesNotMatch(creator.container.textContent ?? '', /Abierto/)
  assert.equal(creator.container.querySelector('[aria-label^="Revocar"]'), null)
  assert.ok(creator.container.querySelector('a[href="/people/4/handoffs/1/share"]'))
  assert.equal(creator.container.querySelector('form'), null, 'crear enlace usa una página separada')

  const principal = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal userId={99} mode="detail" />)
  assert.ok(principal.container.querySelector('a[href="/people/4/handoffs/1/share"]'))
  assert.equal(urls.filter((url) => url === '/handoffs/1/sessions').length, 2)
})

test('una URL directa de crear enlace o código conserva la comprobación de permisos', async (t) => {
  const urls: string[] = []
  mockApi(t, async (config) => {
    urls.push(config.url!)
    assert.equal(config.url, '/handoffs/1', 'un cuidador no autorizado no debe pedir sesiones ni códigos')
    return ok(config, detail)
  })
  for (const mode of ['share', 'code'] as const) {
    const { container } = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal={false} userId={99} mode={mode} sessionId={3} />)
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Solo quien creó este resumen o el cuidador principal/)
    assert.equal(container.querySelector('form'), null)
    assert.equal(container.querySelector('[aria-label^="Código de acceso:"]'), null)
    assert.equal(container.querySelector('a')?.getAttribute('href'), '/people/4/handoffs/1')
  }
  assert.deepEqual(urls, ['/handoffs/1', '/handoffs/1'])
})

test('rechaza un resumen ajeno a la persona o con ID distinto antes de mostrar datos o pedir sesiones', async (t) => {
  let returned = { ...detail, careSubjectId: 5 }
  const urls: string[] = []
  mockApi(t, async (config) => {
    urls.push(config.url!)
    assert.equal(config.url, '/handoffs/1')
    return ok(config, returned)
  })
  for (const wrong of [{ ...detail, careSubjectId: 5 }, { ...detail, id: 2 }]) {
    returned = wrong
    const { container } = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal userId={8} mode="detail" />)
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /no pertenece a la persona seleccionada/)
    assert.doesNotMatch(container.textContent ?? '', /Control anual|Hemograma de octubre|¿Repetir el examen\?/)
    assert.equal(container.querySelector('a[href$="/share"]'), null)
  }
  assert.equal(urls.length, 2)
})

test('cambiar de resumen cancela la carga vieja y no restaura su contenido al responder tarde', async (t) => {
  let release: (() => void) | undefined
  let signal: AbortSignal | undefined
  mockApi(t, async (config) => {
    if (config.url === '/handoffs/1') {
      signal = config.signal as AbortSignal
      await new Promise<void>((resolve) => { release = resolve })
      return ok(config, detail)
    }
    assert.equal(config.url, '/handoffs/2')
    return ok(config, { ...detail, id: 2, reason: 'Resumen nuevo', questions: null, items: [] })
  })
  const { container, render } = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={1} isPrincipal={false} userId={99} mode="detail" />)
  assert.match(container.textContent ?? '', /Cargando resumen/)
  await render(<HandoffWorkspacePage subjectId={4} handoffId={2} isPrincipal={false} userId={99} mode="detail" />)
  assert.equal(signal?.aborted, true)
  await act(async () => { release!() })
  assert.match(container.textContent ?? '', /Resumen nuevo/)
  assert.doesNotMatch(container.textContent ?? '', /Control anual|Hemograma de octubre|¿Repetir el examen\?/)
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
