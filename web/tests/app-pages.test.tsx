// Pruebas del layout privado, el dashboard, avisos, perfil e invitaciones contra un backend simulado (jsdom).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import assert from 'node:assert/strict'
import test from 'node:test'
import { act } from 'react'
import type { Root } from 'react-dom/client'

// react-dom decide al cargarse si hay DOM (y si escucha los eventos de los inputs).
// Las importaciones estáticas se evalúan antes que el código de arriba, por eso se importan aquí.
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, useLocation } = await import('react-router-dom')
const { AuthProvider } = await import('../src/contexts/AuthContext')
const { ToastProvider } = await import('../src/contexts/ToastContext')
const { default: AppRoutes } = await import('../src/routes/AppRoutes')
const http = await import('../src/services/http')
const { getPostLoginTarget } = await import('../src/utils/redirect')

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function backend() {
  let tokens = 0
  const calls: string[] = []
  const db = {
    me: { id: 1, email: 'ana@demo.yuyay', name: 'Ana Torres', role: 'USER', createdAt: '2026-10-01T00:00:00Z' },
    subjects: [
      { id: 1, name: 'Rosa', birthDate: '1954-01-01', notes: null, createdAt: '2026-10-01T00:00:00Z', myRole: 'PRINCIPAL' },
      { id: 2, name: 'Pedro', birthDate: '1951-01-01', notes: null, createdAt: '2026-10-01T00:00:00Z', myRole: 'PRINCIPAL' },
    ],
    consultations: {
      1: [
        { id: 10, careSubjectId: 1, createdByUserId: 1, date: day(-14), reason: 'Control de presión', notes: null },
        { id: 11, careSubjectId: 1, createdByUserId: 1, date: day(5), reason: 'Control con cardiología', notes: null },
      ],
      2: [{ id: 20, careSubjectId: 2, createdByUserId: 1, date: day(2), reason: 'Control con urología', notes: null }],
    } as Record<number, unknown[]>,
    pending: [
      { id: 7, careSubjectId: 3, careSubjectName: 'Lucía', user: { id: 1, name: 'Ana Torres', email: 'ana@demo.yuyay' },
        role: 'CAREGIVER', status: 'PENDING', relationshipLabel: 'Tía', invitedAt: '2026-11-07T00:00:00Z', acceptedAt: null, revokedAt: null },
    ],
    notifications: [1, 2, 3, 4].map((id) => ({
      id, type: 'ENTRY_CHANGED', title: `Aviso ${id}`, body: `Detalle ${id}`, careSubjectId: 1,
      read: id === 4, readAt: id === 4 ? '2026-11-07T00:00:00Z' : null, createdAt: '2026-11-07T00:00:00Z',
    })),
  }
  const ok = (config: any, data: unknown, status = 200) => ({ status, statusText: 'OK', data, headers: {}, config })
  const fail = (config: any, status: number) => Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true, config, response: { status, data: { message: `HTTP ${status}` }, headers: {}, config },
  })
  const auth = () => {
    tokens += 1
    return { accessToken: `A${tokens}`, refreshToken: `R${tokens}`, tokenType: 'Bearer', expiresInSeconds: 3600,
      user: { id: db.me.id, name: db.me.name, email: db.me.email } }
  }
  const adapter = async (config: any) => {
    const url: string = config.url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api\/v1/, '')
    const method = (config.method ?? 'get').toUpperCase()
    const body = config.data ? JSON.parse(config.data) : {}
    const params = config.params ?? {}
    calls.push(`${method} ${url}${params.unread !== undefined ? `?unread=${params.unread}` : ''}`)
    await new Promise((r) => setTimeout(r, 1))
    if (url === '/auth/login' || url === '/auth/refresh') return ok(config, auth())
    if (url === '/auth/logout') return ok(config, '', 204)
    if (url === '/users/me' && method === 'GET') return ok(config, db.me)
    if (url === '/users/me' && method === 'PATCH') {
      db.me = { ...db.me, name: body.name }
      return ok(config, db.me)
    }
    if (url === '/care-subjects') return ok(config, db.subjects)
    const consultations = url.match(/^\/care-subjects\/(\d+)\/consultations$/)
    if (consultations) return ok(config, db.consultations[Number(consultations[1])] ?? [])
    if (url === '/me/relationships/pending') return ok(config, db.pending)
    const accept = url.match(/^\/me\/relationships\/(\d+)\/accept$/)
    if (accept && method === 'POST') {
      const rel = db.pending.find((r) => r.id === Number(accept[1]))
      if (!rel) throw fail(config, 404)
      db.pending = db.pending.filter((r) => r !== rel)
      return ok(config, { ...rel, status: 'ACTIVE' })
    }
    if (url === '/notifications/unread-count') return ok(config, { unreadCount: db.notifications.filter((n) => !n.read).length })
    if (url === '/notifications') {
      const all = params.unread === true ? db.notifications.filter((n) => !n.read) : db.notifications
      const size = Number(params.size ?? 10)
      const page = Number(params.page ?? 0)
      return ok(config, { content: all.slice(page * size, page * size + size), totalElements: all.length,
        totalPages: Math.ceil(all.length / size), number: page, size })
    }
    const read = url.match(/^\/notifications\/(\d+)\/read$/)
    if (read && method === 'PATCH') {
      const n = db.notifications.find((x) => x.id === Number(read[1]))!
      n.read = true
      n.readAt = '2026-11-08T00:00:00Z'
      return ok(config, n)
    }
    throw fail(config, 404)
  }
  return { adapter, calls, db }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor(condition: () => boolean, message: string, timeoutMs = 3000) {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`No se cumplió a tiempo: ${message} (ruta: ${pathname()}${search()})`)
    await act(async () => { await wait(10) })
  }
}
const text = () => document.body.textContent ?? ''
const pathname = () => document.getElementById('pathname')?.textContent ?? ''
const search = () => document.getElementById('search')?.textContent ?? ''
const byText = (selector: string, label: string | RegExp) =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((el) =>
    typeof label === 'string' ? el.textContent?.trim() === label : label.test(el.textContent ?? '')) ?? null
const click = (el: Element | null, what: string) => act(async () => {
  assert.ok(el, `Falta ${what}`)
  ;(el as HTMLElement).click()
})
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

function Where() {
  const location = useLocation()
  return <><output id="pathname">{location.pathname}</output><output id="search">{location.search}</output></>
}

async function mountApp(path: string, { loggedIn }: { loggedIn: boolean }) {
  const storage = new MemoryStorage()
  ;(globalThis as any).sessionStorage = storage
  http.clearTokens()
  const b = backend()
  http.api.defaults.adapter = b.adapter
  http.publicApi.defaults.adapter = b.adapter
  if (loggedIn) {
    storage.setItem('yuyay.refreshToken', 'R0')
    http.setTokens({ refreshToken: 'R0', accessToken: '' })
  }
  const container = document.getElementById('root')!
  const root: Root = createRoot(container)
  await act(async () => {
    root.render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <ToastProvider>
            <Where />
            <AppRoutes />
          </ToastProvider>
        </MemoryRouter>
      </AuthProvider>,
    )
  })
  return { b, unmount: () => act(async () => root.unmount()) }
}

test('getPostLoginTarget: vuelve a la ruta guardada y rechaza destinos inválidos', () => {
  assert.equal(getPostLoginTarget(null), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '/invitaciones/7', search: '?x=1' } }), '/invitaciones/7?x=1')
  assert.equal(getPostLoginTarget({ from: { pathname: '/login' } }), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '/registro' } }), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '//evil.example' } }), '/', 'no sale del sitio')
  assert.equal(getPostLoginTarget({ from: { pathname: 'https://evil.example' } }), '/')
  assert.equal(getPostLoginTarget({ from: 'texto' }), '/')
})

test('Enlace del correo sin sesión: login y vuelve a la invitación; aceptar lleva a la persona', async (t) => {
  const { b, unmount } = await mountApp('/invitaciones/7', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => pathname() === '/login' && !!document.querySelector('input[type="password"]'), 'redirección a /login')

  await type(document.querySelector<HTMLInputElement>('input[type="email"], input[name="email"]')!, 'ana@demo.yuyay')
  await type(document.querySelector<HTMLInputElement>('input[type="password"]')!, 'Demo12345')
  await click(document.querySelector('form button[type="submit"]'), 'el botón de ingresar')

  await waitFor(() => pathname() === '/invitaciones/7', 'volver a /invitaciones/7 después del login')
  await waitFor(() => /Lucía/.test(text()), 'mostrar la invitación')
  await click(byText('button', /Aceptar invitación/), 'el botón Aceptar invitación')
  await waitFor(() => pathname() === '/personas/3', 'ir a la persona aceptada')
  assert.ok(b.calls.includes('POST /me/relationships/7/accept'))
})

test('Invitación que ya no está pendiente: estado vacío, sin botón de aceptar', async (t) => {
  const { unmount } = await mountApp('/invitaciones/99', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /ya no está pendiente/.test(text()), 'estado vacío de invitación')
  assert.equal(byText('button', /Aceptar invitación/), null)
})

test('Dashboard: saludo, próxima cita más cercana entre todas las personas e invitaciones', async (t) => {
  const { unmount } = await mountApp('/', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Hola, Ana/.test(text()), 'saludo')
  await waitFor(() => /Control con urología/.test(text()), 'próxima cita')
  assert.match(text(), /Pedro/)
  assert.doesNotMatch(text(), /Control de presión/, 'la consulta pasada no es la próxima')
  assert.doesNotMatch(text(), /Control con cardiología/, 'la de Rosa es más lejana')
  assert.ok(document.querySelector('a[href="/invitaciones/7"]'), 'enlace a la invitación pendiente')
})

test('Layout: navegación con la ruta activa y contador de avisos sin leer', async (t) => {
  const { unmount } = await mountApp('/personas', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('a[aria-current="page"][href="/personas"]'), 'enlace activo de Personas')
  await waitFor(() => !!document.querySelector('a[href="/avisos"][aria-label*="3"]'), 'campana con 3 sin leer')
})

test('Avisos: filtro en la URL, marcar como leído actualiza la lista y el contador', async (t) => {
  const { b, unmount } = await mountApp('/avisos', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Aviso 4/.test(text()), 'lista de todos los avisos')

  await click(byText('button', 'Sin leer'), 'el filtro Sin leer')
  await waitFor(() => new URLSearchParams(search()).get('filtro') === 'sin-leer', 'filtro en la URL')
  await waitFor(() => !/Aviso 4/.test(text()), 'el aviso leído desaparece en Sin leer')
  assert.ok(b.calls.includes('GET /notifications?unread=true'))

  await click(byText('button', /Marcar como leído/), 'el botón Marcar como leído')
  await waitFor(() => b.calls.some((c) => /^PATCH \/notifications\/\d+\/read$/.test(c)), 'PATCH de leído')
  await waitFor(() => !!document.querySelector('a[href="/avisos"][aria-label*="2"]'), 'contador baja a 2')
  await waitFor(() => /marcado como leído/.test(text()), 'toast de confirmación')
})

test('Perfil: editar el nombre lo guarda y actualiza el header', async (t) => {
  const { b, unmount } = await mountApp('/perfil', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /ana@demo\.yuyay/.test(text()), 'datos del perfil')
  const input = [...document.querySelectorAll<HTMLInputElement>('form input')].find((i) => i.value === 'Ana Torres')
  assert.ok(input, 'campo de nombre con el valor actual')
  await type(input, '  Ana María Torres  ')
  await click(document.querySelector('form button[type="submit"]'), 'el botón Guardar')
  await waitFor(() => b.db.me.name === 'Ana María Torres', 'PATCH /users/me con el nombre sin espacios')
  await waitFor(() => !!document.querySelector('[aria-label="Perfil de Ana María Torres"]'), 'header con el nombre nuevo')
})
