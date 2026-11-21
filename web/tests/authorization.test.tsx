// Declaración de autorización al añadir una persona (frontend #52, contrato del backend #69).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})

import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { act, type ReactNode } from 'react'
import { ToastProvider } from '../src/contexts/ToastContext'
import { CareSubjectForm } from '../src/pages/forms/CareSubjectForm'
import { AuthorizationStatus } from '../src/pages/people/AuthorizationStatus'
import { api } from '../src/services/http'
import type { CareAuthorizationPolicy } from '../src/types'
import {
  buildDeclaration,
  CHOOSE_AUTHORIZATION,
  CONFIRM_AUTHORIZATION,
  createRequestIdTracker,
  declarationLabel,
  splitAuthorizationOptions,
} from '../src/utils/authorization'

const { createRoot } = await import('react-dom/client')

const confirm = 'Confirmo que esta declaración es verdadera. Usaré y compartiré los datos únicamente dentro de lo autorizado'
const policy: CareAuthorizationPolicy = {
  textVersion: '1',
  thirdPartyQuestion: '¿Cómo estás autorizado para usar sus datos en Yuyay?',
  options: [
    { type: 'SELF', label: 'Este perfil es para mí.', description: 'Registraré mis datos.', scope: 'OWN_DATA', confirmationText: 'Confirmo que este perfil corresponde a mi persona.' },
    { type: 'FICTITIOUS', label: 'Este perfil es ficticio.', description: 'Usaré datos inventados.', scope: 'FICTITIOUS_DATA_ONLY', confirmationText: 'Confirmo que todos los datos de este perfil son ficticios.' },
    { type: 'HOLDER_PERMISSION', label: 'Esta persona me dio permiso.', description: 'Me autorizó a registrar sus datos.', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: confirm },
    { type: 'LEGAL_REPRESENTATION', label: 'Actúo como su representante legal.', description: 'Tengo facultades legales.', scope: 'WITHIN_DECLARED_AUTHORIZATION', confirmationText: confirm },
    { type: 'PENDING', label: 'Todavía no tengo autorización o no estoy seguro.', description: 'Puedes continuar cuando cuentes con la autorización correspondiente', scope: null, confirmationText: null },
  ],
}

const ok = (config: InternalAxiosRequestConfig, data: unknown, status = 200) => ({ config, data, headers: {}, status, statusText: 'OK' })

function mockApi(t: TestContext, adapter: AxiosAdapter) {
  const previous = api.defaults.adapter
  api.defaults.adapter = adapter
  t.after(() => { api.defaults.adapter = previous })
}

async function render(t: TestContext, node: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<ToastProvider>{node}</ToastProvider>))
  return container
}

const byText = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('label')].find((label) => label.textContent?.includes(text))!.querySelector('input')!

async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}

const submit = (container: HTMLElement) => act(async () => {
  container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 0))
})

test('Las reglas de la declaración: ninguna opción marcada, confirmación obligatoria y pendiente sin alta', () => {
  const { ownOptions, thirdPartyOptions } = splitAuthorizationOptions(policy)
  assert.deepEqual(ownOptions.map((o) => o.type), ['SELF', 'FICTITIOUS'])
  assert.deepEqual(thirdPartyOptions.map((o) => o.type), ['HOLDER_PERMISSION', 'LEGAL_REPRESENTATION', 'PENDING'])

  assert.deepEqual(buildDeclaration(policy, { type: null, confirmed: false }), { ok: false, error: CHOOSE_AUTHORIZATION })
  assert.deepEqual(buildDeclaration(policy, { type: 'HOLDER_PERMISSION', confirmed: false }), { ok: false, error: CONFIRM_AUTHORIZATION })
  assert.deepEqual(buildDeclaration(policy, { type: 'PENDING', confirmed: true }), {
    ok: false, error: 'Puedes continuar cuando cuentes con la autorización correspondiente', pending: true,
  })
  assert.deepEqual(buildDeclaration(policy, { type: 'FICTITIOUS', confirmed: true }), {
    ok: true, declaration: { type: 'FICTITIOUS', textVersion: '1', confirmed: true },
  })

  // Misma alta, misma clave; si cambia el contenido, otra clave
  let n = 0
  const requestIdFor = createRequestIdTracker(() => `id-${++n}`)
  assert.equal(requestIdFor({ name: 'Ana' }), 'id-1')
  assert.equal(requestIdFor({ name: 'Ana' }), 'id-1')
  assert.equal(requestIdFor({ name: 'Rosa' }), 'id-2')

  // La copia guardada de un tercero empieza con la pregunta; se muestra la opción
  assert.equal(declarationLabel('¿Cómo estás autorizado?\nEsta persona me dio permiso.\nConfirmo.'), 'Esta persona me dio permiso.')
})

test('Agregar persona pide la declaración y reintenta con la misma clave', async (t) => {
  const posts: any[] = []
  let failNext = true
  mockApi(t, async (config) => {
    if (config.method === 'get' && config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    if (config.method === 'post' && config.url === '/care-subjects') {
      posts.push(JSON.parse(config.data))
      if (failNext) {
        failNext = false
        throw Object.assign(new Error('Network Error'), { isAxiosError: true, config, code: 'ERR_NETWORK' })
      }
      return ok(config, { id: 9, name: 'Rosa', myRole: 'PRINCIPAL' }, 201)
    }
    throw new Error(`Petición inesperada ${config.method} ${config.url}`)
  })
  const saved: number[] = []
  const container = await render(t, <CareSubjectForm onSaved={(s) => saved.push(s.id)} />)

  // Las opciones salen del catálogo, sin ninguna marcada ni confirmación visible
  assert.match(container.textContent ?? '', /¿Cómo estás autorizado para usar sus datos en Yuyay\?/)
  assert.equal(container.querySelectorAll('input[type="radio"]:checked').length, 0)
  assert.equal(container.querySelector('input[type="checkbox"]'), null)

  await type(container.querySelector('input[autocomplete="off"]')!, 'Rosa')
  await submit(container)
  assert.match(container.textContent ?? '', new RegExp(CHOOSE_AUTHORIZATION))
  assert.equal(posts.length, 0)

  // Pendiente: explica y no crea el perfil
  await act(async () => byText(container, 'Todavía no tengo autorización').click())
  assert.match(container.textContent ?? '', /No se creará el perfil todavía/)
  assert.equal(container.querySelector('input[type="checkbox"]'), null)
  await submit(container)
  assert.equal(posts.length, 0)

  // Tercero con permiso: aparece la confirmación y es obligatoria
  await act(async () => byText(container, 'Esta persona me dio permiso.').click())
  assert.match(container.textContent ?? '', new RegExp(confirm))
  await submit(container)
  assert.match(container.textContent ?? '', new RegExp(CONFIRM_AUTHORIZATION))
  assert.equal(posts.length, 0)

  await act(async () => byText(container, 'Confirmo que esta declaración').click())
  await submit(container)
  assert.equal(posts.length, 1)
  assert.deepEqual(posts[0].declaration, { type: 'HOLDER_PERMISSION', textVersion: '1', confirmed: true })
  assert.match(posts[0].requestId, /^[A-Za-z0-9_-]{1,64}$/)
  assert.equal(saved.length, 0, 'el fallo de red no cierra el formulario')
  assert.equal((container.querySelector('input[autocomplete="off"]') as HTMLInputElement).value, 'Rosa')

  await submit(container)
  assert.equal(posts.length, 2)
  assert.equal(posts[1].requestId, posts[0].requestId, 'el reintento usa la misma clave')
  assert.deepEqual(saved, [9])
})

test('La ficha muestra lo declarado sin presentarlo como verificado', async (t) => {
  let declarations: unknown[] = []
  const sent: any[] = []
  mockApi(t, async (config) => {
    if (config.url === '/care-subjects/authorization-policy') return ok(config, policy)
    if (config.url === '/care-subjects/4/authorization-declarations') {
      if (config.method === 'post') {
        sent.push(JSON.parse(config.data))
        return ok(config, {})
      }
      return ok(config, declarations)
    }
    throw new Error(`Petición inesperada ${config.url}`)
  })
  let container = await render(t, <AuthorizationStatus subjectId={4} />)
  assert.match(container.textContent ?? '', /Sin declaración registrada/)
  assert.doesNotMatch(container.textContent ?? '', /Autorizado|Verificado/)

  declarations = [{
    id: 31, careSubjectId: 4, declaredByUserId: 8, type: 'LEGAL_REPRESENTATION', scope: 'WITHIN_DECLARED_AUTHORIZATION',
    textVersion: '1', text: 'Actúo como su representante legal.', declaredAt: '2026-11-20T15:00:00Z',
  }]
  container = await render(t, <AuthorizationStatus subjectId={4} />)
  assert.match(container.textContent ?? '', /declaraste «Actúo como su representante legal\.»/)
  assert.match(container.textContent ?? '', /no verificada/)

  // Cambiar la declaración envía la vigente como referencia
  const change = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Cambiar')!
  await act(async () => change.click())
  await act(async () => byText(container, 'Este perfil es ficticio.').click())
  await act(async () => byText(container, 'Confirmo que todos los datos').click())
  await submit(container)
  assert.deepEqual(sent, [{ type: 'FICTITIOUS', textVersion: '1', confirmed: true, previousDeclarationId: 31 }])
})
