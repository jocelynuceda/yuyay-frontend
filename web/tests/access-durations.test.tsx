import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { InternalAxiosRequestConfig } from 'axios'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import { formatDateTime } from '../src/utils/format'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')
const { DelegationForm } = await import('../src/pages/forms/DelegationForm')
const { CreateHandoffLink } = await import('../src/pages/handoff/HandoffLinkStep')
const { api } = await import('../src/services/http')

async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => {
    await act(async () => root.unmount())
    container.remove()
  })
  await act(async () => root.render(node))
  return container
}

function watchRequests(t: TestContext, respond: (request: InternalAxiosRequestConfig) => unknown) {
  const previous = api.defaults.adapter
  const requests: InternalAxiosRequestConfig[] = []
  api.defaults.adapter = async (config) => {
    requests.push(config)
    return { config, data: respond(config), status: 200, statusText: 'OK', headers: {} }
  }
  t.after(() => { api.defaults.adapter = previous })
  return requests
}

async function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setValue.call(input, value)
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}

async function select(input: HTMLSelectElement, value: string) {
  await act(async () => {
    input.value = value
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  })
}

async function submit(form: HTMLElement) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
  assert.ok(button)
  await act(async () => button.click())
}

test('La vigencia y la lectura conservan sus cantidades al cambiar unidad y envían minutos', async (t) => {
  const requests = watchRequests(t, (request) => request.method === 'post'
    ? { id: 4, token: 'test', expiresAt: '2026-11-26T19:00:00Z', accessCodeRequired: true }
    : { code: '123456', expiresAt: '2030-01-01T00:00:30Z', serverTime: '2030-01-01T00:00:00Z', periodSeconds: 30 })
  const form = await mount(t, <CreateHandoffLink handoffId={12} />)
  const expiry = form.querySelector<HTMLInputElement>('input[name="expiry.amount"]')!
  const expiryUnit = form.querySelector<HTMLSelectElement>('select[name="expiry.unit"]')!
  const reading = form.querySelector<HTMLInputElement>('input[name="reading.amount"]')!
  const readingUnit = form.querySelector<HTMLSelectElement>('select[name="reading.unit"]')!
  assert.deepEqual([expiry.value, expiryUnit.value, reading.value, readingUnit.value], ['24', 'hours', '30', 'minutes'])
  assert.deepEqual([...readingUnit.options].map((option) => option.text), ['Minutos', 'Horas', 'Días'])

  await type(expiry, '90')
  await select(expiryUnit, 'minutes')
  await select(readingUnit, 'hours')
  assert.equal(expiry.value, '90')
  assert.equal(reading.value, '30')
  await submit(form)
  assert.equal(requests.length, 0)
  assert.equal(reading.getAttribute('aria-invalid'), 'true')
  assert.match(form.textContent ?? '', /no puede superar la vigencia del enlace/)

  await type(reading, '1')
  await submit(form)
  assert.equal(requests.filter((request) => request.method === 'post').length, 1)
  assert.equal(requests[0].url, '/handoffs/12/sessions')
  assert.deepEqual(JSON.parse(requests[0].data), { expiresInMinutes: 90, sessionWindowMinutes: 60, requireAccessCode: true })
  assert.match(form.textContent ?? '', /Enlace listo/)
})

test('La delegación usa el reloj del envío y conserva los demás datos del formulario', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-26T15:00:00Z') })
  const requests = watchRequests(t, () => ({ token: 'test' }))
  const form = await mount(t, <DelegationForm subjectId={3} onSaved={() => {}} />)
  const duration = form.querySelector<HTMLInputElement>('input[name="duration.amount"]')!
  const durationUnit = form.querySelector<HTMLSelectElement>('select[name="duration.unit"]')!
  assert.equal(duration.value, '')
  assert.equal(durationUnit.value, 'days')
  await type(form.querySelector<HTMLInputElement>('#delegation-name')!, 'Ana Vega')
  await type(form.querySelector<HTMLInputElement>('#delegation-email')!, 'ana@example.test')
  const allergy = form.querySelector<HTMLInputElement>('input[name="categoryCodes"][value="ALLERGY"]')!
  await act(async () => allergy.click())
  assert.equal(allergy.checked, true, 'se seleccionó la categoría')
  await act(async () => form.querySelector<HTMLInputElement>('input[name="includeConsultations"]')!.click())
  await submit(form)
  assert.equal(requests.length, 0)
  assert.match(form.textContent ?? '', /Introduce una cantidad/)

  await select(durationUnit, 'minutes')
  await type(duration, '30')
  assert.equal(allergy.checked, true, 'se conserva la selección tras cambiar duración')
  assert.ok(form.textContent?.includes(`Vence aproximadamente el ${formatDateTime('2026-11-26T15:30:00Z')}.`))
  t.mock.timers.setTime(new Date('2026-11-26T15:21:45Z').getTime())
  await submit(form)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, '/care-subjects/3/delegations')
  assert.deepEqual(JSON.parse(requests[0].data), {
    granteeName: 'Ana Vega', granteeEmail: 'ana@example.test', categoryCodes: ['ALLERGY'], includeConsultations: true,
    validUntil: '2026-11-26T15:51:45.000Z',
  })
})
