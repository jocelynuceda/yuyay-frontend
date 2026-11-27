// Una ficha ya abierta deja de mostrarse si el servidor retira el acceso, pero no por un fallo de red.
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
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
  // Los GET con fallo de red se reintentan con espera
  await act(async () => new Promise((resolve) => setTimeout(resolve, 1000)))
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
  const container = await openThenReload(t, (config) => new AxiosError('Red', 'ERR_NETWORK', config))
  assert.match(container.textContent!, /Editar a Lucía/)
})
