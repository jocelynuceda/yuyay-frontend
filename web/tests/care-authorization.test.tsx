import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { act, type ReactNode } from 'react'
import type { InternalAxiosRequestConfig } from 'axios'
import type { CareAuthorizationPolicy } from '../src/types/careAuthorization'

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})

const { createRoot } = await import('react-dom/client')
const { CareSubjectForm } = await import('../src/pages/forms/CareSubjectForm')
const { CareAuthorizationStatus } = await import('../src/pages/people/CareAuthorizationStatus')
const { api } = await import('../src/services/http')

const policy: CareAuthorizationPolicy = {
  textVersion: '1',
  thirdPartyQuestion: '¿Cómo estás autorizado para usar sus datos en Yuyay?',
  options: [
    { type: 'SELF', label: 'Perfil propio', description: 'Datos propios', scope: 'OWN_DATA', confirmationText: 'Confirmo que es mi perfil.' },
    { type: 'FICTITIOUS', label: 'Perfil ficticio', description: 'Datos inventados', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Confirmo que es ficticio.' },
    { type: 'HOLDER_PERMISSION', label: 'Esta persona me dio permiso.', description: 'Permiso del titular', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: 'Confirmo el permiso.' },
    { type: 'LEGAL_REPRESENTATION', label: 'Actúo como su representante legal.', description: 'Facultades legales', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: 'Confirmo la representación.' },
    { type: 'PENDING', label: 'Todavía no tengo autorización o no estoy seguro.', description: 'Puedes continuar cuando cuentes con la autorización correspondiente', scope: null, confirmationText: null },
  ],
}
const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({ status: 200, statusText: 'OK', data, headers: {}, config })
const fail = (status: number, message: string) => Object.assign(new Error(message), {
  isAxiosError: true, response: { status, data: { message } },
})
const radio = (value: string) => document.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!
const checkbox = () => document.querySelector<HTMLInputElement>('input[type="checkbox"]')
const name = () => document.querySelector<HTMLInputElement>('#subject-name')!
const submit = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!
const button = (label: string) => [...document.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === label)!
const account = { id: 11, name: 'Ana', birthDate: '1980-01-15', gender: 'FEMALE' as const }
const click = (element: HTMLElement | null) => act(async () => {
  assert.ok(element)
  element.click()
})

async function enterName(value: string) {
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setValue.call(name(), value)
    name().dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

async function mount(node: ReactNode) {
  const root = createRoot(document.getElementById('root')!)
  await act(async () => root.render(node))
  return () => act(async () => root.unmount())
}

test('bloquea un perfil pendiente y recupera un guardado incierto con la misma solicitud', async (t) => {
  const posts: unknown[] = []
  const savedIds: number[] = []
  api.defaults.adapter = async (config) => {
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    assert.equal(config.method, 'post')
    posts.push(JSON.parse(config.data))
    if (posts.length === 1) throw Object.assign(new Error('No llegó la respuesta'), { isAxiosError: true })
    return ok(config, { id: 51, name: 'Persona de prueba' })
  }
  t.after(await mount(<CareSubjectForm onSaved={(subject) => savedIds.push(subject.id)} />))

  assert.ok(submit().disabled)
  assert.equal(radio('SELF').checked, false)
  await enterName('Persona de prueba')
  await click(radio('THIRD_PARTY'))
  assert.equal(radio('HOLDER_PERMISSION').checked, false)
  assert.equal(radio('LEGAL_REPRESENTATION').checked, false)
  assert.equal(radio('PENDING').checked, false)
  await click(radio('HOLDER_PERMISSION'))
  await click(checkbox())
  await click(radio('PENDING'))
  assert.equal(radio('HOLDER_PERMISSION').checked, false)
  assert.equal(checkbox(), null)
  assert.ok(submit().disabled)
  await click(submit())
  assert.equal(posts.length, 0)
  assert.equal(name().value, 'Persona de prueba')
  assert.match(document.body.textContent ?? '', /Puedes continuar cuando cuentes/)

  await click(radio('LEGAL_REPRESENTATION'))
  assert.equal(checkbox()?.checked, false)
  await click(checkbox())
  await click(submit())
  assert.equal(posts.length, 1)
  const sent = posts[0] as { requestId: string }
  assert.match(sent.requestId, /^[A-Za-z0-9_-]{1,64}$/)
  assert.deepEqual(posts[0], {
    name: 'Persona de prueba', birthDate: null, gender: null, notes: null, requestId: sent.requestId,
    declaration: { type: 'LEGAL_REPRESENTATION', textVersion: '1', confirmed: true },
  })
  assert.ok(name().matches(':disabled'))
  await click(button('Comprobar guardado'))
  assert.deepEqual(posts, [sent, sent])
  assert.deepEqual(savedIds, [51])
})

test('revisa una política más reciente y conserva selección y datos después de un 409', async (t) => {
  const posts: { requestId: string; declaration: { textVersion: string } }[] = []
  let version = '1'
  api.defaults.adapter = async (config) => {
    if (config.url === '/care-subjects/authorization-policy') return ok(config, { ...policy, textVersion: version })
    posts.push(JSON.parse(config.data))
    if (posts.length === 1) {
      version = '2'
      throw fail(409, 'La declaración cambió. Vuelve a revisar el texto para continuar')
    }
    return ok(config, { id: 51, name: 'Persona de prueba' })
  }
  t.after(await mount(<CareSubjectForm onSaved={() => {}} />))
  await enterName('Persona de prueba')
  await click(radio('FICTITIOUS'))
  await click(checkbox())
  await click(submit())
  assert.equal(name().value, 'Persona de prueba')
  assert.ok(radio('FICTITIOUS').checked)
  assert.equal(checkbox()?.checked, false)
  assert.ok(submit().disabled)
  await click(checkbox())
  await click(submit())
  assert.equal(posts.length, 2)
  assert.notEqual(posts[0].requestId, posts[1].requestId)
  assert.equal(posts[1].declaration.textVersion, '2')
})

test('distingue historial vacío, error de lectura y declaración registrada', async (t) => {
  let phase = 0
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/care-subjects/88/authorization-declarations')
    phase += 1
    if (phase === 1) throw fail(400, 'No pudimos consultar')
    if (phase === 2) return ok(config, [{
      id: 100, careSubjectId: 88, declaredByUserId: 3, type: 'SELF',
      scope: 'OWN_DATA', textVersion: '1', text: 'Texto exacto registrado.', declaredAt: '2026-11-20T00:00:00Z',
    }])
    return ok(config, [])
  }
  const unmount = await mount(<CareAuthorizationStatus subjectId={88} />)
  assert.match(document.body.textContent ?? '', /No pudimos consultar/)
  assert.doesNotMatch(document.body.textContent ?? '', /Sin declaración registrada/)
  await click(button('Volver a consultar'))
  assert.match(document.body.textContent ?? '', /Declaración registrada/)
  assert.match(document.body.textContent ?? '', /sin verificar/)
  assert.match(document.body.textContent ?? '', /Texto exacto registrado/)
  await unmount()
  t.after(await mount(<CareAuthorizationStatus subjectId={88} />))
  assert.match(document.body.textContent ?? '', /Sin declaración registrada/)
})

test('la fecha elegida en el calendario se envía al crear la persona', async (t) => {
  const posts: { birthDate: string | null }[] = []
  api.defaults.adapter = async (config) => {
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    posts.push(JSON.parse(config.data))
    return ok(config, { id: 51, name: 'Persona de prueba' })
  }
  t.after(await mount(<CareSubjectForm onSaved={() => {}} />))
  await enterName('Persona de prueba')
  await click(radio('FICTITIOUS'))
  await click(checkbox())
  await click(document.querySelector<HTMLButtonElement>('#subject-birthDate')!)
  const year = document.querySelector<HTMLSelectElement>('select[aria-label="Año"]')!
  await act(async () => { year.value = '1954'; year.dispatchEvent(new window.Event('change', { bubbles: true })) })
  const day = document.querySelector<HTMLButtonElement>('button[aria-label$="de 1954"]')!
  await click(day)
  await click(submit())
  assert.match(posts[0].birthDate ?? '', /^1954-\d{2}-01$/)
})

test('retoma un borrador pendiente en la misma cuenta, sin crearlo ni confirmar el permiso', async () => {
  const posts: Record<string, unknown>[] = []
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, policy)
    posts.push(JSON.parse(config.data))
    return ok(config, { id: 51, name: 'Alex' })
  }
  const open = (id: number) => mount(<CareSubjectForm account={{ ...account, id }} onSaved={() => {}} />)
  let close = await open(11)
  await click(radio('THIRD_PARTY'))
  await click(radio('PENDING'))
  await enterName('Alex')
  await act(async () => {
    const notes = document.querySelector('textarea')!
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(notes, 'Nota de ejemplo')
    notes.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(radio('MALE'))
  await close()
  close = await open(12)
  assert.equal(name().value, '')
  assert.equal(radio('PENDING'), null)
  await close()
  close = await open(11)
  assert.ok(radio('PENDING').checked)
  assert.equal(name().value, 'Alex')
  assert.equal(document.querySelector('textarea')!.value, 'Nota de ejemplo')
  assert.ok(radio('MALE').checked)
  assert.ok(submit().disabled)
  assert.equal(posts.length, 0)
  await click(radio('HOLDER_PERMISSION'))
  assert.ok(submit().disabled)
  await click(checkbox())
  await click(submit())
  assert.equal(posts.length, 1)
  assert.equal(posts[0].birthDate, null)
  assert.equal(posts[0].notes, 'Nota de ejemplo')
  await close()
  close = await open(11)
  assert.equal(name().value, '')
  await close()
})

test('descartar desde una copia antigua conserva la edición guardada por otra pestaña', async (t) => {
  const key = 'yuyay.pendingPerson.v1.91'
  const original = { requestId: 'mismo-intento', name: 'Alex', birthDate: '', notes: '', gender: '' }
  window.localStorage.setItem(key, JSON.stringify(original))
  t.after(() => window.localStorage.removeItem(key))
  api.defaults.adapter = async (config) => {
    assert.equal(config.method, 'get')
    return ok(config, policy)
  }
  const open = () => mount(<CareSubjectForm account={{ ...account, id: 91 }} onSaved={() => {}} />)
  let close = await open()
  assert.equal(name().value, 'Alex')
  const updated = JSON.stringify({ ...original, name: 'Alex actualizado' })
  window.localStorage.setItem(key, updated)
  await click(button('Descartar borrador'))
  assert.equal(window.localStorage.getItem(key), updated)
  assert.match(document.body.textContent ?? '', /cambió en otra pestaña/)
  await enterName('Cambio desde la copia antigua')
  assert.equal(window.localStorage.getItem(key), updated)
  await close()
  close = await open()
  assert.equal(name().value, 'Alex actualizado')
  await click(button('Descartar borrador'))
  assert.equal(window.localStorage.getItem(key), null)
  await close()
})

test('confirmar el alta conserva una edición del borrador llegada mientras respondía el servidor', async (t) => {
  const key = 'yuyay.pendingPerson.v1.92'
  const draft = { requestId: 'intento-92', name: 'Alex', birthDate: '', gender: '', notes: '' }
  const updated = JSON.stringify({ ...draft, notes: 'Nota guardada en la otra pestaña' })
  window.localStorage.setItem(key, JSON.stringify(draft))
  t.after(() => window.localStorage.removeItem(key))
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, policy)
    window.localStorage.setItem(key, updated)
    return ok(config, { id: 92, name: 'Alex' })
  }
  const savedIds: number[] = []
  t.after(await mount(<CareSubjectForm account={{ ...account, id: 92 }} onSaved={p => savedIds.push(p.id)} />))
  await click(radio('HOLDER_PERMISSION'))
  await click(checkbox())
  await click(submit())
  assert.deepEqual(savedIds, [92])
  assert.equal(window.localStorage.getItem(key), updated)
})

test('el perfil propio muestra Yo y usa el nombre, la fecha y el género de la cuenta', async (t) => {
  let sent: Record<string, unknown> | undefined
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, policy)
    sent = JSON.parse(config.data)
    return ok(config, { id: 51, name: account.name })
  }
  t.after(await mount(<CareSubjectForm account={account} onSaved={() => {}} />))
  await click(radio('SELF'))
  assert.ok(name().readOnly)
  assert.equal(name().value, 'Yo · Ana')
  assert.ok(radio('FEMALE').checked)
  assert.ok(!document.querySelector('textarea')!.disabled)
  await click(checkbox())
  await click(submit())
  assert.equal(sent?.name, account.name)
  assert.equal(sent?.birthDate, account.birthDate)
  assert.equal(sent?.gender, account.gender)
})

test('un borrador reabierto conserva el identificador del alta si se perdió la respuesta', async () => {
  const attempts: string[] = []
  api.defaults.adapter = async (config) => {
    if (config.method === 'get') return ok(config, policy)
    attempts.push(JSON.parse(config.data).requestId)
    if (attempts.length === 1) throw Object.assign(new Error('Sin conexión'), { isAxiosError: true })
    return ok(config, { id: 77, name: 'Alex' })
  }
  const open = () => mount(<CareSubjectForm account={{ ...account, id: 13 }} onSaved={() => {}} />)
  let close = await open()
  await click(radio('THIRD_PARTY'))
  await click(radio('PENDING'))
  await enterName('Alex')
  await click(radio('HOLDER_PERMISSION'))
  await click(checkbox())
  await click(submit())
  assert.ok(button('Comprobar guardado'))
  await close()
  close = await open()
  assert.ok(submit().disabled)
  await click(radio('HOLDER_PERMISSION'))
  await click(checkbox())
  await click(submit())
  assert.equal(attempts.length, 2)
  assert.equal(attempts[0], attempts[1])
  await close()
})

test('registra la primera declaración de un perfil existente solo tras confirmarla', async (t) => {
  let payload: Record<string, unknown> | undefined
  api.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/authorization-policy')) return ok(config, policy)
    assert.equal(config.url, '/care-subjects/88/authorization-declarations')
    if (config.method === 'post') payload = JSON.parse(config.data)
    return ok(config, payload ? [{ ...payload, id: 1, declaredAt: '2026-11-20T00:00:00Z', text: 'Declaración confirmada' }] : [])
  }
  t.after(await mount(<CareAuthorizationStatus subjectId={88} />))
  await click(button('Registrar declaración'))
  await click(radio('THIRD_PARTY'))
  await click(radio('LEGAL_REPRESENTATION'))
  assert.ok(button('Guardar declaración').disabled)
  await click(checkbox())
  await click(button('Guardar declaración'))
  assert.deepEqual(payload, { type: 'LEGAL_REPRESENTATION', textVersion: '1', confirmed: true, previousDeclarationId: null })
  assert.match(document.body.textContent ?? '', /Declaración registrada/)
})
