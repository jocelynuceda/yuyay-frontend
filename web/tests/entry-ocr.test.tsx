import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { act } from 'react'

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, File: dom.window.File, FormData: dom.window.FormData, IS_REACT_ACT_ENVIRONMENT: true })
// Node no acepta el File de jsdom en createObjectURL (en el navegador es el mismo Blob)
URL.createObjectURL = () => 'blob:examen'
URL.revokeObjectURL = () => {}
const { createRoot } = await import('react-dom/client')
const { HealthEntryForm } = await import('../src/pages/forms/HealthEntryForm')
const { api } = await import('../src/services/http')

test('lee un examen adjunto, rellena el formulario y guarda sin volver a subirlo', async (t) => {
  let uploads = 0
  const saved: { sourceAttachmentId?: number; details?: string; occurredOn?: string }[] = []
  api.defaults.adapter = async (config) => {
    const ok = (data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
    if (config.method === 'post' && config.url === '/care-subjects/4/attachments') { uploads++; return ok({ id: 9 }) }
    if (config.url === '/care-subjects/4/attachments/9') return ok({ id: 9, ocrStatus: 'DONE', ocrText: 'Hemograma\nFecha de atención: 05/03/2026\nHemoglobina 13.5' })
    saved.push(JSON.parse(config.data))
    return ok({ id: 1 })
  }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<HealthEntryForm subjectId={4} initialCategory="EXAM_RESULT" onSaved={() => {}} />))

  const button = (text: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text)
  const input = container.querySelector<HTMLInputElement>('#entry-file')!
  Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['x'], 'examen.pdf', { type: 'application/pdf' })] })
  await act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
  assert.ok(container.querySelector('section[aria-label="Archivo adjunto"] iframe'), 'el archivo se muestra al lado del formulario')
  await act(async () => { button('Leer texto del archivo')!.click() })

  assert.match(container.querySelector<HTMLTextAreaElement>('#entry-details')!.value, /Hemoglobina 13\.5/)
  assert.equal(container.querySelector<HTMLInputElement>('#entry-occurredOn')!.value, '2026-03-05')
  const title = container.querySelector<HTMLInputElement>('#entry-title')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(title, 'Hemograma')
    title.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  await act(async () => { container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click() })

  assert.equal(uploads, 1)
  assert.equal(saved[0].sourceAttachmentId, 9)
  assert.match(saved[0].details!, /Hemoglobina/)
})
