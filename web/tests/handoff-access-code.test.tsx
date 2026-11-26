import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', pretendToBeVisual: true })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { act, type ReactNode } from 'react'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
const { createRoot } = await import('react-dom/client')
const { MemoryRouter, Route, Routes, useLocation } = await import('react-router-dom')
const { HandoffAccessCode } = await import('../src/components/security/HandoffAccessCode')
const { CreateHandoffLink } = await import('../src/pages/handoff/HandoffLinkStep')
const { HandoffPublicPage } = await import('../src/pages/public/HandoffPublicPage')
const { HandoffsPanel } = await import('../src/pages/care/HandoffsPanel')
const { HandoffWorkspacePage } = await import('../src/pages/handoff/HandoffWorkspacePage')
const { default: HandoffWorkspaceRoute } = await import('../src/pages/handoff/HandoffWorkspaceRoute')
const { AuthContext } = await import('../src/contexts/auth-context')
const { ToastProvider } = await import('../src/contexts/ToastContext')
const { accessCodeDeadline } = await import('../src/services/security/handoffAccess')
const { api, publicApi } = await import('../src/services/http')

const serverTime = '2030-01-01T00:00:00Z'
const code = { code: '000123', consumed: false, serverTime, expiresAt: '2030-01-01T00:00:30Z', periodSeconds: 30 }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
function mockApi(t: TestContext, fn: AxiosAdapter) {
  const old = api.defaults.adapter, oldPublic = publicApi.defaults.adapter
  api.defaults.adapter = fn; publicApi.defaults.adapter = fn
  t.after(() => { api.defaults.adapter = old; publicApi.defaults.adapter = oldPublic })
}
async function mount(t: TestContext, node: ReactNode, path = '/') {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  const render = async (next: ReactNode) => { await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{next}</MemoryRouter>)) }
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await render(node)
  return { container, render }
}
async function click(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)
  assert.ok(button, text)
  await act(async () => { button.click() })
}
async function follow(container: HTMLElement, text: string) {
  const link = [...container.querySelectorAll('a')].find((item) => accessibleText(item) === text)
  assert.ok(link, text)
  await act(async () => { link.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) })
}
function accessibleText(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove())
  return copy.textContent?.trim()
}
function LocationMarker() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function WorkspaceRoutes() {
  return <AuthContext.Provider value={{ user: { id: 8, name: 'Cuidador de prueba', email: 'cuidador@example.invalid', role: 'USER', createdAt: serverTime },
    isAuthenticated: true, isLoading: false, restoreError: null, retryRestore: async () => {},
    login: async () => true, register: async () => true, loginWithGoogle: async () => true, logout: async () => {}, updateUser: () => {} }}>
    <ToastProvider><LocationMarker /><Routes>
      <Route path="/people/:id" element={<HandoffsPanel subjectId={4} isPrincipal={false} userId={8} />} />
      <Route path="/people/:id/handoffs/:handoffId" element={<HandoffWorkspaceRoute />} />
      <Route path="/people/:id/handoffs/:handoffId/share" element={<HandoffWorkspaceRoute mode="share" />} />
      <Route path="/people/:id/handoffs/:handoffId/sessions/:sessionId" element={<HandoffWorkspaceRoute mode="code" />} />
    </Routes></ToastProvider>
  </AuthContext.Provider>
}
async function fill(container: HTMLElement, selector: string, text: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, text)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
function fakeClock(t: TestContext) {
  let now = 1000
  t.mock.method(performance, 'now', () => now)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  return async (elapsed: number) => { await act(async () => { now += elapsed; t.mock.timers.tick(elapsed) }) }
}
const visibleCode = (container: HTMLElement) => container.querySelector('[aria-label^="Código de acceso:"]')

test('deadline descuenta latencia y depende del reloj del servidor, no de cambios en Date.now', (t) => {
  t.mock.method(Date, 'now', () => 9999999999999)
  assert.equal(accessCodeDeadline(code, 1000, 1400), 31000)
  assert.equal(accessCodeDeadline({ ...code, expiresAt: '2030-01-01T00:00:00.100Z' }, 1000, 1400), 1100)
})

test('muestra seis dígitos con ceros, oculta el viejo al vencer y espera respuesta nueva sin inventar código', async (t) => {
  const advance = fakeClock(t)
  let reads = 0, release: (() => void) | undefined
  mockApi(t, async (config) => {
    reads++
    if (reads === 2) await new Promise<void>((resolve) => { release = resolve })
    return ok(config, { ...code, code: reads === 1 ? '000123' : '000456' })
  })
  const { container } = await mount(t, <HandoffAccessCode sessionId={7} />)
  assert.equal(visibleCode(container)?.textContent, '000 123')
  assert.equal(visibleCode(container)?.closest('[aria-live]'), null, 'el código/contador no se anuncia cada segundo')
  await advance(29000)
  assert.equal(reads, 1)
  assert.match(container.textContent!, /1s/)
  await advance(1000)
  assert.equal(visibleCode(container), null)
  assert.match(container.textContent!, /Obteniendo código/)
  assert.equal(reads, 2)
  await act(async () => { release!() })
  assert.equal(visibleCode(container)?.textContent, '000 456')
})

test('código consumido se oculta y se consulta el siguiente al terminar el período', async (t) => {
  const advance = fakeClock(t)
  let reads = 0
  mockApi(t, async (config) => ok(config, ++reads === 1 ? { ...code, consumed: true, code: null } : code))
  const { container } = await mount(t, <HandoffAccessCode sessionId={7} />)
  assert.match(container.textContent!, /Código utilizado/)
  assert.equal(visibleCode(container), null)
  await advance(30000)
  assert.equal(visibleCode(container)?.textContent, '000 123')
})

test('offline y pestaña oculta borran el código, abortan solicitudes y descartan respuestas obsoletas', async (t) => {
  fakeClock(t)
  let online = true, hidden = false, reads = 0, release: (() => void) | undefined
  t.mock.getter(window.navigator, 'onLine', () => online)
  t.mock.getter(document, 'visibilityState', () => hidden ? 'hidden' : 'visible')
  let staleSignal: AbortSignal | undefined
  mockApi(t, async (config) => {
    reads++
    if (reads === 2) {
      staleSignal = config.signal as AbortSignal
      await new Promise<void>((resolve) => { release = resolve })
    }
    return ok(config, code)
  })
  const { container, render } = await mount(t, <HandoffAccessCode sessionId={7} />)
  assert.ok(visibleCode(container))
  await act(async () => { online = false; window.dispatchEvent(new window.Event('offline')) })
  assert.equal(visibleCode(container), null)
  assert.equal(reads, 1)
  await act(async () => { online = true; window.dispatchEvent(new window.Event('online')) })
  assert.equal(reads, 2)
  await act(async () => { hidden = true; document.dispatchEvent(new window.Event('visibilitychange')) })
  assert.equal(staleSignal?.aborted, true)
  await act(async () => { release!() })
  assert.equal(visibleCode(container), null)
  await act(async () => { hidden = false; document.dispatchEvent(new window.Event('visibilitychange')) })
  assert.equal(reads, 3)
  assert.ok(visibleCode(container))
  await render(<HandoffAccessCode sessionId={8} />)
  assert.equal(reads, 4)
})

test('revocación al renovar elimina el código y ofrece reintento sin continuar el polling', async (t) => {
  const advance = fakeClock(t)
  let reads = 0
  mockApi(t, async (config) => {
    if (++reads === 1) return ok(config, code)
    throw new AxiosError('Revocado', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, {}), status: 410 })
  })
  const { container } = await mount(t, <HandoffAccessCode sessionId={7} />)
  await advance(30000)
  assert.equal(visibleCode(container), null)
  assert.match(container.querySelector('[role=alert]')!.textContent!, /ya no está disponible/)
  await advance(90000)
  assert.equal(reads, 2)
  await click(container, 'Solicitar nuevo código')
  assert.equal(reads, 3)
})

test('un servidor antiguo no puede presentar un nuevo enlace como protegido', async (t) => {
  const methods: string[] = []
  mockApi(t, async (config) => {
    methods.push(config.method!)
    if (config.method === 'post') {
      assert.equal(JSON.parse(config.data).requireAccessCode, true)
      return ok(config, { id: 7, token: 'NO-COMPARTIR', expiresAt: serverTime, sessionWindowMinutes: 30, createdAt: serverTime })
    }
    assert.equal(config.url, '/handoff-sessions/7')
    return ok(config, {})
  })
  const { container } = await mount(t, <CreateHandoffLink handoffId={2} />)
  await click(container, 'Generar enlace y código')
  assert.deepEqual(methods, ['post', 'delete'])
  assert.match(container.textContent!, /todavía no permite crear enlaces protegidos/)
  assert.doesNotMatch(container.textContent!, /Enlace listo|NO-COMPARTIR/)
  assert.equal(container.querySelector('input[aria-label="Enlace para el médico"]'), null)
})

test('nuevo enlace protegido muestra el panel, pero copiar comparte sólo el enlace', async (t) => {
  fakeClock(t)
  let copied = ''
  Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text } } })
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
  t.after(() => { if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator) })
  mockApi(t, async (config) => {
    if (config.method === 'post') return ok(config, { id: 7, token: 'enlace-seguro', accessCodeRequired: true, expiresAt: serverTime, sessionWindowMinutes: 30, createdAt: serverTime })
    assert.equal(config.url, '/handoff-sessions/7/access-code')
    return ok(config, code)
  })
  const { container } = await mount(t, <CreateHandoffLink handoffId={2} />)
  await click(container, 'Generar enlace y código')
  assert.equal(visibleCode(container)?.textContent, '000 123')
  await click(container, 'Copiar enlace')
  assert.ok(copied.endsWith('/handoff/enlace-seguro'))
  assert.doesNotMatch(copied, /000123|000 123/)
})

const view = { handoffId: 2, careSubjectName: 'Paciente de prueba', reason: 'Control', questions: null,
  createdAt: serverTime, items: [{ healthEntryVersionId: 19, categoryCode: 'ALLERGY', title: 'Registro', details: 'Texto privado',
    confidenceLevel: 'CONFIRMED', declaredAt: serverTime, hasSourceAttachment: true }] }
async function identify(container: HTMLElement, accessCode = '') {
  await fill(container, '#visitorName', 'Médico de prueba')
  await fill(container, '#visitorRole', 'Médico')
  if (accessCode) await fill(container, '#accessCode', accessCode)
  await click(container, 'Ver resumen')
}

test('código inválido no abre; grant queda sólo en memoria y header, lectura no vence al rotar el código', async (t) => {
  const advance = fakeClock(t)
  let attempts = 0, sourceHeader: unknown
  const originalOpen = window.open, originalCreate = URL.createObjectURL
  window.open = (() => ({ opener: window, location: { href: '' }, close() {} })) as any
  URL.createObjectURL = () => 'blob:original'
  t.after(() => { window.open = originalOpen; URL.createObjectURL = originalCreate })
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: true })
    if (config.method === 'post') {
      attempts++
      const body = JSON.parse(config.data)
      if (attempts === 1) {
        assert.equal(body.accessCode, '123456')
        throw new AxiosError('Inválido', 'ERR_BAD_REQUEST', config, undefined, {
          ...ok(config, { message: 'El código no es válido. Solicita el código actual.' }), status: 403,
        })
      }
      assert.equal(body.accessCode, '000123')
      return ok(config, { ...view, serverTime, accessGrant: 'grant-solo-memoria', accessExpiresAt: '2030-01-01T00:02:00Z' })
    }
    sourceHeader = config.headers.get('X-Handoff-Access')
    assert.doesNotMatch(config.url!, /grant-solo-memoria|000123/)
    return ok(config, new Blob(['original']))
  })
  const { container } = await mount(t, <HandoffPublicPage token="seguro" />)
  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
  assert.equal(submit.disabled, true)
  await fill(container, '#accessCode', '12345')
  assert.equal(submit.disabled, true)
  assert.equal(attempts, 0)
  await identify(container, '123456')
  assert.match(container.querySelector('[role=alert]')!.textContent!, /código no es válido/)
  assert.doesNotMatch(container.textContent!, /Texto privado/)
  await fill(container, '#accessCode', '000123')
  await click(container, 'Ver resumen')
  await advance(30000)
  assert.match(container.textContent!, /Texto privado/)
  await click(container, 'Ver documento original')
  assert.equal(sourceHeader, 'grant-solo-memoria')
  assert.doesNotMatch(container.innerHTML, /grant-solo-memoria/)
  assert.equal(window.localStorage.length, 0)
  assert.equal(window.sessionStorage.length, 0)
  await advance(90000)
  assert.doesNotMatch(container.textContent!, /Texto privado/)
  assert.match(container.textContent!, /Terminó el tiempo de lectura/)
})

test('enlace legado abre sin código y su original no envía grant', async (t) => {
  fakeClock(t)
  const originalOpen = window.open, originalCreate = URL.createObjectURL
  window.open = (() => ({ opener: window, location: { href: '' }, close() {} })) as any
  URL.createObjectURL = () => 'blob:legacy'
  t.after(() => { window.open = originalOpen; URL.createObjectURL = originalCreate })
  let sourceReads = 0
  mockApi(t, async (config) => {
    if (config.url?.endsWith('/access-requirements')) return ok(config, { accessCodeRequired: false })
    if (config.method === 'post') {
      assert.equal(JSON.parse(config.data).accessCode, undefined)
      return ok(config, view)
    }
    sourceReads++
    assert.equal(config.headers.get('X-Handoff-Access'), undefined)
    return ok(config, new Blob(['legacy']))
  })
  const { container } = await mount(t, <HandoffPublicPage token="legacy" />)
  await identify(container)
  assert.match(container.textContent!, /Texto privado/)
  await click(container, 'Ver documento original')
  assert.equal(sourceReads, 1)
})


test('respuesta vencida por jitter se oculta y espera el nuevo período sin bucle rápido', async (t) => {
  const advance = fakeClock(t)
  let reads = 0
  mockApi(t, async (config) => ok(config, ++reads === 1 ? { ...code, expiresAt: serverTime } : { ...code, code: '000789' }))
  const { container } = await mount(t, <HandoffAccessCode sessionId={7} />)
  assert.equal(visibleCode(container), null)
  assert.equal(reads, 1)
  await advance(249)
  assert.equal(reads, 1)
  await advance(1)
  assert.equal(reads, 2)
  assert.equal(visibleCode(container)?.textContent, '000 789')
})

test('lista, detalle, generación y código existente son páginas separadas con Regresar y legado sin panel', async (t) => {
  fakeClock(t)
  t.mock.method(window, 'scrollTo', () => {})
  let codeReads = 0
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/4') return ok(config, { id: 4, name: 'Persona de prueba', myRole: 'CAREGIVER', birthDate: null, notes: null, createdAt: serverTime })
    if (config.url === '/care-subjects/4/handoffs') return ok(config, [{ id: 2, careSubjectId: 4, reason: 'Control de prueba', createdByUserId: 8, createdAt: serverTime }])
    if (config.url === '/handoffs/2') return ok(config, { id: 2, careSubjectId: 4, createdByUserId: 8, reason: 'Control de prueba', questions: null, createdAt: serverTime, items: [] })
    if (config.url === '/handoffs/2/sessions') return ok(config, [
      { id: 7, handoffId: 2, accessCodeRequired: true, expiresAt: '2099-01-01T00:00:00Z', firstOpenedAt: null, revokedAt: null, createdAt: serverTime, sessionWindowMinutes: 30 },
      { id: 8, handoffId: 2, accessCodeRequired: false, expiresAt: '2099-01-01T00:00:00Z', firstOpenedAt: null, revokedAt: null, createdAt: serverTime, sessionWindowMinutes: 30 },
    ])
    codeReads++
    assert.equal(config.url, '/handoff-sessions/7/access-code')
    return ok(config, code)
  })
  const { container } = await mount(t, <WorkspaceRoutes />, '/people/4?tab=handoffs')
  const path = () => container.querySelector('[data-testid="location"]')?.textContent
  assert.equal(container.querySelector('form'), null)
  await follow(container, 'Ver resumen')
  assert.equal(path(), '/people/4/handoffs/2')
  assert.match(container.textContent!, /Enlace anterior sin código/)
  assert.equal([...container.querySelectorAll('a')].filter((link) => link.textContent === 'Ver código de acceso').length, 1)
  assert.equal(codeReads, 0)
  assert.equal(container.querySelector('form'), null)
  await follow(container, 'Generar enlace y código')
  assert.equal(path(), '/people/4/handoffs/2/share')
  assert.match(container.textContent!, /Persona de prueba · Resumen para la consulta/)
  assert.ok(container.querySelector('form'))
  assert.doesNotMatch(container.textContent!, /Enlace anterior sin código/)
  await follow(container, 'Regresar al resumen')
  assert.equal(path(), '/people/4/handoffs/2')
  await follow(container, 'Ver código de acceso')
  assert.equal(path(), '/people/4/handoffs/2/sessions/7')
  assert.equal(codeReads, 1)
  assert.ok(visibleCode(container))
  assert.doesNotMatch(container.textContent!, /Enlace anterior sin código/)
  await follow(container, 'Regresar al resumen')
  assert.equal(path(), '/people/4/handoffs/2')
  assert.equal(visibleCode(container), null)
  await follow(container, 'Regresar a resúmenes')
  assert.equal(path(), '/people/4?tab=handoffs')
  assert.doesNotMatch(container.textContent!, /Enlace anterior sin código/)
  assert.equal(codeReads, 1)
})

test('la página de código verifica pertenencia, protección y vigencia antes de solicitar dígitos', async (t) => {
  const base = { id: 7, handoffId: 2, accessCodeRequired: true, expiresAt: '2099-01-01T00:00:00Z',
    firstOpenedAt: null as string | null, revokedAt: null as string | null, createdAt: serverTime, sessionWindowMinutes: 30 }
  let selected = base
  const requests: string[] = []
  mockApi(t, async (config) => {
    requests.push(config.url!)
    if (config.url === '/handoffs/2') return ok(config, { id: 2, careSubjectId: 4, createdByUserId: 8, reason: 'Control', createdAt: serverTime, questions: null, items: [] })
    assert.equal(config.url, '/handoffs/2/sessions', 'no debe pedir código para una sesión ajena, antigua o no vigente')
    return ok(config, [selected])
  })
  for (const [session, message] of [
    [{ ...base, handoffId: 99 }, /no pertenece al resumen seleccionado/],
    [{ ...base, id: 8 }, /no pertenece al resumen seleccionado/],
    [{ ...base, accessCodeRequired: false }, /no requiere código de acceso adicional/],
    [{ ...base, expiresAt: '2000-01-01T00:00:00Z' }, /ya no está disponible/],
    [{ ...base, revokedAt: serverTime }, /ya no está disponible/],
  ] as const) {
    selected = session
    const { container } = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={2} isPrincipal={false} userId={8} mode="code" sessionId={7} />)
    assert.match(container.textContent!, message)
    assert.equal(visibleCode(container), null)
  }
  assert.equal(requests.length, 10)
})

test('un rechazo del backend al consultar sesiones impide obtener el código aunque el usuario sea creador', async (t) => {
  const urls: string[] = []
  mockApi(t, async (config) => {
    urls.push(config.url!)
    if (config.url === '/handoffs/2') return ok(config, { id: 2, careSubjectId: 4, createdByUserId: 8, reason: 'Control', createdAt: serverTime, questions: null, items: [] })
    assert.equal(config.url, '/handoffs/2/sessions')
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, { message: 'La relación de cuidado ya no está activa.' }), status: 403 })
  })
  const { container } = await mount(t, <HandoffWorkspacePage subjectId={4} handoffId={2} isPrincipal={false} userId={8} mode="code" sessionId={7} />)
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /relación de cuidado ya no está activa/)
  assert.equal(visibleCode(container), null)
  assert.deepEqual(urls, ['/handoffs/2', '/handoffs/2/sessions'])
})

test('una ruta inválida conserva Regresar y no solicita datos privados', async (t) => {
  t.mock.method(window, 'scrollTo', () => {})
  let requests = 0
  mockApi(t, async () => { requests++; throw new Error('No debe consultar la API para identificadores inválidos') })
  const { container } = await mount(t, <WorkspaceRoutes />, '/people/4/handoffs/2/sessions/no-valido')
  assert.equal(requests, 0)
  assert.equal(visibleCode(container), null)
  assert.equal([...container.querySelectorAll('a')].find((link) => accessibleText(link) === 'Regresar al resumen')?.getAttribute('href'), '/people/4/handoffs/2')
})

test('el wrapper no consulta el resumen cuando la API rechaza el acceso a la persona', async (t) => {
  t.mock.method(window, 'scrollTo', () => {})
  const urls: string[] = []
  mockApi(t, async (config) => {
    urls.push(config.url!)
    assert.equal(config.url, '/care-subjects/4')
    throw new AxiosError('Forbidden', 'ERR_BAD_REQUEST', config, undefined, { ...ok(config, { message: 'Ya no tienes acceso a esta persona.' }), status: 403 })
  })
  const { container } = await mount(t, <WorkspaceRoutes />, '/people/4/handoffs/2/share')
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? '', /Ya no tienes acceso/)
  assert.equal(container.querySelector('form'), null)
  assert.equal(visibleCode(container), null)
  assert.deepEqual(urls, ['/care-subjects/4'])
  assert.ok([...container.querySelectorAll('a')].find((link) => accessibleText(link) === 'Regresar al resumen'))
})
