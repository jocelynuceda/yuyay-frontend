// Pruebas del modo oscuro, el aviso sin conexión y la paginación de Registros (jsdom).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

class MemoryStorage {
  data = new Map<string, string>()
  broken = false
  getItem(k: string) { if (this.broken) throw new Error('bloqueado'); return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { if (this.broken) throw new Error('bloqueado'); this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })

// matchMedia simulado: se puede cambiar la preferencia del sistema y avisar a los oyentes.
let systemDark = false
const mediaListeners = new Set<() => void>()
Object.defineProperty(globalThis, 'matchMedia', {
  configurable: true,
  value: (query: string) => ({
    get matches() { return query.includes('dark') && systemDark },
    addEventListener: (_: string, fn: () => void) => mediaListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => mediaListeners.delete(fn),
  }),
})
function setSystemDark(value: boolean) {
  systemDark = value
  mediaListeners.forEach((fn) => fn())
}

let online = true
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => online })

import assert from 'node:assert/strict'
import test from 'node:test'
import { act, type ReactNode } from 'react'

// react-dom decide al cargarse si hay DOM; por eso se importa después de preparar window.
const { createRoot } = await import('react-dom/client')
const { ThemeProvider } = await import('../src/contexts/ThemeContext')
const { useTheme } = await import('../src/hooks/useTheme')
const { ToastProvider } = await import('../src/contexts/ToastContext')
const { OfflineBanner } = await import('../src/components/layout/OfflineBanner')
const { EntriesPanel } = await import('../src/pages/entries/EntriesPanel')
const http = await import('../src/services/http')

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const html = () => document.documentElement

async function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(node))
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

let theme!: ReturnType<typeof useTheme>
function ThemeProbe({ onValue = (value: ReturnType<typeof useTheme>) => (theme = value) }) {
  onValue(useTheme())
  return null
}

function resetTheme(stored: string | null, dark = false) {
  storage.data.clear()
  storage.broken = false
  if (stored) storage.data.set('yuyay.theme', stored)
  systemDark = dark
  html().classList.remove('dark')
}

// ---------- Modo oscuro ----------

test('Tema guardado en oscuro: aplica la clase dark y toggle vuelve a claro y lo guarda', async () => {
  resetTheme('dark')
  const view = await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
  assert.equal(theme.resolved, 'dark')
  assert.ok(html().classList.contains('dark'))
  assert.equal(html().style.colorScheme, 'dark')

  await act(async () => theme.toggle())
  assert.equal(theme.resolved, 'light')
  assert.equal(html().classList.contains('dark'), false)
  assert.equal(storage.data.get('yuyay.theme'), 'light')
  await view.unmount()
})

test('Según el sistema: sigue la preferencia del sistema operativo en vivo', async () => {
  resetTheme(null, true)
  const view = await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
  assert.equal(theme.preference, 'system')
  assert.ok(html().classList.contains('dark'))

  await act(async () => setSystemDark(false))
  assert.equal(theme.resolved, 'light')
  assert.equal(html().classList.contains('dark'), false)

  await act(async () => theme.setPreference('dark'))
  await act(async () => setSystemDark(false))
  assert.ok(html().classList.contains('dark'), 'una preferencia explícita ignora al sistema')
  await view.unmount()
})

test('Sin almacenamiento disponible: no se cae y usa el tema del sistema', async () => {
  resetTheme(null, false)
  storage.broken = true
  const view = await render(<ThemeProvider><ThemeProbe /></ThemeProvider>)
  assert.equal(theme.preference, 'system')
  await act(async () => theme.toggle())
  assert.equal(theme.resolved, 'dark', 'cambia en la sesión aunque no se pueda guardar')
  await view.unmount()
  storage.broken = false
})

// ---------- Sin conexión ----------

test('OfflineBanner: aparece sin red, desaparece al volver y avisa con un toast', async () => {
  online = true
  const view = await render(<ToastProvider><OfflineBanner /></ToastProvider>)
  assert.doesNotMatch(view.container.textContent ?? '', /Sin conexión/)

  await act(async () => {
    online = false
    window.dispatchEvent(new window.Event('offline'))
  })
  assert.match(view.container.textContent ?? '', /Sin conexión/)
  assert.ok(view.container.querySelector('[role="status"]'))
  assert.doesNotMatch(view.container.textContent ?? '', /Conexión restablecida/)

  await act(async () => {
    online = true
    window.dispatchEvent(new window.Event('online'))
  })
  assert.doesNotMatch(view.container.textContent ?? '', /Sin conexión\./)
  assert.match(view.container.textContent ?? '', /Conexión restablecida\./)
  await view.unmount()
})

test('OfflineBanner: no muestra el toast al cargar con red', async () => {
  online = true
  const view = await render(<ToastProvider><OfflineBanner /></ToastProvider>)
  await act(async () => wait(5))
  assert.doesNotMatch(view.container.textContent ?? '', /Conexión restablecida/)
  await view.unmount()
})

// ---------- Paginación de Registros ----------

test('Registros: números de página, rango y tamaño con el filtro de categoría', async () => {
  const requests: Record<string, unknown>[] = []
  const entries = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1, careSubjectId: 1, categoryCode: 'MEDICATION', categoryName: 'Medicación',
    createdBy: { id: 1, name: 'Ana' }, createdAt: '2026-11-08T00:00:00Z', deletedAt: null,
    latestVersion: { id: i + 1, versionNumber: 1, changeType: 'CREATED', title: `Registro ${i + 1}`, details: null,
      dose: null, frequency: null, occurredOn: null, confidenceLevel: 'CONFIRMED', notes: null,
      declaredBy: { id: 1, name: 'Ana' }, declaredAt: '2026-11-08T00:00:00Z' },
  }))
  const adapter = async (config: any) => {
    const params = config.params ?? {}
    requests.push(params)
    const size = Number(params.size), page = Number(params.page)
    return { status: 200, statusText: 'OK', headers: {}, config,
      data: { content: entries.slice(page * size, page * size + size), totalElements: 12,
        totalPages: Math.ceil(12 / size), number: page, size } }
  }
  http.api.defaults.adapter = adapter as any

  const changes: unknown[] = []
  const params = { categoria: 'MEDICATION' as const, page: 1, size: 10 }
  const view = await render(
    <EntriesPanel subjectId={1} params={params} onParamsChange={(p) => changes.push(p)} onOpenEntry={() => {}} />,
  )
  await act(async () => wait(20))
  const text = view.container.textContent ?? ''
  assert.match(text, /Mostrando 1–10 de 12/)
  assert.equal(requests[0].page, 0, 'la página 1 de la URL es la 0 del backend')
  assert.equal(requests[0].category, 'MEDICATION')
  assert.ok(view.container.querySelector('[aria-label="Página 2"]'), 'hay números de página')
  assert.equal(view.container.querySelector('[aria-current="page"]')?.getAttribute('aria-label'), 'Página 1')

  await act(async () => (view.container.querySelector('[aria-label="Página 2"]') as HTMLButtonElement).click())
  assert.deepEqual(changes.at(-1), { categoria: 'MEDICATION', page: 2, size: 10 })

  const select = [...view.container.querySelectorAll('select')].at(-1)!
  await act(async () => {
    select.value = '25'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.deepEqual(changes.at(-1), { categoria: 'MEDICATION', page: 1, size: 25 }, 'cambiar el tamaño vuelve a la página 1')
  await view.unmount()
})
