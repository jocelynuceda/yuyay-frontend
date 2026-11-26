import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { api } = await import('../src/services/http')
const { DelegationForm } = await import('../src/pages/forms/DelegationForm')
const { CATEGORY_CODES } = await import('../src/types')

async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>))
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  return container
}
function mockApi(t: TestContext, respond: (request: InternalAxiosRequestConfig) => unknown | Promise<unknown>) {
  const previous = api.defaults.adapter
  const requests: InternalAxiosRequestConfig[] = []
  api.defaults.adapter = async config => {
    requests.push(config)
    return { config, data: await respond(config), status: 200, statusText: 'OK', headers: {} }
  }
  t.after(() => { api.defaults.adapter = previous })
  return requests
}
async function fill(container: HTMLElement, selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
const form = () => <DelegationForm subjectId={3} subjectName="Lucía" onSaved={() => {}} />
const submitButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('button[type="submit"]')!

test('consulta existencia por categoría size=1; solo ofrece categorías con registros y citas existentes', async t => {
  const requests = mockApi(t, request => request.url?.endsWith('/consultations') ? [{}]
    : { content: request.params.category === 'EXAM_RESULT' ? [{}] : [], totalPages: 700 })
  const container = await mount(t, form())
  const entries = requests.filter(r => r.url?.endsWith('/health-entries'))
  assert.equal(entries.length, CATEGORY_CODES.length)
  assert.deepEqual(entries.map(r => r.params.category), [...CATEGORY_CODES])
  assert.ok(entries.every(r => r.params.size === 1 && r.signal))
  assert.deepEqual([...container.querySelectorAll<HTMLInputElement>('input[name="categoryCodes"]')].map(input => input.value), ['EXAM_RESULT'])
  assert.ok(container.querySelector('input[name="includeConsultations"]'))
  assert.match(container.textContent!, /Lucía · Acceso delegado/)
  assert.equal(submitButton(container).disabled, false)
})

test('perfil vacío oculta todas las opciones y bloquea enviar incluso con submit programático', async t => {
  const requests = mockApi(t, request => request.url?.endsWith('/consultations') ? [] : { content: [] })
  const container = await mount(t, form())
  assert.equal(container.querySelector('input[type="checkbox"]'), null)
  assert.match(container.textContent!, /Aún no hay registros ni citas para compartir/)
  assert.equal(submitButton(container).disabled, true)
  await act(async () => { container.querySelector('form')!.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })) })
  assert.equal(requests.filter(r => r.method === 'post').length, 0)
})

test('carga pendiente no se presenta como perfil vacío ni permite crear', async t => {
  let release: (() => void) | undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  mockApi(t, async request => { await gate; return request.url?.endsWith('/consultations') ? [] : { content: [] } })
  const container = await mount(t, form())
  assert.match(container.querySelector('[role="status"]')!.textContent!, /Cargando opciones/)
  assert.doesNotMatch(container.textContent!, /Aún no hay registros/)
  assert.equal(submitButton(container).disabled, true)
  await act(async () => { release!() })
  assert.match(container.textContent!, /Aún no hay registros/)
})

test('fallo parcial no produce selección incompleta; reintentar recupera las opciones', async t => {
  let fail = true
  mockApi(t, request => {
    if (request.params?.category === 'MEDICATION' && fail) {
      throw new AxiosError('Sin acceso', 'ERR_BAD_REQUEST', request, undefined,
        { config: request, data: { message: 'No pudimos consultar medicamentos.' }, status: 403, statusText: 'Forbidden', headers: {} })
    }
    return request.url?.endsWith('/consultations') ? [] : { content: request.params.category === 'ALLERGY' ? [{}] : [] }
  })
  const container = await mount(t, form())
  assert.match(container.querySelector('[role="alert"]')!.textContent!, /medicamentos/)
  assert.equal(container.querySelector('input[type="checkbox"]'), null)
  assert.doesNotMatch(container.textContent!, /Aún no hay registros/)
  assert.equal(submitButton(container).disabled, true)
  fail = false
  const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Reintentar')!
  await act(async () => retry.click())
  assert.equal(container.querySelector('[role="alert"]'), null)
  assert.ok(container.querySelector('input[value="ALLERGY"]'))
  assert.equal(container.querySelector('input[name="includeConsultations"]'), null)
})

test('una sola categoría se puede marcar/desmarcar y el error está asociado al grupo', async t => {
  const requests = mockApi(t, request => request.url?.endsWith('/consultations') ? []
    : request.method === 'post' ? { token: 'creado' } : { content: request.params.category === 'ALLERGY' ? [{}] : [] })
  const container = await mount(t, form())
  await fill(container, '#delegation-name', 'Ana Vega')
  await fill(container, '#delegation-email', 'ana@example.test')
  await fill(container, 'input[name="duration.amount"]', '1')
  const option = container.querySelector<HTMLInputElement>('input[value="ALLERGY"]')!
  await act(async () => option.click())
  assert.equal(option.checked, true)
  await act(async () => option.click())
  assert.equal(option.checked, false)
  await act(async () => submitButton(container).click())
  assert.match(container.querySelector('#delegation-categories-error')!.textContent!, /Elige al menos/)
  assert.equal(container.querySelector('fieldset')!.getAttribute('aria-describedby'), 'delegation-categories-error')
  assert.equal(requests.filter(r => r.method === 'post').length, 0)
  await act(async () => option.click())
  await act(async () => submitButton(container).click())
  const sent = requests.filter(r => r.method === 'post')
  assert.equal(sent.length, 1)
  assert.deepEqual(JSON.parse(sent[0].data).categoryCodes, ['ALLERGY'])
})

test('solo citas es un permiso válido sin inventar categorías de salud', async t => {
  const requests = mockApi(t, request => request.url?.endsWith('/consultations') ? [{}]
    : request.method === 'post' ? { token: 'creado' } : { content: [] })
  const container = await mount(t, form())
  assert.equal(container.querySelector('input[name="categoryCodes"]'), null)
  await fill(container, '#delegation-name', 'Ana Vega')
  await fill(container, '#delegation-email', 'ana@example.test')
  await fill(container, 'input[name="duration.amount"]', '1')
  await act(async () => container.querySelector<HTMLInputElement>('input[name="includeConsultations"]')!.click())
  await act(async () => submitButton(container).click())
  const sent = requests.filter(r => r.method === 'post')
  assert.equal(sent.length, 1)
  assert.deepEqual(JSON.parse(sent[0].data).categoryCodes, [])
  assert.equal(JSON.parse(sent[0].data).includeConsultations, true)
})
