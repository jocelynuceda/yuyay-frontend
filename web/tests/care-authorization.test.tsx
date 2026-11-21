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
