// Pruebas del layout privado, el dashboard, avisos, perfil e invitaciones contra un backend simulado (jsdom).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
})
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
// jsdom no implementa los diálogos modales
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})

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
    delegateStatus: 200,
    attachments: [
      { ...attachmentBase, id: 31, originalFilename: 'nota.m4a', contentType: 'audio/mp4', ocrStatus: 'DONE' },
      { ...attachmentBase, id: 32, originalFilename: 'examen.png', contentType: 'image/png', ocrStatus: 'FAILED', ocrError: 'No se pudo extraer el texto.' },
    ],
    consultationUpdates: [] as Record<string, unknown>[],
    registers: [] as Record<string, unknown>[],
    termsVersion: '1.0',
    nextTermsVersion: null as string | null,
    resets: [] as Record<string, unknown>[],
    uploads: [] as { form: unknown; timeout: unknown }[],
    createdEntries: [] as Record<string, unknown>[],
    me: { id: 1, email: 'ana@demo.yuyay', name: 'Ana Torres', role: 'USER', createdAt: '2026-10-01T00:00:00Z' },
    // null: el backend no tiene el clasificador de documentos (responde 404)
    scope: null as null | { enabled: boolean; appropriate: number; unsure: number; strikes: number },
    subjects: [
      { id: 1, name: 'Rosa', birthDate: '1954-01-01', notes: null, createdAt: '2026-10-01T00:00:00Z', myRole: 'PRINCIPAL' },
      { id: 2, name: 'Pedro', birthDate: '1951-01-01', notes: null, createdAt: '2026-10-01T00:00:00Z', myRole: 'PRINCIPAL' },
    ],
    consultations: {
      1: [
        { id: 10, careSubjectId: 1, createdByUserId: 1, date: day(-14), reason: 'Control de presión', notes: null },
        { id: 11, careSubjectId: 1, createdByUserId: 1, date: day(5), time: '15:30:00', reason: 'Control con cardiología', notes: null },
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
      user: db.me }
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
    if (url === '/auth/terms') return ok(config, {
      version: db.termsVersion,
      text: `TÉRMINOS DE USO Y AVISO DE PRIVACIDAD DE YUYAY\nVersión ${db.termsVersion}\n\nDocumento de prueba.`,
    })
    if (url === '/auth/register') {
      db.registers.push(body)
      if (body.dni === '88888888' && body.fullName !== 'Ana Quispe Mamani') {
        const error = fail(config, 400)
        throw Object.assign(error, { response: { ...error.response, data: {
          message: 'El nombre no coincide', fieldErrors: [{ field: 'dni', message: 'El nombre no coincide con el de este DNI.' }],
        } } })
      }
      if (db.nextTermsVersion) {
        db.termsVersion = db.nextTermsVersion
        db.nextTermsVersion = null
      }
      if (body.termsVersion !== db.termsVersion) {
        const error = fail(config, 400)
        throw Object.assign(error, { response: { ...error.response, data: { code: 'TERMS_VERSION_OUTDATED' } } })
      }
      return ok(config, auth(), 201)
    }
    if (url === '/auth/forgot-password') return ok(config, '', 204)
    if (url === '/auth/reset-password') {
      db.resets.push(body)
      return ok(config, '', 204)
    }
    if (url === '/users/me/document-scope') {
      if (!db.scope) throw fail(config, 404)
      return ok(config, db.scope)
    }
    if (url === '/users/me' && method === 'GET') return ok(config, db.me)
    if (url === '/users/me' && method === 'PATCH') {
      db.me = { ...db.me, name: body.name, ...(body.gender ? { gender: body.gender } : {}), ...(Object.hasOwn(body, 'birthDate') ? { birthDate: body.birthDate } : {}) } as typeof db.me
      return ok(config, db.me)
    }
    if (url === '/care-subjects') return ok(config, db.subjects)
    const subject = url.match(/^\/care-subjects\/(\d+)$/)
    if (subject) {
      const found = db.subjects.find((s) => s.id === Number(subject[1]))
      if (!found) throw fail(config, 404)
      if (method === 'DELETE') {
        db.subjects = db.subjects.filter((s) => s !== found)
        return ok(config, '', 204)
      }
      return ok(config, found)
    }
    if (/^\/care-subjects\/\d+\/relationships$/.test(url)) return ok(config, [])
    if (/^\/care-subjects\/\d+\/handoffs$/.test(url) && method === 'GET') {
      return ok(config, [{ id: 81, careSubjectId: 1, createdByUserId: 1, reason: 'Resumen de control anual',
        questions: 'Preguntas de prueba', createdAt: '2026-11-07T00:00:00Z' }])
    }
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
    if (/^\/care-subjects\/\d+\/consultations\/changes$/.test(url)) return ok(config, [])
    if (/^\/consultations\/\d+$/.test(url) && method === 'PATCH') {
      db.consultationUpdates.push(body)
      return ok(config, { id: 11, ...body })
    }
    if (url === '/public/delegations/enlace-citas/exchange') {
      return ok(config, { accessToken: 'D1', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', careSubjectId: 1,
        careSubjectName: 'Rosa', granteeName: 'Luz', categoryCodes: [], includeConsultations: true })
    }
    if (url === '/delegate/me') {
      assert.equal(config.headers.Authorization, 'Bearer D1')
      if (db.delegateStatus !== 200) throw fail(config, db.delegateStatus)
      return ok(config, {})
    }
    if (url === '/delegate/health-entries') return ok(config, [])
    if (url === '/delegate/consultations') {
      return ok(config, [
        { id: 2, date: day(-3), time: null, reason: 'Control pasado' },
        { id: 1, date: day(4), time: '15:30:00', reason: 'Cardiología' },
      ])
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
  const start = performance.now()
  while (!condition()) {
    if (performance.now() - start > timeoutMs) throw new Error(`No se cumplió a tiempo: ${message} (ruta: ${pathname()}${search()})`)
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

type Db = ReturnType<typeof backend>['db']

async function mountApp(path: string, { loggedIn, seed }: { loggedIn: boolean; seed?: (db: Db) => void }) {
  const storage = new MemoryStorage()
  ;(globalThis as any).sessionStorage = storage
  http.clearTokens()
  const b = backend()
  seed?.(b.db)
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

for (const [index, role, label] of [
  [0, 'PRINCIPAL', 'Tú coordinas el cuidado'],
  [1, 'CAREGIVER', 'Tú colaboras en el cuidado'],
] as const) {
  test(`Personas y perfil explican el rol ${role} desde la perspectiva de quien inició sesión`, async (t) => {
    const { b, unmount } = await mountApp('/people', { loggedIn: true, seed: db => { db.subjects[index].myRole = role } })
    t.after(unmount)
    const person = b.db.subjects[index]
    const card = () => byText('button', new RegExp(person.name + '.*' + label))
    await waitFor(() => !!card(), 'tarjeta con el rol del usuario')
    await click(card(), person.name)
    await waitFor(() => document.querySelector('h1')?.textContent === person.name, 'perfil de la persona')
    const header = document.querySelector('h1')!.closest('header')!
    assert.ok(header.textContent?.includes(label))
    assert.match(header.querySelector('h1 + p')!.textContent!, /^\d+ años$/)
  })
}

test('Documentos: sube el archivo, espera la lectura y crea el registro con el texto', async (t) => {
  const { b, unmount } = await mountApp('/people/1?tab=documents', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /examen\.png/.test(text()), 'lista de documentos')
  assert.doesNotMatch(text(), /nota\.m4a/, 'las notas de voz no se listan')
  assert.match(text(), /Sin leer/)

  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  await chooseFile(input, new File(['x'], 'foto.heic', { type: 'image/heic' }))
  await waitFor(() => /Formato no permitido/.test(text()), 'rechazo del formato')
  assert.equal(b.db.uploads.length, 0, 'no sube un formato no permitido')

  await chooseFile(input, new File(['%PDF'], 'receta.pdf', { type: 'application/pdf' }))
  await waitFor(() => pathname() === '/people/1/documents/30', 'ir a la revisión')
  const [upload] = b.db.uploads
  assert.ok(upload.form instanceof FormData, 'se envía como FormData, no como JSON')
  assert.equal((upload.form.get('file') as File).name, 'receta.pdf')
  assert.equal(upload.form.get('source'), 'web', 'el backend registra que el documento vino de la web')
  assert.equal(upload.timeout, 60000)

  await waitFor(() => /Leyendo el documento/.test(text()), 'lectura en curso')
  await waitFor(() => !!document.querySelector<HTMLInputElement>('#entry-title'), 'formulario de revisión', 6000)

  // El formulario aparece al terminar el OCR, con todo el texto visible y por confirmar
  assert.equal(document.querySelector<HTMLInputElement>('#entry-title')!.value, 'Receta médica')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="categoryCode"][value="MEDICATION"]')!.checked, true)
  assert.equal(document.querySelector<HTMLInputElement>('#entry-occurredOn, input[name="occurredOn"]')!.value, '2024-08-02')
  assert.equal(document.querySelector<HTMLInputElement>('input[name="confidenceLevel"][value="UNCERTAIN"]')!.checked, true)
  assert.equal(document.querySelector<HTMLTextAreaElement>('#entry-details')!.value, RECETA_UNICA_MINSA)
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
  assert.equal(detailsArea().value, RECETA_UNICA_MINSA)
  assert.match(text(), /1 corrección aceptada sin aplicar al texto del documento\./)

  // Aplicar desde la sección: Detalles recibe el texto con la corrección
  assert.match(text(), /Lectura original del documento/)
  assert.match(document.querySelector('pre')!.textContent!, /Panitidina/, 'la lectura original no cambia')
  await click(byText('button', 'Aplicar al texto'), 'Aplicar al texto')
  await waitFor(() => /Hiosina/.test(detailsArea().value), 'texto aplicado a Detalles')
  assert.match(detailsArea().value, /Ranitidina 10mg/)
  assert.doesNotMatch(detailsArea().value, /Panitidina/)
  assert.match(detailsArea().value, /Joringa/, 'lo descartado queda como se leyó')
  await waitFor(() => /El texto del documento ya incluye las correcciones aceptadas/.test(text()), 'estado al día')

  // No hay un segundo paso oculto para incluir el texto en el registro.
  const once = detailsArea().value
  assert.equal(byText('button', 'Copiar a Detalles'), null)

  // Lo que el usuario escribe se conserva; deshacer y actualizar reemplaza solo el bloque insertado
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(detailsArea(), `Nota del cuidador: tomar con comida.\n\n${once}`)
    detailsArea().dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Deshacer decisión sobre Ranitidina"]')!, 'Deshacer')
  await waitFor(() => /Cambiaste las correcciones después de aplicarlas/.test(text()), 'aviso de cambios sin aplicar')
  await click(byText('button', 'Actualizar texto'), 'Actualizar texto')
  await waitFor(() => /Panitidina 10mg/.test(detailsArea().value), 'bloque actualizado')
  assert.match(detailsArea().value, /^Nota del cuidador: tomar con comida\./)
  assert.doesNotMatch(detailsArea().value, /Ranitidina/)
  assert.equal(detailsArea().value.match(/Hiosina/g)?.length, 1, 'un solo bloque')

  // Se vuelve a aceptar para registrar con la corrección
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Aceptar Ranitidina en lugar de Panitidina"]')!, 'Aceptar otra vez')
  await click(byText('button', 'Aplicar al texto'), 'Aplicar al texto')
  await waitFor(() => /Ranitidina 10mg/.test(detailsArea().value), 'corrección aplicada otra vez')
  assert.equal(detailsArea().value.match(/Hiosina/g)?.length, 1, 'sigue habiendo un solo bloque')

  // Una edición dentro del bloque impide sustituirlo o anexar otra copia del OCR.
  const manuallyReviewed = detailsArea().value.replace('10mg', '20mg, verificado con el archivo')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(detailsArea(), manuallyReviewed)
    detailsArea().dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelector('button[aria-label="Aceptar Hioscina en lugar de Hiosina"]'), 'Aceptar Hioscina')
  await click(byText('button', 'Actualizar texto'), 'Actualizar texto')
  assert.equal(detailsArea().value, manuallyReviewed)
  assert.match(text(), /Conservamos tus cambios/)
  await click(byText('button', 'Actualizar texto'), 'Reintentar sin duplicar')
  assert.equal(detailsArea().value, manuallyReviewed)

  // El usuario corrige el título antes de guardar
  await type(document.querySelector<HTMLInputElement>('#entry-title')!, 'Receta de emergencia')
  await click(byText('button', 'Registrar'), 'Registrar')
  await waitFor(() => pathname() === '/people/1/entries/99', 'ir al registro creado')
  const created = b.db.createdEntries[0]
  assert.equal(created.sourceAttachmentId, 30)
  assert.equal(created.title, 'Receta de emergencia')
  assert.equal(created.categoryCode, 'MEDICATION')
  assert.equal(created.occurredOn, '2024-08-02')
  assert.equal(created.confidenceLevel, 'UNCERTAIN')
  assert.match(String(created.details), /Hiosina/)
  assert.match(String(created.details), /Ranitidina/)
})

test('Documentos: guarda todo el texto largo corregido con Confirmado y explica su uso en el resumen', async (t) => {
  const longText = `${RECETA_UNICA_MINSA}\n${'Texto completo del documento de prueba. '.repeat(180)}FIN DEL DOCUMENTO`
  const { b, unmount } = await mountApp('/people/1/documents/32', {
    loggedIn: true,
    seed: (db) => Object.assign(db.attachments[1], { ocrStatus: 'DONE', ocrText: longText }),
  })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('#entry-details'), 'texto precargado')
  const details = document.querySelector<HTMLTextAreaElement>('#entry-details')!
  assert.equal(details.value, longText)
  assert.equal(details.hasAttribute('maxlength'), false)
  assert.equal(details.closest('details'), null, 'el texto editable está visible')
  assert.match(text(), /Se guardará este registro\./)
  assert.equal(document.querySelector<HTMLInputElement>('input[value="UNCERTAIN"]')!.checked, true)
  const reviewed = longText.replace('Panitidina', 'Ranitidina revisada')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(details, reviewed)
    details.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelector('input[value="CONFIRMED"]'), 'Confirmado')
  await waitFor(() => /Medicamentos y dispositivos detectados/.test(text()), 'diccionario cargado')
  assert.equal(details.value, reviewed)
  assert.equal(document.querySelector<HTMLInputElement>('input[value="CONFIRMED"]')!.checked, true)
  await click(byText('button', 'Registrar'), 'Registrar')
  await waitFor(() => b.db.createdEntries.length === 1, 'POST del registro')
  assert.equal(b.db.createdEntries[0].details, reviewed)
  assert.equal(b.db.createdEntries[0].confidenceLevel, 'CONFIRMED')
  assert.equal(b.db.createdEntries[0].sourceAttachmentId, 32)
})

test('Documentos: borrar el texto OCR impide guardar y pide conservar o escribir contenido', async (t) => {
  const { b, unmount } = await mountApp('/people/1/documents/32', {
    loggedIn: true,
    seed: (db) => Object.assign(db.attachments[1], { ocrStatus: 'DONE', ocrText: RECETA_UNICA_MINSA }),
  })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('#entry-details'), 'texto precargado')
  const details = document.querySelector<HTMLTextAreaElement>('#entry-details')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(details, '   ')
    details.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(document.querySelector('input[value="CONFIRMED"]'), 'Confirmado')
  await click(byText('button', 'Registrar'), 'Registrar')
  await waitFor(() => /Revisa y conserva el texto del documento/.test(text()), 'explicación junto al contenido')
  assert.equal(b.db.createdEntries.length, 0)
  assert.equal(details.value, '   ', 'no rellena el campo silenciosamente')
})

test('Documentos: sin categoría sugerida hay que elegirla (no hay "Alergia" por defecto)', async (t) => {
  const { b, unmount } = await mountApp('/people/1/documents/32', { loggedIn: true })
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
  const { b, unmount } = await mountApp('/people/1/documents/32', { loggedIn: true })
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
  const { unmount } = await mountApp('/people/1/documents/32', { loggedIn: true })
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

test('Consultas: muestra la hora y permite editar la cita y quitarle la hora', async (t) => {
  const { b, unmount } = await mountApp('/people/1?tab=appointments', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Control con cardiología/.test(text()), 'lista de consultas')
  const links = [...document.querySelectorAll('a')].filter((link) => link.textContent?.trim() === 'Consultas')
  assert.equal(links.length, 1)
  assert.equal(links[0].closest('nav')?.getAttribute('aria-label'), 'Secciones de la persona')
  assert.equal(links[0].getAttribute('aria-current'), 'page')
  assert.match(text(), /3:30/)

  await click(document.querySelector(`button[aria-label^='Editar la consulta "Control con cardiología"']`), 'Editar')
  await waitFor(() => !!document.querySelector('#consultation-time'), 'formulario de edición')
  const time = document.querySelector<HTMLInputElement>('#consultation-time')!
  assert.equal(time.value, '3:30')
  assert.equal(byText('button', 'PM')!.getAttribute('aria-pressed'), 'true')
  await type(time, '')
  await click(byText('button', 'Guardar cambios'), 'Guardar cambios')
  await waitFor(() => b.db.consultationUpdates.length === 1, 'cambios enviados')
  assert.deepEqual(b.db.consultationUpdates[0], { date: day(5), clearTime: true, reason: 'Control con cardiología', notes: '' })
})

test('Vista del delegado: muestra solo citas, con hora y sin notas, las próximas primero', async (t) => {
  const { unmount } = await mountApp('/access/enlace-citas', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => /Cardiología/.test(text()), 'citas compartidas')
  assert.match(text(), /3:30/)
  assert.ok(text().indexOf('Cardiología') < text().indexOf('Control pasado'), 'la próxima va primero')
  assert.equal(document.querySelector('nav[aria-label="Filtrar por categoría"]'), null, 'sin categorías no hay filtro')
  assert.doesNotMatch(text(), /No hay registros/)
})

test('La pestaña delegada retira las citas al revocar una lectura abierta, sin canjear de nuevo', async (t) => {
  const { b, unmount } = await mountApp('/access/enlace-citas', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => /Cardiología/.test(text()), 'lectura abierta')
  b.db.delegateStatus = 403
  await waitFor(() => /El acceso ya no está vigente/.test(text()), 'revocación en la pestaña abierta', 16_000)
  assert.doesNotMatch(text(), /Cardiología|Control pasado/)
  assert.equal(sessionStorage.getItem('yuyay.delegate.enlace-citas'), null)
  assert.equal(b.calls.filter(call => call.endsWith('/exchange')).length, 1)
})

test('El delegado recupera la lectura tras un corte solo cuando el servidor confirma el permiso', async (t) => {
  const { b, unmount } = await mountApp('/access/enlace-citas', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => /Cardiología/.test(text()), 'lectura abierta')
  await act(async () => { window.dispatchEvent(new window.Event('offline')) })
  assert.match(text(), /Lectura en pausa/)
  b.db.delegateStatus = 503
  await act(async () => { window.dispatchEvent(new window.Event('online')) })
  assert.doesNotMatch(text(), /Cardiología/)
  assert.ok(sessionStorage.getItem('yuyay.delegate.enlace-citas'))
  b.db.delegateStatus = 200
  await act(async () => { window.dispatchEvent(new window.Event('focus')) })
  await waitFor(() => /Cardiología/.test(text()), 'el servidor vuelve a autorizar la lectura')
})

test('Enlace antiguo /acceso/:token redirige a /access/:token y conserva la query', async (t) => {
  const { unmount } = await mountApp('/acceso/enlace-citas?x=1', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => pathname() === '/access/enlace-citas' && /Cardiología/.test(text()), 'redirige al acceso delegado')
  assert.equal(search(), '?x=1', 'conserva la query')
})

test('Enlace antiguo /invitaciones/:id redirige a /invitations/:id', async (t) => {
  const { unmount } = await mountApp('/invitaciones/7', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => pathname() === '/invitations/7' && /Lucía/.test(text()), 'redirige a la invitación')
})

const inputById = (id: string) => document.getElementById(id) as HTMLInputElement

test('Registro: conserva el formulario al leer términos y exige aceptar la versión antes de enviarlo', async (t) => {
  const { b, unmount } = await mountApp('/register', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!inputById('auth-name'), 'formulario de registro')
  await type(inputById('auth-name'), 'Ana')
  await type(inputById('auth-dni'), '45678912')
  await type(inputById('auth-full-name'), 'Ana Quispe Mamani')
  await type(inputById('auth-email'), 'ana@example.test')
  await type(inputById('auth-password'), 'Clave123')
  await waitFor(() => /✓ Una letra \(A-Z\)/.test(text()), 'requisitos actualizados')

  assert.equal(inputById('auth-password').type, 'password')
  await click(document.querySelector('button[aria-label="Mostrar contraseña"]'), 'Mostrar contraseña')
  await waitFor(() => inputById('auth-password').type === 'text' && inputById('auth-confirm').type === 'text', 'contraseñas visibles')

  await type(inputById('auth-confirm'), 'Clave124')
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => /Las contraseñas no coinciden/.test(text()), 'error de confirmación')
  assert.equal(b.db.registers.length, 0)

  await type(inputById('auth-confirm'), 'Clave123')
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => /Lee y acepta los términos/.test(text()), 'error de aceptación')
  assert.equal(b.db.registers.length, 0)

  const trigger = byText('button', /^Leer los términos/)
  await click(trigger, 'Leer los términos')
  await waitFor(() => !!byText('dialog[open] div[tabindex="0"]', /Documento de prueba/), 'texto del documento')
  assert.match(document.querySelector('dialog[open]')?.className ?? '', /bg-white.*text-black/)
  await act(async () => {
    document.querySelector<HTMLButtonElement>('dialog[open] button[aria-label="Cerrar"]')?.focus()
    document.querySelector('dialog[open]')?.dispatchEvent(new window.Event('cancel', { cancelable: true }))
  })
  assert.equal(document.querySelector('dialog[open]'), null)
  assert.equal(document.activeElement, trigger)
  assert.equal(inputById('auth-name').value, 'Ana')
  assert.equal(inputById('auth-confirm').value, 'Clave123')
  assert.equal(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked, false)
  assert.equal(b.db.registers.length, 0)
  await click(document.querySelector('input[type="checkbox"]'), 'Aceptar términos')
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => b.db.registers.length === 1, 'registro enviado')
  // Sin elegir género: la pregunta se salta y viaja como null.
  assert.deepEqual(b.db.registers[0], {
    name: 'Ana', fullName: 'Ana Quispe Mamani', gender: null, dni: '45678912', email: 'ana@example.test', password: 'Clave123', termsAccepted: true, termsVersion: '1.0',
  })
})

test('Registro: el género elegido se envía con la cuenta', async (t) => {
  const { b, unmount } = await mountApp('/register', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!inputById('auth-name'), 'formulario de registro')
  assert.match(text(), /Género \(opcional, puedes saltarlo\)/)
  await type(inputById('auth-name'), 'Ana')
  await type(inputById('auth-dni'), '45678912')
  await type(inputById('auth-full-name'), 'Ana Quispe Mamani')
  await click(document.querySelector('input[type="radio"][value="FEMALE"]'), 'Mujer')
  await type(inputById('auth-email'), 'ana@example.test')
  await type(inputById('auth-password'), 'Clave123')
  await type(inputById('auth-confirm'), 'Clave123')
  await click(byText('button', /^Leer los términos/), 'Leer los términos')
  await waitFor(() => !!byText('dialog[open] div[tabindex="0"]', /Documento de prueba/), 'texto del documento')
  await act(async () => {
    document.querySelector('dialog[open]')?.dispatchEvent(new window.Event('cancel', { cancelable: true }))
  })
  await click(document.querySelector('input[type="checkbox"]'), 'Aceptar términos')
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => b.db.registers.length === 1, 'registro enviado')
  assert.equal((b.db.registers[0] as { gender?: string }).gender, 'FEMALE')
})

test('Registro: exige DNI y permite corregir el nombre sin consultar el directorio antes del alta', async (t) => {
  const { b, unmount } = await mountApp('/register', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!inputById('auth-dni'), 'campo DNI')
  assert.equal(inputById('auth-dni').getAttribute('aria-describedby'), 'auth-dni-hint')
  await type(inputById('auth-name'), 'Ana Quispe')
  await type(inputById('auth-dni'), '1234')
  await type(inputById('auth-email'), 'ana@example.test')
  await type(inputById('auth-password'), 'Clave123')
  await type(inputById('auth-confirm'), 'Clave123')
  await click(byText('button', /^Leer los términos/), 'Leer los términos')
  await waitFor(() => !!byText('dialog[open] div[tabindex="0"]', /Documento de prueba/), 'texto del documento')
  await act(async () => {
    document.querySelector('dialog[open]')?.dispatchEvent(new window.Event('cancel', { cancelable: true }))
  })
  await click(document.querySelector('input[type="checkbox"]'), 'Aceptar términos')

  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => /Ingresa los 8 dígitos de tu DNI/.test(text()), 'error de formato')
  assert.equal(b.db.registers.length, 0)

  await type(inputById('auth-dni'), '88888888')
  assert.equal(inputById('auth-full-name').value, '')
  assert.equal(byText('button', 'Ver mi nombre'), null)
  assert.equal(byText('button', 'Sí, soy yo'), null)
  await type(inputById('auth-full-name'), 'Ana Quispe')
  assert.equal(b.calls.some((call) => call.includes('dni-lookup')), false)
  assert.equal(b.db.registers.length, 0)
  assert.equal(document.querySelector('form a[href^="mailto:"]'), null)
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => /El nombre no coincide con el de este DNI/.test(text()), 'rechazo del backend')
  assert.equal(inputById('auth-dni').getAttribute('aria-invalid'), 'true')
  assert.equal(inputById('auth-dni').getAttribute('aria-describedby'), 'auth-dni-error')
  assert.equal(pathname(), '/register')
  assert.equal(inputById('auth-name').value, 'Ana Quispe')

  await type(inputById('auth-full-name'), 'Ana Quispe Mamani')
  await click(byText('button', 'Registrarme'), 'Reintentar con el nombre correcto')
  await waitFor(() => pathname() === '/', 'registro completado tras corregir el nombre')
  assert.deepEqual(b.db.registers.map(({ dni, fullName, name }) => ({ dni, fullName, name })), [
    { dni: '88888888', fullName: 'Ana Quispe', name: 'Ana Quispe' },
    { dni: '88888888', fullName: 'Ana Quispe Mamani', name: 'Ana Quispe' },
  ])
  assert.equal(b.calls.some((call) => call.includes('dni-lookup')), false)
})

test('Registro: una versión vencida abre el texto vigente y vuelve a pedir aceptación', async (t) => {
  const { b, unmount } = await mountApp('/register', { loggedIn: false, seed: (db) => { db.nextTermsVersion = '2.0' } })
  t.after(unmount)
  await waitFor(() => !!inputById('auth-name'), 'formulario de registro')
  await type(inputById('auth-name'), 'Ana')
  await type(inputById('auth-dni'), '45678912')
  await type(inputById('auth-full-name'), 'Ana Quispe Mamani')
  await type(inputById('auth-email'), 'ana@example.test')
  await type(inputById('auth-password'), 'Clave123')
  await type(inputById('auth-confirm'), 'Clave123')
  const trigger = byText('button', /^Leer los términos/)
  await click(trigger, 'Leer los términos')
  await waitFor(() => /Versión 1\.0/.test(text()), 'primera versión')
  await click(document.querySelector('dialog[open] button[aria-label="Cerrar"]'), 'Cerrar documento')
  await click(document.querySelector('input[type="checkbox"]'), 'Aceptar términos')
  await click(byText('button', 'Registrarme'), 'Registrarme')
  await waitFor(() => /Versión 2\.0/.test(document.querySelector('dialog[open]')?.textContent ?? ''), 'modal con versión vigente')
  assert.equal(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked, false)
  await click(document.querySelector('dialog[open] button[aria-label="Cerrar"]'), 'Cerrar documento actualizado')
  assert.equal(document.activeElement, trigger)
  assert.equal(inputById('auth-name').value, 'Ana')
  assert.equal(inputById('auth-password').value, 'Clave123')
  await click(byText('button', 'Registrarme'), 'Registrarme sin confirmar')
  assert.equal(b.db.registers.length, 1)
  await click(document.querySelector('input[type="checkbox"]'), 'Aceptar versión 2.0')
  await click(byText('button', 'Registrarme'), 'Registrarme con nueva versión')
  await waitFor(() => b.db.registers.length === 2, 'segundo intento enviado')
  assert.equal(b.db.registers[1].termsVersion, '2.0')
})

test('Recuperar contraseña: desde el login pide el código, cambia la contraseña y entra', async (t) => {
  const { b, unmount } = await mountApp('/login', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!byText('a', '¿Olvidaste tu contraseña?'), 'enlace de recuperación')
  await click(byText('a', '¿Olvidaste tu contraseña?'), 'enlace de recuperación')
  await waitFor(() => pathname() === '/forgot-password' && !!inputById('auth-email'), 'pantalla de recuperación')
  await type(inputById('auth-email'), 'ana@example.test')
  await click(byText('button', 'Enviar código'), 'Enviar código')
  await waitFor(() => !!inputById('reset-code'), 'paso del código')
  assert.match(text(), /ana@example\.test tiene una cuenta/)

  await type(inputById('reset-code'), '123')
  await type(inputById('reset-password'), 'Clave123')
  await type(inputById('reset-confirm'), 'Clave123')
  await click(byText('button', 'Cambiar contraseña'), 'Cambiar contraseña')
  await waitFor(() => /Ingresa los 6 dígitos/.test(text()), 'código incompleto')
  assert.equal(b.db.resets.length, 0)

  await type(inputById('reset-code'), '123456')
  await click(byText('button', 'Cambiar contraseña'), 'Cambiar contraseña')
  await waitFor(() => pathname() === '/', 'entra después de cambiarla')
  assert.deepEqual(b.db.resets[0], { email: 'ana@example.test', code: '123456', newPassword: 'Clave123' })
})

test('getPostLoginTarget: vuelve a la ruta guardada y rechaza destinos inválidos', () => {
  assert.equal(getPostLoginTarget(null), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '/invitations/7', search: '?x=1' } }), '/invitations/7?x=1')
  assert.equal(getPostLoginTarget({ from: { pathname: '/login' } }), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '/register' } }), '/')
  assert.equal(getPostLoginTarget({ from: { pathname: '//evil.example' } }), '/', 'no sale del sitio')
  assert.equal(getPostLoginTarget({ from: { pathname: 'https://evil.example' } }), '/')
  assert.equal(getPostLoginTarget({ from: 'texto' }), '/')
})

test('Enlace del correo sin sesión: login y vuelve a la invitación; aceptar lleva a la persona', async (t) => {
  const { b, unmount } = await mountApp('/invitations/7', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => pathname() === '/login' && !!document.querySelector('input[type="password"]'), 'redirección a /login')

  await type(document.querySelector<HTMLInputElement>('input[type="email"], input[name="email"]')!, 'ana@demo.yuyay')
  await type(document.querySelector<HTMLInputElement>('input[type="password"]')!, 'Demo12345')
  await click(document.querySelector('form button[type="submit"]'), 'el botón de ingresar')

  await waitFor(() => pathname() === '/invitations/7', 'volver a /invitations/7 después del login')
  await waitFor(() => /Lucía/.test(text()), 'mostrar la invitación')
  await click(byText('button', /Aceptar invitación/), 'el botón Aceptar invitación')
  await waitFor(() => pathname() === '/people/3', 'ir a la persona aceptada')
  assert.ok(b.calls.includes('POST /me/relationships/7/accept'))
})

test('Invitación que ya no está pendiente: estado vacío, sin botón de aceptar', async (t) => {
  const { unmount } = await mountApp('/invitations/99', { loggedIn: true })
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
  const hero = [...document.querySelectorAll('section')].find((el) => el.querySelector('h2')?.textContent === 'Próxima cita')!
  assert.doesNotMatch(hero.textContent ?? '', /Control con cardiología/, 'la de Rosa es más lejana')
  // Como en la app móvil, también se listan las próximas citas de todas las personas, la más cercana primero
  await waitFor(() => !!document.getElementById('upcoming-title'), 'lista de próximas citas')
  const list = document.getElementById('upcoming-title')!.closest('section')!.textContent ?? ''
  assert.ok(list.indexOf('Control con urología') < list.indexOf('Control con cardiología'), 'ordenadas por fecha')
  assert.ok(document.querySelector('a[href="/invitations/7"]'), 'enlace a la invitación pendiente')
})

test('Inicio sin sesión: muestra la landing con accesos a crear cuenta e iniciar sesión', async (t) => {
  const { unmount } = await mountApp('/', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('h1'), 'título de la landing')
  assert.equal(pathname(), '/', 'se queda en el inicio, sin redirigir al login')
  assert.match(document.querySelector('h1')?.textContent ?? '', /memoria de salud/)
  assert.ok(document.querySelector('header a[href="/register"]'), 'botón Crear cuenta en la barra')
  assert.ok(document.querySelector('header a[href="/login"]'), 'Iniciar sesión en la barra')
  for (const id of ['que-es', 'que-hace', 'por-que', 'equipo']) {
    assert.ok(document.getElementById(id), `sección #${id}`)
    assert.ok(document.querySelector(`a[href="#${id}"]`), `enlace a #${id}`)
  }
})

test('Landing: Escape cierra el menú de secciones y devuelve el foco al botón', async (t) => {
  const { unmount } = await mountApp('/', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('button[aria-controls="landing-menu"]'), 'botón del menú')
  const button = document.querySelector<HTMLButtonElement>('button[aria-controls="landing-menu"]')!
  button.focus()
  await click(button, 'Abrir menú')
  const first = document.querySelector<HTMLAnchorElement>('#landing-menu a[href="#que-es"]')
  assert.ok(first, 'el menú muestra «Qué es»')
  first!.focus()
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
  assert.equal(document.getElementById('landing-menu'), null, 'el menú se cierra')
  assert.equal(document.activeElement, button, 'el foco vuelve a «Abrir menú»')
  assert.equal(button.getAttribute('aria-expanded'), 'false')
})

test('Landing: la cifra de hipertensión enlaza el informe de MINSA', async (t) => {
  const { unmount } = await mountApp('/', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => !!document.getElementById('por-que'), 'sección de cifras')
  const link = document.querySelector<HTMLAnchorElement>('#por-que a[href*="minsa.gob.pe"]')
  assert.match(link?.textContent ?? '', /MINSA · PP 0018, 2024/)
  assert.equal(link?.getAttribute('rel'), 'noopener noreferrer')
  assert.doesNotMatch(document.getElementById('por-que')!.textContent ?? '', /ENDES 2023/)
})

test('Sin sesión, las demás rutas privadas siguen llevando al login', async (t) => {
  const { unmount } = await mountApp('/people', { loggedIn: false })
  t.after(unmount)
  await waitFor(() => pathname() === '/login', 'redirección a /login')
})

test('Layout: navegación con la ruta activa y contador de avisos sin leer', async (t) => {
  const { unmount } = await mountApp('/people', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('a[aria-current="page"][href="/people"]'), 'enlace activo de Personas')
  await waitFor(() => !!document.querySelector('a[href="/notifications"][aria-label*="3"]'), 'campana con 3 sin leer')
})

test('Avisos: filtro en la URL, marcar como leído actualiza la lista y el contador', async (t) => {
  const { b, unmount } = await mountApp('/notifications', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Aviso 4/.test(text()), 'lista de todos los avisos')

  await click(byText('button', 'Sin leer'), 'el filtro Sin leer')
  await waitFor(() => new URLSearchParams(search()).get('filter') === 'unread', 'filtro en la URL')
  await waitFor(() => !/Aviso 4/.test(text()), 'el aviso leído desaparece en Sin leer')
  assert.ok(b.calls.includes('GET /notifications?unread=true'))

  await click(byText('button', /Marcar como leído/), 'el botón Marcar como leído')
  await waitFor(() => b.calls.some((c) => /^PATCH \/notifications\/\d+\/read$/.test(c)), 'PATCH de leído')
  await waitFor(() => !!document.querySelector('a[href="/notifications"][aria-label*="2"]'), 'contador baja a 2')
  await waitFor(() => /marcado como leído/.test(text()), 'toast de confirmación')
})

test('Perfil: consulta el documento vigente de la cuenta sin pedir otra aceptación', async (t) => {
  const { b, unmount } = await mountApp('/profile', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!byText('button', /^Leer los términos/), 'enlace a los términos en el perfil')
  const trigger = byText('button', /^Leer los términos/)
  await click(trigger, 'Leer los términos desde el perfil')
  await waitFor(() => /Versión 1\.0/.test(document.querySelector('dialog[open]')?.textContent ?? ''), 'documento disponible en el perfil')
  assert.equal(document.querySelector('input[type="checkbox"]'), null)
  assert.equal(b.db.registers.length, 0)
})

test('Perfil: editar el nombre lo guarda y actualiza el header', async (t) => {
  const { b, unmount } = await mountApp('/profile', { loggedIn: true })
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
  assert.deepEqual(getNotificationLink({ type: 'INVITATION', careSubjectId: 3 }, ready), { to: '/invitations/7', label: 'Ver invitación' })
  assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 2 }, ready), null, 'invitación ya aceptada')
  assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 4 }, ready), null, 'invitación revocada')
  assert.deepEqual(getNotificationLink({ type: 'CAREGIVER_JOINED', careSubjectId: 2 }, ready), { to: '/people/2?tab=caregivers', label: 'Ver cuidadores' })
  assert.deepEqual(getNotificationLink({ type: 'CAREGIVER_JOINED', careSubjectId: 2 }, { status: 'error', bySubject: new Map() }), { to: '/people/2?tab=caregivers', label: 'Ver cuidadores' }, 'no depende de la lista de pendientes')
  assert.deepEqual(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: 1 }, ready), { to: '/people/1', label: 'Ver persona' })
  assert.deepEqual(getNotificationLink({ type: 'APPOINTMENT_REMINDER', careSubjectId: 1 }, ready), { to: '/people/1?tab=appointments', label: 'Ver consultas' })
  assert.equal(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: null }, ready), null)
  for (const status of ['loading', 'error'] as const) {
    const unknown = { status, bySubject: new Map<number, number>() }
    assert.equal(getNotificationLink({ type: 'INVITATION', careSubjectId: 3 }, unknown), null, `sin saber si está pendiente (${status}) no enlaza`)
    assert.deepEqual(getNotificationLink({ type: 'ENTRY_CHANGED', careSubjectId: 1 }, unknown), { to: '/people/1', label: 'Ver persona' })
  }
})

test('Avisos: enlaza la invitación pendiente y el nuevo cuidador, y omite enlaces de invitaciones anteriores', async (t) => {
  const { unmount } = await mountApp('/notifications', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => !!document.querySelector('a[href="/invitations/7"]'), 'enlace Ver invitación')
  const invitation = document.querySelector('a[href="/invitations/7"]')!
  assert.equal(invitation.textContent?.trim(), 'Ver invitación')
  assert.equal(document.querySelector('a[href="/people/3"]'), null, 'no enlaza a la persona con la invitación pendiente (403)')
  assert.equal(document.querySelector('a[href="/people/2?tab=caregivers"]')?.textContent?.trim(), 'Ver cuidadores')
  const joined = byText('h2', /^Nuevo cuidador para Pedro$/)?.closest('article')
  assert.ok(joined)
  assert.ok([...joined.querySelectorAll('span')].some((span) => span.textContent?.trim() === 'Nuevo cuidador'))
  for (const name of ['Pedro', 'Elena']) {
    const oldInvitation = byText('h2', new RegExp(`^Invitación anterior para ${name}$`))?.closest('article')
    assert.ok(oldInvitation, `aviso de invitación anterior para ${name}`)
    assert.equal(oldInvitation.querySelector('a')?.getAttribute('href') ?? null, null)
  }

  await click(invitation, 'Ver invitación')
  await waitFor(() => pathname() === '/invitations/7' && /Lucía/.test(text()), 'abrir la invitación')
})

test('Perfil: la fecha de nacimiento muestra la edad y el avatar automático sigue la edad y el género', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 1, 10, 12) })
  const { b, unmount } = await mountApp('/profile', { loggedIn: true })
  let unmountCurrent = unmount
  t.after(() => unmountCurrent())
  const reopenProfile = async (profile = b.db.me) => {
    await unmountCurrent()
    unmountCurrent = async () => {}
    const reloaded = await mountApp('/profile', { loggedIn: true, seed: (db) => { db.me = profile } })
    unmountCurrent = reloaded.unmount
    await waitFor(() => reloaded.b.calls.includes('GET /users/me'), 'GET del perfil recargado')
    return reloaded.b
  }
  await waitFor(() => /Agrega tu fecha de nacimiento/.test(text()), 'sin edad todavía')
  // Nació el 5 de enero de hace 70 años: el calendario propio se abre y se elige año, mes y día
  const year = new Date().getFullYear() - 70
  const iso = `${year}-01-05`
  await click(document.getElementById('profile-birthDate'), 'calendario de la fecha de nacimiento')
  for (const [name, value] of [['Año', String(year)], ['Mes', '0']]) {
    const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!
    await act(async () => { select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
  }
  await click(document.querySelector(`button[aria-label="5 de enero de ${year}"]`), 'el día 5')
  await click(document.querySelector('form input[value="FEMALE"]'), 'Mujer')
  await click(document.querySelector('form button[type="submit"]'), 'Guardar')
  await waitFor(() => (b.db.me as { birthDate?: string }).birthDate === iso, 'PATCH con la fecha')
  const reopenedBackend = await reopenProfile()
  await waitFor(() => /70 años/.test(text()), 'edad en el perfil recargado')
  await click(document.querySelector('button[aria-label="Cambiar avatar"]'), 'Cambiar avatar')
  const automaticImage = () => byText('button[role="radio"]', /^Automático/)?.querySelector('img')?.getAttribute('src')
  await waitFor(() => automaticImage() === '/lions/elder-lioness-face.png', 'automático: leona abuela')
  await click(document.querySelector('dialog[open] button[aria-label="Cerrar"]'), 'Cerrar selector')

  await click(document.getElementById('profile-birthDate'), 'calendario de la fecha de nacimiento')
  await click(byText('button', 'Borrar fecha'), 'Borrar fecha')
  await click(document.querySelector('form button[type="submit"]'), 'Guardar sin fecha')
  await waitFor(() => (reopenedBackend.db.me as { birthDate?: string | null }).birthDate === null, 'PATCH con fecha nula')
  await waitFor(() => /Agrega tu fecha de nacimiento/.test(text()), 'perfil sin edad')

  await reopenProfile(reopenedBackend.db.me)
  await waitFor(() => /Agrega tu fecha de nacimiento/.test(text()), 'perfil recargado sin edad')
  await click(document.querySelector('button[aria-label="Cambiar avatar"]'), 'Cambiar avatar')
  await waitFor(() => automaticImage() === '/lions/adult-lioness-face.png', 'automático: leona sin edad')
})

test('Perfil: Notas de voz muestra audios sin mezclar documentos y conserva los filtros al navegar', async (t) => {
  const { b, unmount } = await mountApp('/people/1?tab=voice-notes&category=MEDICATION&page=2', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /nota\.m4a/.test(text()), 'listar la nota de voz de la persona')
  assert.doesNotMatch(text(), /examen\.png/)
  assert.ok(b.calls.includes('GET /care-subjects/1/attachments'))
  assert.equal(document.querySelector('a[aria-current="page"][href*="tab=voice-notes"]')?.textContent, 'Notas de voz')
  await click(byText('a', 'Documentos'), 'pestaña Documentos')
  await waitFor(() => /examen\.png/.test(text()), 'listar documentos al cambiar de sección')
  assert.doesNotMatch(text(), /nota\.m4a/)
  assert.match(search(), /category=MEDICATION/)
  assert.match(search(), /page=2/)
})

test('Perfil: Resúmenes carga el historial privado y mantiene acceso a crear un resumen', async (t) => {
  const { b, unmount } = await mountApp('/people/1?tab=handoffs', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Resumen de control anual/.test(text()), 'mostrar el resumen de la persona')
  assert.ok(b.calls.includes('GET /care-subjects/1/handoffs'))
  assert.ok(document.querySelector('a[href="/people/1/handoff/new"]'))
  assert.equal(document.querySelector('a[aria-current="page"][href*="tab=handoffs"]')?.textContent, 'Resúmenes')
  assert.equal(document.querySelector('a[href^="/handoff/"]'), null, 'no fabricar un enlace público desde el ID')
})

test('Perfil: el principal elimina a una persona tras confirmar y vuelve a la lista', async (t) => {
  const { b, unmount } = await mountApp('/people/2', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Pedro/.test(text()) && Boolean(byText('button', 'Eliminar persona')), 'mostrar el detalle de Pedro')
  await click(byText('button', 'Eliminar persona'), 'abrir la confirmación')
  const dialog = document.querySelector('dialog[open]')
  assert.ok(dialog, 'pide confirmar antes de eliminar')
  await click([...dialog.querySelectorAll('button')].find((el) => el.textContent === 'Eliminar persona') ?? null, 'confirmar')
  await waitFor(() => pathname() === '/people', 'volver a la lista de personas')
  assert.ok(b.calls.includes('DELETE /care-subjects/2'))
  await waitFor(() => /Se eliminó a Pedro/.test(text()), 'confirmar el borrado con un aviso')
})

test('tras perder acceso, Inicio y Personas consultan el directorio vigente y el aviso anterior protege su contenido', async (t) => {
  const { b, unmount } = await mountApp('/people/1?tab=appointments', { loggedIn: true, seed: (db) => {
    db.notifications.unshift({ id: 30, type: 'APPOINTMENT_REMINDER', title: 'Recordatorio anterior de prueba',
      body: 'Aviso de una consulta ya notificada.', careSubjectId: 1, read: true,
      readAt: '2026-11-08T00:00:00Z', createdAt: '2026-11-07T00:00:00Z' })
  } })
  t.after(unmount)
  await waitFor(() => /Control con cardiología/.test(text()), 'consulta de Rosa cargada')

  b.db.subjects = b.db.subjects.filter(({ id }) => id !== 1)
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  await waitFor(() => !!byText('a', 'Volver al inicio'), 'ficha retirada al recuperar el foco')
  assert.doesNotMatch(text(), /Rosa|Control con cardiología/)
  const oldConsultationReads = b.calls.filter((call) => call === 'GET /care-subjects/1/consultations').length

  await click(byText('a', 'Volver al inicio'), 'volver al inicio')
  await waitFor(() => pathname() === '/' && /Control con urología/.test(text()), 'Inicio muestra la próxima cita vigente')
  assert.doesNotMatch(text(), /Rosa|Control con cardiología/)

  await click(document.querySelector('a[href="/people"]'), 'ir a Personas')
  await waitFor(() => pathname() === '/people' && /Pedro/.test(text()), 'directorio vigente de personas')
  assert.doesNotMatch(text(), /Rosa/)

  await click(document.querySelector('a[href="/notifications"]'), 'ir a Avisos')
  await waitFor(() => pathname() === '/notifications' && !!byText('h2', 'Aviso de salud'), 'aviso histórico protegido')
  assert.doesNotMatch(text(), /Recordatorio anterior de prueba|Aviso de una consulta ya notificada/)
  assert.equal(document.querySelector('a[href="/people/1?tab=appointments"]'), null)
  assert.ok(byText('a', 'Ver invitación'))
  assert.equal(b.calls.filter((call) => call === 'GET /care-subjects/1/consultations').length, oldConsultationReads)
})

test('Inicio abierto retira las próximas citas de la persona que ya no está en el directorio al volver al foco', async (t) => {
  const { b, unmount } = await mountApp('/', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Control con cardiología/.test(text()), 'citas de ambas personas')
  assert.match(text(), /Control con urología/)
  b.db.subjects = b.db.subjects.filter(({ id }) => id !== 1)
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  await waitFor(() => /Control con urología/.test(text()) && !/Control con cardiología/.test(text()), 'citas vigentes al volver al foco')
  assert.doesNotMatch(text(), /Rosa/)
  assert.equal(b.calls.filter((call) => call === 'GET /care-subjects').length, 2)
})

test('Personas retira solo la tarjeta revocada al recuperar la conexión', async (t) => {
  const { b, unmount } = await mountApp('/people', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /Rosa/.test(text()) && /Pedro/.test(text()), 'tarjetas inicialmente accesibles')
  b.db.subjects = b.db.subjects.filter(({ id }) => id !== 1)
  await act(async () => window.dispatchEvent(new window.Event('online')))
  await waitFor(() => /Pedro/.test(text()) && !/Rosa/.test(text()), 'se actualizó el directorio al reconectar')
  assert.equal(b.calls.filter((call) => call === 'GET /care-subjects').length, 2)
})

test('una lista tardía no recupera la tarjeta de una persona cuyo acceso se retiró', async (t) => {
  const { b, unmount } = await mountApp('/people', { loggedIn: true })
  t.after(async () => { http.api.defaults.adapter = b.adapter; await unmount() })
  await waitFor(() => /Rosa/.test(text()) && /Pedro/.test(text()), 'tarjetas inicialmente accesibles')
  let release!: () => void
  let markStarted!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const started = new Promise<void>((resolve) => { markStarted = resolve })
  http.api.defaults.adapter = async (config) => {
    if (config.url === '/care-subjects/1/consultations') {
      throw Object.assign(new Error('Acceso retirado'), { isAxiosError: true, config,
        response: { status: 403, data: { message: 'Acceso retirado' }, headers: {}, config } })
    }
    const result = await b.adapter(config)
    if (config.url === '/care-subjects') {
      markStarted()
      await pending
    }
    return result
  }

  await act(async () => window.dispatchEvent(new window.Event('focus')))
  await started
  b.db.subjects = b.db.subjects.filter(({ id }) => id !== 1)
  await act(async () => {
    await assert.rejects(http.api.get('/care-subjects/1/consultations'), /Acceso retirado/)
  })
  assert.match(text(), /Pedro/)
  assert.doesNotMatch(text(), /Rosa/)
  await act(async () => release())
  assert.match(text(), /Pedro/)
  assert.doesNotMatch(text(), /Rosa/)
})

test('Avisos oculta el texto ya cargado de la persona revocada cuando vuelve a estar visible', async (t) => {
  const { b, unmount } = await mountApp('/notifications', { loggedIn: true, seed: (db) => {
    db.notifications[0] = { ...db.notifications[0], title: 'Resultado clínico anterior', body: 'Detalle de prueba del resultado' }
  } })
  t.after(unmount)
  await waitFor(() => /Resultado clínico anterior/.test(text()) && !!byText('a', 'Ver invitación'), 'aviso clínico accesible e invitación pendiente')
  assert.match(text(), /Detalle de prueba del resultado/)
  b.db.subjects = b.db.subjects.filter(({ id }) => id !== 1)
  await act(async () => document.dispatchEvent(new window.Event('visibilitychange')))
  await waitFor(() => !!byText('h2', 'Aviso de salud'), 'el aviso se protege al actualizar el directorio')
  assert.doesNotMatch(text(), /Resultado clínico anterior|Detalle de prueba del resultado/)
  assert.equal(document.querySelector('a[href="/people/1"]'), null)
  assert.ok(byText('a', 'Ver invitación'))
})

test('Perfil: una persona inexistente muestra "no encontrada" sin botón de reintentar', async (t) => {
  const { unmount } = await mountApp('/people/999', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /No encontramos lo que buscas/.test(text()), 'mostrar el 404')
  assert.equal(byText('button', 'Reintentar'), null)
  assert.ok(byText('a', 'Volver al inicio'))
})

const scopedDocuments = (db: Db) => {
  db.attachments.push(
    { ...attachmentBase, id: 33, originalFilename: 'receta.png', contentType: 'image/png', ocrStatus: 'DONE', ocrText: 'Rp. Amoxicilina 500 mg', scopeLabel: 'MEDICAL', scopeScore: 0.61 } as never,
    { ...attachmentBase, id: 34, originalFilename: 'apuntes.png', contentType: 'image/png', ocrStatus: 'DONE', ocrText: 'Tarea de programación', scopeLabel: 'NONMEDICAL', scopeScore: 0.41 } as never,
    { ...attachmentBase, id: 35, originalFilename: 'borroso.png', contentType: 'image/png', ocrStatus: 'DONE', ocrText: 'xx yy zz', scopeLabel: 'REVIEW', scopeScore: null } as never,
  )
}
const SCOPE_TEXTS = /Uso adecuado|No seguro|Posible uso ajeno/

test('Documentos: sin clasificación del backend no aparece ninguna etiqueta de uso', async (t) => {
  const { unmount } = await mountApp('/people/1?tab=documents', { loggedIn: true })
  t.after(unmount)
  await waitFor(() => /examen\.png/.test(text()), 'lista de documentos')
  assert.doesNotMatch(text(), SCOPE_TEXTS)
})

test('Documentos: muestra la etiqueta de uso de cada documento clasificado', async (t) => {
  const { unmount } = await mountApp('/people/1?tab=documents', { loggedIn: true, seed: scopedDocuments })
  t.after(unmount)
  await waitFor(() => /borroso\.png/.test(text()), 'lista de documentos')
  const row = (name: string) => [...document.querySelectorAll('li, article, tr')].find((el) => el.textContent?.includes(name))?.textContent ?? ''
  assert.match(row('receta.png'), /Uso adecuado/)
  assert.match(row('apuntes.png'), /Posible uso ajeno/)
  assert.match(row('borroso.png'), /No seguro/)
  assert.doesNotMatch(row('examen.png'), SCOPE_TEXTS, 'un documento sin clasificar no lleva etiqueta')
})

test('Documentos: la revisión muestra la etiqueta con su explicación', async (t) => {
  const { unmount } = await mountApp('/people/1/documents/34', { loggedIn: true, seed: scopedDocuments })
  t.after(unmount)
  await waitFor(() => /Posible uso ajeno/.test(text()), 'etiqueta en la revisión')
  assert.match(text(), /El texto no parece de un documento de salud\. Si es un error, avisa al equipo\./)
})

test('Perfil: el resumen de uso de documentos aparece solo con el clasificador encendido', async (t) => {
  const on = await mountApp('/profile', {
    loggedIn: true,
    seed: (db) => {
      db.scope = { enabled: true, appropriate: 3, unsure: 1, strikes: 2 }
    },
  })
  await waitFor(() => /Uso de documentos/.test(text()), 'tarjeta de uso de documentos')
  const card = document.querySelector('[aria-labelledby="document-scope"]')!
  assert.match(card.textContent ?? '', /Adecuados\s*3/)
  assert.match(card.textContent ?? '', /No seguros\s*1/)
  assert.match(card.textContent ?? '', /Posibles usos ajenos\s*2/)
  assert.match(card.textContent ?? '', /No afecta tu cuenta/)
  await on.unmount()

  const off = await mountApp('/profile', {
    loggedIn: true,
    seed: (db) => {
      db.scope = { enabled: false, appropriate: 0, unsure: 0, strikes: 0 }
    },
  })
  await waitFor(() => /ana@demo\.yuyay/.test(text()), 'datos del perfil')
  await waitFor(() => off.b.calls.some((c) => c.includes('/users/me/document-scope')), 'consulta del resumen')
  assert.doesNotMatch(text(), /Uso de documentos/)
  await off.unmount()

  const old = await mountApp('/profile', { loggedIn: true })
  t.after(old.unmount)
  await waitFor(() => /ana@demo\.yuyay/.test(text()), 'datos del perfil')
  await waitFor(() => old.b.calls.some((c) => c.includes('/users/me/document-scope')), 'consulta del resumen')
  assert.doesNotMatch(text(), /Uso de documentos/, 'un backend sin el clasificador (404) no muestra nada ni rompe la página')
  assert.doesNotMatch(text(), /No se encontró lo que buscas/)
})
