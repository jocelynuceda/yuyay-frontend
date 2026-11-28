import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })
import assert from 'node:assert/strict'
import test, { afterEach, type TestContext } from 'node:test'
import { act } from 'react'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
const { createRoot } = await import('react-dom/client')
const { CareSubjectForm } = await import('../src/pages/forms/CareSubjectForm')
const { api, clearTokens } = await import('../src/services/http')
const original = api.defaults.adapter
afterEach(() => { api.defaults.adapter = original; clearTokens() })
const account = { id: 301, name: 'Alias ficticio', birthDate: '1990-01-01', gender: null }
const subject = { id: 41, name: account.name, birthDate: account.birthDate, notes: null, createdAt: '2026-01-01T00:00:00Z', myRole: 'PRINCIPAL' }
const policy = { textVersion: '1', thirdPartyQuestion: '¿Cómo se autoriza?', options: [
  { type: 'SELF', label: 'Mi propio perfil', description: 'Datos propios', scope: 'OWN_DATA', confirmationText: 'Confirmo que es mi perfil.' },
  { type: 'FICTITIOUS', label: 'Perfil ficticio', description: 'Ejemplo', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Confirmo que es ficticio.' },
] }
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
async function until(check: () => boolean) {
  for (let i = 0; i < 200 && !check(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)) })
  assert.ok(check())
}
async function mount(t: TestContext) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<CareSubjectForm account={account} onSaved={() => {}} />))
  return { container, root }
}
const self = (node: ParentNode) => node.querySelector<HTMLInputElement>('input[type=radio][value=SELF]')
const fictitious = (node: ParentNode) => node.querySelector<HTMLInputElement>('input[type=radio][value=FICTITIOUS]')
const submit = (node: ParentNode) => node.querySelector<HTMLButtonElement>('button[type=submit]')!
const confirm = (node: ParentNode) => node.querySelector<HTMLInputElement>('input[type=checkbox]')!
async function click(node: HTMLElement) { assert.ok(node); await act(async () => node.click()) }
const scenarios = [
  { label: 'cuenta nueva con perfil propio', rows: [{ ...subject, ownProfile: true }], visible: false },
  { label: 'cuenta antigua sin perfil propio', rows: [], visible: true },
  { label: 'cuenta antigua con titularidad', rows: [{ ...subject, ownProfile: true }], visible: false },
  { label: 'varios familiares PRINCIPAL', rows: [{ ...subject, ownProfile: false }, { ...subject, id: 42, ownProfile: false }], visible: true },
  { label: 'perfil propio entre familiares', rows: [{ ...subject, ownProfile: false }, { ...subject, id: 42, ownProfile: true }], visible: false },
  { label: 'servidor anterior sin indicador de titularidad', rows: [subject], visible: false },
]
for (const scenario of scenarios) test('Web: ' + scenario.label, async (t) => {
  api.defaults.adapter = async config => ok(config, config.url === '/care-subjects' ? scenario.rows : policy)
  const { container } = await mount(t)
  await until(() => !!fictitious(container) && !container.textContent?.includes('Comprobando si'))
  assert.equal(!!self(container), scenario.visible)
  assert.equal(fictitious(container)!.disabled, false)
})
test('carga y error no ofrecen SELF; una respuesta confirmada lo habilita y una entrega posterior lo retira', async (t) => {
  let phase = 0
  let fail!: () => void
  api.defaults.adapter = async config => {
    if (config.url !== '/care-subjects') return ok(config, policy)
    if (phase === 0) return new Promise((_resolve, reject) => {
      fail = () => reject(new AxiosError('Técnico', 'ERR_BAD_RESPONSE', config, undefined, { ...ok(config, {}), status: 500 }))
    })
    return ok(config, phase === 1 ? [] : [{ ...subject, ownProfile: true }])
  }
  const { container } = await mount(t)
  await until(() => !!fictitious(container) && !!fail)
  assert.equal(self(container), null)
  await act(async () => fail())
  await until(() => !!container.textContent?.includes('No pudimos comprobar tu perfil propio'))
  assert.equal(self(container), null)
  phase = 1
  const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Volver a comprobar mi perfil')!
  await click(retry)
  await until(() => !!self(container))
  await click(self(container)!)
  await click(confirm(container))
  assert.equal(submit(container).disabled, false)
  phase = 2
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  await until(() => !self(container))
  assert.equal(submit(container).disabled, true)
})
test('cambiar de cuenta descarta la titularidad anterior mientras se verifica la siguiente', async (t) => {
  let phase = 0
  let resolve!: (value: ReturnType<typeof ok>) => void
  let config!: InternalAxiosRequestConfig
  api.defaults.adapter = async next => {
    if (next.url !== '/care-subjects') return ok(next, policy)
    if (phase === 0) return ok(next, [])
    config = next
    return new Promise(yes => { resolve = yes })
  }
  const { container, root } = await mount(t)
  await until(() => !!self(container))
  phase = 1
  await act(async () => root.render(<CareSubjectForm key={302} account={{ ...account, id: 302 }} onSaved={() => {}} />))
  assert.equal(self(container), null)
  await until(() => !!resolve)
  await act(async () => resolve(ok(config, [{ ...subject, ownProfile: true }])))
  await until(() => !container.textContent?.includes('Comprobando si'))
  assert.equal(self(container), null)
})
test('crear SELF actualiza el estado y permite seguir agregando familiares', async (t) => {
  const writes: { declaration: { type: string } }[] = []
  api.defaults.adapter = async config => {
    if (config.url !== '/care-subjects') return ok(config, policy)
    if (config.method === 'get') return ok(config, writes.length ? [{ ...subject, ownProfile: true }] : [])
    writes.push(JSON.parse(config.data))
    return ok(config, { ...subject, id: 40 + writes.length, ownProfile: writes.length === 1 })
  }
  const { container } = await mount(t)
  await until(() => !!self(container))
  await click(self(container)!)
  await click(confirm(container))
  await click(submit(container))
  await until(() => !self(container))
  await click(fictitious(container)!)
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('#subject-name')!
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input, 'Familiar ficticio')
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(confirm(container))
  await click(submit(container))
  assert.deepEqual(writes.map(write => write.declaration.type), ['SELF', 'FICTITIOUS'])
})
test('409 conserva su mensaje y vuelve a comprobar el perfil sin repetir el POST', async (t) => {
  let writes = 0
  api.defaults.adapter = async config => {
    if (config.url !== '/care-subjects') return ok(config, policy)
    if (config.method === 'get') return ok(config, writes ? [{ ...subject, ownProfile: true }] : [])
    writes++
    throw new AxiosError('Técnico', 'ERR_BAD_REQUEST', config, undefined,
      { ...ok(config, { message: 'Ya tienes un perfil propio. Abre ese perfil para actualizar tus datos.' }), status: 409 })
  }
  const { container } = await mount(t)
  await until(() => !!self(container))
  await click(self(container)!)
  await click(confirm(container))
  await click(submit(container))
  await until(() => !!container.textContent?.includes('Ya tienes un perfil propio'))
  assert.equal(self(container), null)
  assert.equal(writes, 1)
})
