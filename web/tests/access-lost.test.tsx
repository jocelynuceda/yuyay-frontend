// Una ficha ya abierta deja de mostrarse si el servidor retira el acceso, pero no por un fallo de red.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { act } from 'react'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const { createRoot } = await import('react-dom/client')
const { MemoryRouter } = await import('react-router-dom')
const { PersonRouteFrame } = await import('../src/pages/people/PersonRouteFrame')
const { api } = await import('../src/services/http')

const ok = (config: InternalAxiosRequestConfig) => ({ config, data: { id: 3, name: 'Lucía' }, headers: {}, status: 200, statusText: 'OK' })

async function openThenReload(t: TestContext, failure: (config: InternalAxiosRequestConfig) => AxiosError) {
  const old = api.defaults.adapter
  let calls = 0
  api.defaults.adapter = async (config) => {
    if (++calls === 1) return ok(config)
    throw failure(config)
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove(); api.defaults.adapter = old })
  await act(async () => root.render(
    <MemoryRouter>
      <PersonRouteFrame subjectId={3}>
        {(subject, reload) => <button type="button" onClick={reload}>Editar a {subject.name}</button>}
      </PersonRouteFrame>
    </MemoryRouter>,
  ))
  assert.match(container.textContent!, /Editar a Lucía/)
  await act(async () => container.querySelector('button')!.click())
  return container
}

for (const status of [403, 404]) {
  test(`un ${status} al recargar retira la ficha y sus controles`, async (t) => {
    const container = await openThenReload(t, (config) => new AxiosError('Denegado', 'ERR_BAD_REQUEST', config, undefined,
      { config, data: {}, headers: {}, status, statusText: 'x' }))
    assert.doesNotMatch(container.textContent!, /Lucía/)
    assert.ok(container.querySelector('[role="alert"]'))
  })
}

test('sin conexión se conserva la ficha ya cargada', async (t) => {
  const container = await openThenReload(t, (config) => new AxiosError('Red', 'ENETUNREACH', config))
  assert.match(container.textContent!, /Editar a Lucía/)
})

test('volver al foco vuelve a verificar la ficha abierta y descarta sus datos si perdió acceso', async (t) => {
  const previous = api.defaults.adapter
  let reads = 0
  api.defaults.adapter = async (config) => {
    if (++reads === 1) return ok(config)
    throw new AxiosError('Denegado', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config), data: {}, status: 403 })
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove(); api.defaults.adapter = previous })
  await act(async () => root.render(
    <MemoryRouter>
      <PersonRouteFrame subjectId={3}>
        {(subject) => <p>Ficha abierta de {subject.name}</p>}
      </PersonRouteFrame>
    </MemoryRouter>,
  ))
  assert.match(container.textContent!, /Ficha abierta de Lucía/)
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  assert.equal(reads, 2)
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /No tienes acceso/)
  assert.doesNotMatch(container.textContent!, /Lucía|Ficha abierta/)
})
