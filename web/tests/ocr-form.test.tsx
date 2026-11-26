import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { act, StrictMode } from 'react'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { createRoot } = await import('react-dom/client')
const { HealthEntryForm } = await import('../src/pages/forms/HealthEntryForm')
const { api } = await import('../src/services/http')

test('OCR: un rerender con nuevos valores iniciales conserva la revisión y envía ese texto completo', async (t) => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const originalAdapter = api.defaults.adapter
  t.after(async () => {
    await act(async () => root.unmount())
    container.remove()
    api.defaults.adapter = originalAdapter
  })
  const payloads: Record<string, unknown>[] = []
  api.defaults.adapter = async (config) => {
    assert.equal(config.method, 'post')
    assert.equal(config.url, '/care-subjects/2/health-entries')
    payloads.push(JSON.parse(config.data))
    return { config, data: { id: 99 }, status: 201, statusText: 'Created', headers: {} }
  }
  const original = 'Documento completo.\n'.repeat(200).trim()
  const render = (details: string) => root.render(
    <StrictMode>
      <HealthEntryForm
        subjectId={2}
        sourceAttachmentId={7}
        requireDocumentText
        initialValues={{ title: 'Documento revisado', categoryCode: 'ALLERGY', details, confidenceLevel: 'UNCERTAIN' }}
        onSaved={() => {}}
      />
    </StrictMode>,
  )
  await act(async () => render(original))
  const details = container.querySelector<HTMLTextAreaElement>('#entry-details')!
  const reviewed = original.replace('Documento completo.', 'Corrección manual del primer párrafo.')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!.call(details, reviewed)
    details.dispatchEvent(new window.Event('input', { bubbles: true }))
    container.querySelector<HTMLInputElement>('input[value="CONFIRMED"]')!.click()
  })
  // Un resultado tardío de OCR o un render del padre no reinicia el formulario ya revisado.
  await act(async () => render('Otra respuesta de lectura que no debe sustituir mi revisión.'))
  assert.equal(details.value, reviewed)
  assert.equal(container.querySelector<HTMLInputElement>('input[value="CONFIRMED"]')!.checked, true)
  await act(async () => container.querySelector<HTMLFormElement>('form')!.dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  ))
  assert.equal(payloads.length, 1)
  assert.equal(payloads[0].details, reviewed)
  assert.equal(payloads[0].confidenceLevel, 'CONFIRMED')
  assert.equal(payloads[0].sourceAttachmentId, 7)
})
