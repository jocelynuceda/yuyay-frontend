import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true }, close(this: HTMLDialogElement) { this.open = false },
})
import assert from 'node:assert/strict'
import test, { afterEach, type TestContext } from 'node:test'
import { act, type ReactNode } from 'react'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthContextValue } from '../src/contexts/auth-context'
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Routes, Route, useParams } = await import('react-router-dom')
const { AuthContext } = await import('../src/contexts/auth-context')
const { ThemeProvider } = await import('../src/contexts/ThemeContext')
const { ToastProvider } = await import('../src/contexts/ToastContext')
const { default: PeopleRoute } = await import('../src/pages/people/PeopleRoute')
const { api, clearTokens } = await import('../src/services/http')
const originalAdapter = api.defaults.adapter
afterEach(() => { api.defaults.adapter = originalAdapter; clearTokens() })
const own = { id: 21, name: 'Perfil propio ficticio', myRole: 'PRINCIPAL', birthDate: null, notes: null, createdAt: '2026-01-01T00:00:00Z' }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
function auth(id: number): AuthContextValue {
  return { user: { id, name: 'Cuenta ficticia', email: id + '@example.invalid', role: 'USER', createdAt: '2026-01-01T00:00:00Z' },
    isAuthenticated: true, isLoading: false, restoreError: null, retryRestore: async () => {},
    login: async () => true, register: async () => true, loginWithGoogle: async () => true, logout: async () => {}, updateUser: () => {} }
}
function Detail() { return <p>Perfil abierto {useParams().id}</p> }
function screen(id = 1): ReactNode {
  return <ThemeProvider><ToastProvider><AuthContext.Provider value={auth(id)}><MemoryRouter initialEntries={['/people']}>
    <Routes><Route path="/people" element={<PeopleRoute />} /><Route path="/people/:id" element={<Detail />} /></Routes>
  </MemoryRouter></AuthContext.Provider></ToastProvider></ThemeProvider>
}
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  assert.ok(check())
}
async function mount(t: TestContext, node: ReactNode) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(node))
  return { container, root }
}
test('web muestra el perfil recibido del backend, su contador y permite abrirlo y agregar personas', async (t) => {
  api.defaults.adapter = async (config) => { assert.equal(config.url, '/care-subjects'); return ok(config, [own]) }
  const { container } = await mount(t, screen())
  await until(() => !!container.textContent?.includes(own.name))
  assert.match(container.textContent!, /1 persona/)
  assert.doesNotMatch(container.textContent!, /Aún no cuidas/)
  const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Agregar persona')!
  assert.ok(add && !add.disabled)
  const card = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(own.name))!
  await act(async () => card.click())
  assert.match(container.textContent!, /Perfil abierto 21/)
})
test('cambiar de cuenta oculta la red anterior antes de recibir la nueva respuesta', async (t) => {
  let next: ((value: ReturnType<typeof ok>) => void) | undefined
  let nextConfig: InternalAxiosRequestConfig | undefined
  let calls = 0
  api.defaults.adapter = async (config) => {
    calls++
    if (calls === 1) return ok(config, [own])
    nextConfig = config
    return new Promise((resolve) => { next = resolve })
  }
  const { container, root } = await mount(t, screen())
  await until(() => !!container.textContent?.includes(own.name))
  await act(async () => root.render(screen(2)))
  assert.doesNotMatch(container.textContent!, /Perfil propio ficticio/)
  assert.doesNotMatch(container.textContent!, /Aún no cuidas/)
  await until(() => !!next)
  await act(async () => next!(ok(nextConfig!, [{ ...own, id: 22, name: 'Segunda cuenta ficticia' }])))
  await until(() => !!container.textContent?.includes('Segunda cuenta ficticia'))
  assert.doesNotMatch(container.textContent!, /Perfil propio ficticio/)
})
test('web distingue errores y una lista vacía real sin insertar al usuario artificialmente', async (t) => {
  let offline = true
  api.defaults.adapter = async (config) => {
    if (offline) throw new AxiosError('Error técnico', 'ERR_NETWORK', config)
    return ok(config, [])
  }
  const { container } = await mount(t, screen())
  await until(() => !!container.textContent?.includes('conexión'))
  assert.doesNotMatch(container.textContent!, /Aún no cuidas/)
  const retry = [...container.querySelectorAll('button')].find((button) => /Reintentar|Volver a intentar/.test(button.textContent ?? ''))!
  assert.ok(retry)
  offline = false
  await act(async () => retry.click())
  await until(() => !!container.textContent?.includes('Aún no cuidas'))
  assert.match(container.textContent!, /0 personas/)
  assert.equal(container.querySelectorAll('li').length, 0)
})

test('una lista vacía anterior no se presenta como resultado durante una recarga ni un error', async (t) => {
  let calls = 0
  let fail!: () => void
  api.defaults.adapter = async (config) => {
    if (++calls === 1) return ok(config, [])
    return new Promise((_resolve, reject) => {
      fail = () => reject(new AxiosError('Error técnico', 'ERR_BAD_RESPONSE', config, undefined,
        { ...ok(config, {}), status: 500 }))
    })
  }
  const { container } = await mount(t, screen())
  await until(() => !!container.textContent?.includes('Aún no cuidas'))
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  await until(() => !!fail)
  assert.doesNotMatch(container.textContent!, /Aún no cuidas/)
  await act(async () => fail())
  await until(() => !!container.querySelector('[role=alert]'))
  assert.doesNotMatch(container.textContent!, /Aún no cuidas/)
})
