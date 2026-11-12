// Pruebas de la biblioteca de componentes, los hooks y los avisos (jsdom).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement })
// jsdom no implementa los diálogos modales
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import assert from 'node:assert/strict'
import test from 'node:test'
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LoadError } from '../src/components/layout/LoadError'
import { ConfirmDialog } from '../src/components/ui/ConfirmDialog'
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary'
import { Input } from '../src/components/ui/Input'
import { Pagination, getPageItems, getRange } from '../src/components/ui/Pagination'
import { SearchInput } from '../src/components/ui/SearchInput'
import { ToastProvider } from '../src/contexts/ToastContext'
import { useDebounce } from '../src/hooks/useDebounce'
import { useFetch } from '../src/hooks/useFetch'
import { usePagination } from '../src/hooks/usePagination'
import { useToast } from '../src/hooks/useToast'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function render(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  await act(async () => root.render(node))
  return {
    container,
    rerender: (next: ReactNode) => act(async () => root.render(next)),
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

const click = (el: Element | null) =>
  act(async () => {
    assert.ok(el, 'elemento no encontrado')
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })

const buttonByText = (root: ParentNode, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) ?? null

// ---------- Paginación: funciones puras ----------

test('getPageItems: primera, última, actual ±1 y elipsis', () => {
  assert.deepEqual(getPageItems(1, 1), [1])
  assert.deepEqual(getPageItems(1, 0), [])
  assert.deepEqual(getPageItems(2, 3), [1, 2, 3])
  assert.deepEqual(getPageItems(5, 12), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 12])
  assert.deepEqual(getPageItems(1, 12), [1, 2, 'ellipsis', 12])
  assert.deepEqual(getPageItems(12, 12), [1, 'ellipsis', 11, 12])
  // un hueco de una sola página se muestra como número, no como elipsis
  assert.deepEqual(getPageItems(4, 12), [1, 2, 3, 4, 5, 'ellipsis', 12])
  // página fuera de rango se acota
  assert.deepEqual(getPageItems(99, 3), [1, 2, 3])
})

test('getRange: "Mostrando X–Y de Z" con la última página incompleta y lista vacía', () => {
  assert.deepEqual(getRange(1, 10, 57), { from: 1, to: 10 })
  assert.deepEqual(getRange(2, 10, 57), { from: 11, to: 20 })
  assert.deepEqual(getRange(6, 10, 57), { from: 51, to: 57 })
  assert.deepEqual(getRange(1, 25, 0), { from: 0, to: 0 })
})

// ---------- Paginación: componente ----------

test('Pagination: rango, página actual, anterior/siguiente y tamaño', async () => {
  const calls: string[] = []
  const view = await render(
    <Pagination
      page={2}
      totalPages={6}
      totalElements={57}
      size={10}
      onPageChange={(p) => calls.push(`page:${p}`)}
      onSizeChange={(s) => calls.push(`size:${s}`)}
    />,
  )
  const { container } = view
  assert.match(container.textContent ?? '', /Mostrando 11–20 de 57/)
  assert.equal(container.querySelector('[aria-current="page"]')?.getAttribute('aria-label'), 'Página 2')

  await click(buttonByText(container, 'Siguiente'))
  await click(buttonByText(container, 'Anterior'))
  await click(container.querySelector('[aria-label="Página 6"]'))

  const select = container.querySelector('select')!
  assert.deepEqual([...select.options].map((o) => o.value), ['10', '25', '50', '100'])
  await act(async () => {
    select.value = '25'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  assert.deepEqual(calls, ['page:3', 'page:1', 'page:6', 'size:25'])

  await view.rerender(
    <Pagination page={1} totalPages={6} totalElements={57} size={10} onPageChange={() => {}} />,
  )
  assert.equal(buttonByText(container, 'Anterior')?.disabled, true)
  assert.equal(container.querySelector('select'), null, 'sin onSizeChange no hay selector')
  await view.unmount()
})

// ---------- usePagination ----------

function PaginationProbe({ onReady }: { onReady: (api: ReturnType<typeof usePagination>, search: string) => void }) {
  const api = usePagination()
  const { search } = useLocation()
  onReady(api, search)
  return null
}

test('usePagination: lee y escribe page/size en la URL sin perder otros filtros', async () => {
  let api!: ReturnType<typeof usePagination>
  let search = ''
  const view = await render(
    <MemoryRouter initialEntries={['/people/1?category=ALLERGY&page=3&size=25']}>
      <PaginationProbe onReady={(a, s) => ((api = a), (search = s))} />
    </MemoryRouter>,
  )
  assert.equal(api.page, 3)
  assert.equal(api.size, 25)
  assert.equal(api.apiPage, 2)

  await act(async () => api.setPage(4))
  assert.equal(new URLSearchParams(search).get('page'), '4')
  assert.equal(new URLSearchParams(search).get('category'), 'ALLERGY')

  await act(async () => api.setSize(50))
  let params = new URLSearchParams(search)
  assert.equal(params.get('size'), '50')
  assert.equal(params.get('page'), null, 'cambiar el tamaño vuelve a la página 1')
  assert.equal(params.get('category'), 'ALLERGY')

  await act(async () => api.setSize(10))
  params = new URLSearchParams(search)
  assert.equal(params.get('size'), null, 'el tamaño por defecto no ensucia la URL')
  await view.unmount()
})

test('usePagination: valores inválidos en la URL caen a los por defecto', async () => {
  let api!: ReturnType<typeof usePagination>
  const view = await render(
    <MemoryRouter initialEntries={['/notifications?page=-2&size=7']}>
      <PaginationProbe onReady={(a) => (api = a)} />
    </MemoryRouter>,
  )
  assert.equal(api.page, 1)
  assert.equal(api.size, 10)
  await view.unmount()
})

// ---------- useFetch ----------

function FetchProbe({
  id,
  fetcher,
  onState,
}: {
  id: number
  fetcher: (id: number, signal: AbortSignal) => Promise<string>
  onState: (s: ReturnType<typeof useFetch<string>>) => void
}) {
  const state = useFetch((signal) => fetcher(id, signal), [id])
  onState(state)
  return null
}

test('useFetch: cancela al cambiar parámetros y al desmontar, y no pisa datos con respuestas viejas', async () => {
  const signals = new Map<number, AbortSignal>()
  const resolvers = new Map<number, (v: string) => void>()
  const fetcher = (id: number, signal: AbortSignal) => {
    signals.set(id, signal)
    return new Promise<string>((resolve) => resolvers.set(id, resolve))
  }
  let state!: ReturnType<typeof useFetch<string>>
  const view = await render(<FetchProbe id={1} fetcher={fetcher} onState={(s) => (state = s)} />)
  assert.equal(state.loading, true)

  await view.rerender(<FetchProbe id={2} fetcher={fetcher} onState={(s) => (state = s)} />)
  assert.equal(signals.get(1)?.aborted, true, 'la petición 1 se cancela al pasar a 2')
  assert.equal(signals.get(2)?.aborted, false)

  await act(async () => resolvers.get(1)!('vieja'))
  assert.equal(state.data, null, 'la respuesta cancelada no se usa')
  await act(async () => resolvers.get(2)!('nueva'))
  assert.equal(state.data, 'nueva')
  assert.equal(state.loading, false)

  await act(async () => state.reload())
  assert.equal(state.loading, true)
  assert.equal(state.data, 'nueva', 'conserva los datos mientras recarga')
  await view.unmount()
  assert.equal(signals.get(2)?.aborted, true, 'desmontar cancela la recarga en curso')
})

test('useFetch: los errores de cancelación se ignoran y los demás se muestran', async () => {
  let state!: ReturnType<typeof useFetch<string>>
  const canceled = Object.assign(new Error('canceled'), { name: 'CanceledError' })
  const view = await render(<FetchProbe id={1} fetcher={() => Promise.reject(canceled)} onState={(s) => (state = s)} />)
  await act(async () => sleep(0))
  assert.equal(state.error, null)

  await view.rerender(<FetchProbe id={2} fetcher={() => Promise.reject(new Error('boom'))} onState={(s) => (state = s)} />)
  await act(async () => sleep(0))
  assert.equal(typeof state.error, 'string')
  assert.ok(state.error!.length > 0)
  assert.equal(state.loading, false)
  await view.unmount()
})

// ---------- useDebounce ----------

function DebounceProbe({ value, onValue }: { value: string; onValue: (v: string) => void }) {
  onValue(useDebounce(value, 40))
  return null
}

test('useDebounce: solo entrega el último valor después de la pausa', async () => {
  let seen = ''
  const view = await render(<DebounceProbe value="a" onValue={(v) => (seen = v)} />)
  await view.rerender(<DebounceProbe value="ab" onValue={(v) => (seen = v)} />)
  await view.rerender(<DebounceProbe value="abc" onValue={(v) => (seen = v)} />)
  assert.equal(seen, 'a')
  await act(async () => sleep(80))
  assert.equal(seen, 'abc')
  await view.unmount()
})

// ---------- Toasts ----------

function ToastButtons() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Registro guardado.')}>ok</button>
      <button onClick={() => toast.error('No se pudo guardar.')}>error</button>
    </>
  )
}

test('ToastProvider: muestra avisos en una región aria-live, máximo 3, y se cierran', async () => {
  const view = await render(
    <ToastProvider>
      <ToastButtons />
    </ToastProvider>,
  )
  const { container } = view
  const region = container.querySelector('[aria-live="polite"]')!
  await click(buttonByText(container, 'ok'))
  assert.match(region.textContent ?? '', /Registro guardado\./)

  for (let i = 0; i < 4; i++) await click(buttonByText(container, 'error'))
  assert.equal(region.querySelectorAll('[aria-label="Cerrar aviso"]').length, 3)
  assert.doesNotMatch(region.textContent ?? '', /Registro guardado\./, 'el más antiguo sale primero')

  await click(region.querySelector('[aria-label="Cerrar aviso"]'))
  assert.equal(region.querySelectorAll('[aria-label="Cerrar aviso"]').length, 2)
  await view.unmount()
})

test('useToast fuera del provider falla con un mensaje claro', async () => {
  const original = console.error
  console.error = () => {}
  try {
    let caught: unknown = null
    function Broken() {
      useToast()
      return null
    }
    const view = await render(
      <ErrorBoundary fallback={(error) => ((caught = error), null)}>
        <Broken />
      </ErrorBoundary>,
    )
    assert.ok(caught instanceof Error)
    await view.unmount()
  } finally {
    console.error = original
  }
})

// ---------- ErrorBoundary ----------

test('ErrorBoundary: muestra el respaldo y Reintentar vuelve a renderizar', async () => {
  const original = console.error
  console.error = () => {}
  let shouldThrow = true
  function Flaky() {
    if (shouldThrow) throw new Error('falló')
    return <p>contenido</p>
  }
  try {
    const view = await render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    assert.match(view.container.textContent ?? '', /Algo salió mal/)
    shouldThrow = false
    await click(buttonByText(view.container, 'Reintentar'))
    assert.match(view.container.textContent ?? '', /contenido/)
    await view.unmount()
  } finally {
    console.error = original
  }
})

// ---------- Campos y diálogos ----------

test('Input: label asociado y error anunciado con aria-describedby', async () => {
  const view = await render(<Input label="Correo" error="Ingresa un correo válido" />)
  const input = view.container.querySelector('input')!
  const label = view.container.querySelector('label')!
  assert.equal(label.htmlFor, input.id)
  assert.equal(input.getAttribute('aria-invalid'), 'true')
  const described = document.getElementById(input.getAttribute('aria-describedby')!.split(' ')[0])
  assert.equal(described?.textContent, 'Ingresa un correo válido')
  await view.unmount()
})

test('ConfirmDialog: bloquea los botones mientras confirma, muestra el error y cancela', async () => {
  const calls: string[] = []
  let finish!: (ok: boolean) => void
  const view = await render(
    <ConfirmDialog
      open
      title="Eliminar registro"
      message="Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      onConfirm={() =>
        new Promise<void>((resolve, reject) => {
          calls.push('confirm')
          finish = (ok) => (ok ? resolve() : reject(new Error('fallo')))
        })
      }
      onCancel={() => calls.push('cancel')}
    />,
  )
  const dialog = view.container.querySelector('dialog')!
  assert.ok(dialog.open)
  assert.match(dialog.textContent ?? '', /Eliminar registro/)

  await click(buttonByText(dialog, 'Eliminar'))
  assert.equal(buttonByText(dialog, 'Cancelar')?.disabled, true)
  assert.equal(buttonByText(dialog, 'Borrando…')?.disabled, true)
  await act(async () => finish(false))
  assert.ok(dialog.querySelector('[role="alert"]'), 'muestra el error de la acción')

  await click(buttonByText(dialog, 'Cancelar'))
  assert.deepEqual(calls, ['confirm', 'cancel'])
  await view.unmount()
})

// ---------- LoadError ----------

test('LoadError: reintentar ante fallos de red o del servidor, volver al inicio ante 403 y 404', async () => {
  let retries = 0
  const view = await render(
    <MemoryRouter>
      <LoadError message="El servidor tuvo un problema." status={500} onRetry={() => retries++} />
    </MemoryRouter>,
  )
  await click(buttonByText(view.container, 'Reintentar'))
  assert.equal(retries, 1)

  for (const status of [403, 404]) {
    await view.rerender(
      <MemoryRouter>
        <LoadError message="Persona no encontrada." status={status} onRetry={() => retries++} />
      </MemoryRouter>,
    )
    assert.equal(buttonByText(view.container, 'Reintentar'), null, `sin reintentar en ${status}`)
    assert.equal(view.container.querySelector('a')?.getAttribute('href'), '/')
  }
  await view.unmount()
})

// ---------- SearchInput ----------

test('SearchInput: al limpiar emite "" una sola vez y no vuelve a emitir el texto anterior', async () => {
  const calls: string[] = []
  function Harness() {
    const [value, setValue] = useState('zz')
    // onSearch nuevo en cada render, como en las páginas
    return <SearchInput label="Buscar" value={value} delay={20} onSearch={(q) => { calls.push(q); setValue(q) }} />
  }
  const view = await render(<Harness />)
  const input = view.container.querySelector('input')!
  assert.equal(input.value, 'zz')

  await click(view.container.querySelector('[aria-label="Limpiar búsqueda"]'))
  await act(() => sleep(40))
  assert.deepEqual(calls, [''])
  assert.equal(input.value, '')
  await view.unmount()
})
