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
const { getNotificationLink } = await import('../src/pages/notifications/notificationLink')
const { validateDocumentFile, documentsOnly } = await import('../src/utils/attachments')
const { RECETA_UNICA_MINSA } = await import('./fixtures/ocr-recetas')

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

const attachmentBase = {
  careSubjectId: 1, consultationId: null, uploadedById: 1, uploadedByName: 'Ana Torres', contentType: 'application/pdf',
  sizeBytes: 100, ocrText: null as string | null, ocrError: null as string | null, uploadedAt: '2026-11-07T00:00:00Z', ocrCompletedAt: null,
}

function backend() {
  let tokens = 0
  const calls: string[] = []
  const db = {
    attachments: [
      { ...attachmentBase, id: 31, originalFilename: 'nota.m4a', contentType: 'audio/mp4', ocrStatus: 'DONE' },
      { ...attachmentBase, id: 32, originalFilename: 'examen.png', contentType: 'image/png', ocrStatus: 'FAILED', ocrError: 'No se pudo extraer el texto.' },
    ],
    uploads: [] as { form: unknown; timeout: unknown }[],
    createdEntries: [] as Record<string, unknown>[],
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
    notifications: [
      ...[1, 2, 3, 4].map((id) => ({
        id, type: 'ENTRY_CHANGED', title: `Aviso ${id}`, body: `Detalle ${id}`, careSubjectId: 1 as number | null,
        read: id === 4, readAt: id === 4 ? '2026-11-07T00:00:00Z' : null, createdAt: '2026-11-07T00:00:00Z',
      })),
      // Invitación pendiente a Lucía (3), nuevo cuidador para Pedro (2) e invitaciones que dejaron de estar pendientes.
      { id: 5, type: 'INVITATION', title: 'Te invitaron a cuidar a Lucía', body: 'Invitación', careSubjectId: 3,
        read: true, readAt: '2026-11-07T00:00:00Z', createdAt: '2026-11-07T00:00:00Z' },
      { id: 6, type: 'CAREGIVER_JOINED', title: 'Nuevo cuidador para Pedro', body: 'Bruno aceptó cuidar a Pedro', careSubjectId: 2,
        read: true, readAt: '2026-11-07T00:00:00Z', createdAt: '2026-11-07T00:00:00Z' },
      { id: 7, type: 'INVITATION', title: 'Invitación anterior para Pedro', body: 'Invitación aceptada', careSubjectId: 2,
        read: true, readAt: '2026-11-07T00:00:00Z', createdAt: '2026-11-07T00:00:00Z' },
      { id: 8, type: 'INVITATION', title: 'Invitación anterior para Elena', body: 'Invitación revocada', careSubjectId: 4,
        read: true, readAt: '2026-11-07T00:00:00Z', createdAt: '2026-11-07T00:00:00Z' },
    ],
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
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : {}
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
    const subject = url.match(/^\/care-subjects\/(\d+)$/)
    if (subject) return ok(config, db.subjects.find((s) => s.id === Number(subject[1])))
    if (/^\/care-subjects\/\d+\/relationships$/.test(url)) return ok(config, [])
    if (/^\/care-subjects\/\d+\/health-entries$/.test(url) && method === 'POST') {
      db.createdEntries.push(body)
      return ok(config, { id: 99 }, 201)
    }
    if (/^\/care-subjects\/\d+\/attachments\/\d+\/access$/.test(url)) {
      return ok(config, { url: 'https://archivos.example/receta', expiresAt: '2026-11-08T00:05:00Z' })
    }
    const attachments = url.match(/^\/care-subjects\/\d+\/attachments(?:\/(\d+))?(\/ocr-retry)?$/)
    if (attachments && method === 'POST' && !attachments[1]) {
      db.uploads.push({ form: config.data, timeout: config.timeout })
      db.attachments.push({ ...attachmentBase, id: 30, originalFilename: 'receta.pdf', ocrStatus: 'PENDING' })
      return ok(config, db.attachments.at(-1), 201)
    }
    if (attachments && method === 'GET' && !attachments[1]) return ok(config, db.attachments)
    if (attachments && method === 'GET') {
      const found = db.attachments.find((a) => a.id === Number(attachments[1]))
      if (!found) throw fail(config, 404)
      const current = { ...found }
      // La primera consulta encuentra la lectura en curso; la siguiente, ya terminada
      if (found.ocrStatus === 'PENDING') Object.assign(found, { ocrStatus: 'DONE', ocrText: RECETA_UNICA_MINSA })
      return ok(config, current)
    }
    if (attachments && method === 'POST' && attachments[2]) {
      const found = db.attachments.find((a) => a.id === Number(attachments[1]))!
      found.ocrStatus = 'PENDING'
      return ok(config, { ...found }, 202)
    }
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

test('validateDocumentFile: acepta JPG, PNG y PDF de hasta 10 MB', () => {
  assert.equal(validateDocumentFile({ type: 'image/jpeg', size: 1 }), null)
  assert.equal(validateDocumentFile({ type: 'application/pdf', size: 10 * 1024 * 1024 }), null)
  assert.match(validateDocumentFile({ type: 'image/heic', size: 1 })!, /Formato/)
  assert.match(validateDocumentFile({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })!, /10 MB/)
})

test('documentsOnly: oculta los audios y ordena del más nuevo al más antiguo', () => {
  const doc = (id: number, contentType: string, uploadedAt: string) => ({ ...attachmentBase, id, contentType, uploadedAt, originalFilename: '', ocrStatus: 'DONE' as const })
  const result = documentsOnly([doc(1, 'image/png', '2026-01-01T00:00:00Z'), doc(2, 'audio/mp4', '2026-03-01T00:00:00Z'), doc(3, 'application/pdf', '2026-02-01T00:00:00Z')])
  assert.deepEqual(result.map((d) => d.id), [3, 1])
})

async function chooseFile(input: HTMLInputElement, file: File) {
  await act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

test('Documentos: sube el archivo, espera la lectura y crea el registro con el texto', async (t) => {
  const { b, unmount } = await mountApp('/personas/1?tab=documentos', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /examen\.png/.test(text()), 'lista de documentos')
  assert.doesNotMatch(text(), /nota\.m4a/, 'las notas de voz no se listan')
  assert.match(text(), /Sin leer/)

  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  await chooseFile(input, new File(['x'], 'foto.heic', { type: 'image/heic' }))
  await waitFor(() => /Formato no permitido/.test(text()), 'rechazo del formato')
  assert.equal(b.db.uploads.length, 0, 'no sube un formato no permitido')

  await chooseFile(input, new File(['%PDF'], 'receta.pdf', { type: 'application/pdf' }))
  await waitFor(() => pathname() === '/personas/1/documentos/30', 'ir a la revisión')
  const [upload] = b.db.uploads
  assert.ok(upload.form instanceof FormData, 'se envía como FormData, no como JSON')
  assert.equal((upload.form.get('file') as File).name, 'receta.pdf')
  assert.equal(upload.timeout, 60000)

  await waitFor(() => /Leyendo el documento/.test(text()), 'lectura en curso')
  await waitFor(() => !!document.querySelector<HTMLInputElement>('#entry-title'), 'formulario de revisión', 6000)

  // Sugerencias por reglas a partir de la receta real; Detalles queda vacío
  assert.equal(document.querySelector<HTMLInputElement>('#entry-title')!.value, 'Receta médica')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="categoryCode"][value="MEDICATION"]')!.checked, true)
  assert.equal(document.querySelector<HTMLInputElement>('#entry-occurredOn, input[name="occurredOn"]')!.value, '2024-08-02')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="confidenceLevel"][value="UNCERTAIN"]')!.checked, true)
  assert.equal(document.querySelector<HTMLTextAreaElement>('#entry-details')!.value, '')
  assert.match(text(), /Sugerido del documento/)

  // Medicamentos sugeridos con el diccionario: nada se cambia sin aceptarlo
  await waitFor(() => /Medicamentos y dispositivos detectados/.test(text()), 'medicamentos detectados', 6000)
  assert.match(text(), /Panitidina → ¿Ranitidina\?/)
  assert.match(text(), /Hiosina → ¿Hioscina\?/)
  assert.match(text(), /Joringa → ¿Jeringa\?/)
  assert.doesNotMatch(text(), /Dimininitrato →/)
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Aceptar Ranitidina en lugar de Panitidina"]')!, 'Aceptar')
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Descartar sugerencia Jeringa"]')!, 'Descartar')
  await waitFor(() => /Aceptado/.test(text()) && /Descartado/.test(text()), 'decisiones visibles')
  const detailsArea = () => document.querySelector<HTMLTextAreaElement>('#entry-details')!
  // Aceptar todavía no cambia Detalles, y la página lo dice
  assert.equal(detailsArea().value, '')
  assert.match(text(), /1 corrección aceptada sin aplicar a Detalles\./)

  // Aplicar desde la sección: Detalles recibe el texto con la corrección
  assert.match(text(), /Texto leído del documento/)
  assert.match(document.querySelector('pre')!.textContent!, /Panitidina/, 'la lectura original no cambia')
  await click(byText('button', 'Aplicar a Detalles'), 'Aplicar a Detalles')
  await waitFor(() => /Hiosina/.test(detailsArea().value), 'texto aplicado a Detalles')
  assert.match(detailsArea().value, /Ranitidina 10mg/)
  assert.doesNotMatch(detailsArea().value, /Panitidina/)
  assert.match(detailsArea().value, /Joringa/, 'lo descartado queda como se leyó')
  await waitFor(() => /Detalles ya incluye las correcciones aceptadas/.test(text()), 'estado al día')

  // Copiar otra vez no duplica el texto
  const once = detailsArea().value
  await click(byText('button', 'Copiar a Detalles'), 'Copiar a Detalles')
  assert.equal(detailsArea().value, once)

  // Lo que el usuario escribe se conserva; deshacer y actualizar reemplaza solo el bloque insertado
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(detailsArea(), `Nota del cuidador: tomar con comida.\n\n${once}`)
    detailsArea().dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Deshacer decisión sobre Ranitidina"]')!, 'Deshacer')
  await waitFor(() => /Cambiaste las correcciones después de aplicarlas/.test(text()), 'aviso de cambios sin aplicar')
  await click(byText('button', 'Actualizar Detalles'), 'Actualizar Detalles')
  await waitFor(() => /Panitidina 10mg/.test(detailsArea().value), 'bloque actualizado')
  assert.match(detailsArea().value, /^Nota del cuidador: tomar con comida\./)
  assert.doesNotMatch(detailsArea().value, /Ranitidina/)
  assert.equal(detailsArea().value.match(/Hiosina/g)?.length, 1, 'un solo bloque')

  // Se vuelve a aceptar para registrar con la corrección
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Aceptar Ranitidina en lugar de Panitidina"]')!, 'Aceptar otra vez')
  await click(byText('button', 'Actualizar Detalles'), 'Actualizar Detalles')
  await waitFor(() => /Ranitidina 10mg/.test(detailsArea().value), 'corrección aplicada otra vez')
  assert.equal(detailsArea().value.match(/Hiosina/g)?.length, 1, 'sigue habiendo un solo bloque')

  // El usuario corrige el título antes de guardar
  await type(document.querySelector<HTMLInputElement>('#entry-title')!, 'Receta de emergencia')
  await click(byText('button', 'Registrar'), 'Registrar')
  await waitFor(() => pathname() === '/personas/1/registros/99', 'ir al registro creado')
  const created = b.db.createdEntries[0]
  assert.equal(created.sourceAttachmentId, 30)
  assert.equal(created.title, 'Receta de emergencia')
  assert.equal(created.categoryCode, 'MEDICATION')
  assert.equal(created.occurredOn, '2024-08-02')
  assert.equal(created.confidenceLevel, 'UNCERTAIN')
  assert.match(String(created.details), /Hiosina/)
  assert.match(String(created.details), /Ranitidina/)
})

test('Documentos: sin categoría sugerida hay que elegirla (no hay "Alergia" por defecto)', async (t) => {
  const { b, unmount } = await mountApp('/personas/1/documentos/32', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /No se pudo extraer el texto/.test(text()), 'mensaje de error')
  await click(byText('button', 'Escribir el registro'), 'Escribir el registro')
  await waitFor(() => !!document.querySelector('#entry-title'), 'formulario manual')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="categoryCode"]:checked'), null, 'ninguna categoría marcada')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="confidenceLevel"][value="UNCERTAIN"]')!.checked, true)

  await type(document.querySelector<HTMLInputElement>('#entry-title')!, 'Receta')
  await click(byText('button', 'Registrar'), 'Registrar')
  await waitFor(() => /Elige una categoría/.test(text()), 'pide elegir categoría')
  assert.equal(b.db.createdEntries.length, 0, 'no se envía sin categoría')
})

test('Documentos: una lectura fallida permite escribir el registro a mano o reintentar', async (t) => {
  const { b, unmount } = await mountApp('/personas/1/documentos/32', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /No se pudo extraer el texto/.test(text()), 'mensaje de error')
  assert.equal(document.querySelector('#entry-title'), null, 'el formulario no aparece hasta elegirlo')

  await click(byText('button', 'Escribir el registro'), 'Escribir el registro')
  await waitFor(() => !!document.querySelector('#entry-title'), 'formulario manual')

  await click(byText('button', 'Reintentar'), 'Reintentar')
  await waitFor(() => /Leyendo el documento/.test(text()), 'lectura reiniciada')
  assert.ok(b.calls.includes('POST /care-subjects/1/attachments/32/ocr-retry'))
  assert.equal(document.querySelector('#entry-title'), null, 'el formulario se oculta al reintentar')
})

test('Documentos: abre el archivo en otra pestaña y avisa si el navegador la bloquea', async (t) => {
  const { unmount } = await mountApp('/personas/1/documentos/32', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!byText('button', 'Abrir archivo'), 'botón Abrir archivo')
  const original = window.open
  t.after(() => { window.open = original })

  const tab = { opener: {} as unknown, location: { href: '' }, close() {} }
  window.open = (() => tab) as never
  await click(byText('button', 'Abrir archivo'), 'Abrir archivo')
  await waitFor(() => tab.location.href === 'https://archivos.example/receta', 'enlace en la pestaña nueva')
  assert.equal(tab.opener, null, 'la pestaña no conserva acceso a la app')

  window.open = (() => null) as never
  await click(byText('button', 'Abrir archivo'), 'Abrir archivo')
  await waitFor(() => /bloqueó la pestaña nueva/.test(text()), 'aviso de pestaña bloqueada')
})

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

test('getNotificationLink: el aviso de invitación solo enlaza si queda pendiente', () => {
  const ready = { status: 'ready' as const, bySubject: new Map([[3, 7]]) }
  assert.deepEqual(getNotificationLink({ type: 'INVITATION', careSubjectId: 3 }, ready), { to: '/invitaciones/7', label: 'Ver invitación' })
  assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 2 }, ready), null, 'invitación ya aceptada')
  assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 4 }, ready), null, 'invitación revocada')
  assert.deepEqual(getNotificationLink({ type: 'CAREGIVER_JOINED', careSubjectId: 2 }, ready), { to: '/personas/2?tab=cuidadores', label: 'Ver cuidadores' })
  assert.deepEqual(getNotificationLink({ type: 'CAREGIVER_JOINED', careSubjectId: 2 }, { status: 'error', bySubject: new Map() }), { to: '/personas/2?tab=cuidadores', label: 'Ver cuidadores' }, 'no depende de la lista de pendientes')
  assert.deepEqual(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: 1 }, ready), { to: '/personas/1', label: 'Ver persona' })
  assert.equal(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: null }, ready), null)
  for (const status of ['loading', 'error'] as const) {
    const unknown = { status, bySubject: new Map<number, number>() }
    assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 3 }, unknown), null, `sin saber si está pendiente (${status}) no enlaza`)
    assert.deepEqual(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: 1 }, unknown), { to: '/personas/1', label: 'Ver persona' })
  }
})

test('Avisos: enlaza la invitación pendiente y el nuevo cuidador, y omite enlaces de invitaciones anteriores', async (t) => {
  const { unmount } = await mountApp('/avisos', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('a[href="/invitaciones/7"]'), 'enlace Ver invitación')
  const invitation = document.querySelector('a[href="/invitaciones/7"]')!
  assert.equal(invitation.textContent?.trim(), 'Ver invitación')
  assert.equal(document.querySelector('a[href="/personas/3"]'), null, 'no enlaza a la persona con la invitación pendiente (403)')
  assert.equal(document.querySelector('a[href="/personas/2?tab=cuidadores"]')?.textContent?.trim(), 'Ver cuidadores')
  const joined = byText('h2', /^Nuevo cuidador para Pedro$/)?.closest('article')
  assert.ok(joined)
  assert.ok([...joined.querySelectorAll('span')].some((span) => span.textContent?.trim() === 'Nuevo cuidador'))
  for (const name of ['Pedro', 'Elena']) {
    const oldInvitation = byText('h2', new RegExp(`^Invitación anterior para ${name}$`))?.closest('article')
    assert.ok(oldInvitation, `aviso de invitación anterior para ${name}`)
    assert.equal(oldInvitation.querySelector('a')?.getAttribute('href') ?? null, null)
  }

  await click(invitation, 'Ver invitación')
  await waitFor(() => pathname() === '/invitaciones/7' && /Lucía/.test(text()), 'abrir la invitación')
})
