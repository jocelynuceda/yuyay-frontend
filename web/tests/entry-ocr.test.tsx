import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
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

async function openExam(t: TestContext) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<HealthEntryForm subjectId={4} initialCategory="EXAM_RESULT" onSaved={() => {}} />))
  const input = container.querySelector<HTMLInputElement>('#entry-file')!
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === name)!
  const pick = async (name: string) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['%PDF-1.4'], name, { type: 'application/pdf' })] })
    await act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
  }
  const edit = async (selector: string, text: string) => {
    const field = container.querySelector(selector)!
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')!.set!.call(field, text)
    await act(async () => { field.dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
  }
  return { input, button, pick, edit }
}

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

test('al cambiar de archivo no se mezcla el texto ni la fecha del anterior con el nuevo adjunto', async (t) => {
  let uploads = 0
  const saved: { sourceAttachmentId?: number; details?: string; occurredOn?: string }[] = []
  const texts: Record<string, string> = {
    9: 'Hemograma\nFecha de atención: 05/03/2026\nHemoglobina 13.5',
    10: 'Glucosa\nFecha de atención: 09/04/2026\nGlucosa 90',
  }
  api.defaults.adapter = async (config) => {
    const ok = (data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
    if (config.method === 'post' && config.url === '/care-subjects/4/attachments') return ok({ id: 9 + uploads++ })
    const id = config.url?.match(/attachments\/(\d+)$/)?.[1]
    if (id) return ok({ id: Number(id), ocrStatus: 'DONE', ocrText: texts[id] })
    saved.push(JSON.parse(config.data))
    return ok({ id: 1 })
  }
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  t.after(async () => { await act(async () => root.unmount()); container.remove() })
  await act(async () => root.render(<HealthEntryForm subjectId={4} initialCategory="EXAM_RESULT" onSaved={() => {}} />))

  const input = container.querySelector<HTMLInputElement>('#entry-file')!
  const pick = async (name: string) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['x'], name, { type: 'application/pdf' })] })
    await act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
  }
  const read = async () => act(async () => {
    [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Leer texto del archivo')!.click()
  })
  const details = () => container.querySelector<HTMLTextAreaElement>('#entry-details')!.value
  const date = () => container.querySelector<HTMLInputElement>('#entry-occurredOn')!.value

  await pick('a.pdf')
  await read()
  await pick('b.pdf')
  assert.equal(details(), '')
  assert.equal(date(), '')
  await read()
  const title = container.querySelector<HTMLInputElement>('#entry-title')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(title, 'Control')
    title.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  await act(async () => { container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click() })

  assert.equal(saved[0].sourceAttachmentId, 10)
  assert.match(saved[0].details!, /Glucosa 90/)
  assert.doesNotMatch(saved[0].details!, /Hemoglobina/)
  assert.equal(saved[0].occurredOn, '2026-04-09')
})

test('una subida antigua que llega después de la lectura nueva no cambia ni duplica el adjunto', async (t) => {
  let finishFirst!: () => void
  let finishSave!: () => void
  const firstUpload = new Promise<void>(resolve => { finishFirst = resolve })
  const saving = new Promise<void>(resolve => { finishSave = resolve })
  const uploads: string[] = []
  const saved: { sourceAttachmentId: number; details: string; occurredOn: string }[] = []
  api.defaults.adapter = async (config) => {
    const ok = (data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
    if (config.method === 'post' && config.url?.endsWith('/attachments')) {
      const name = (config.data.get('file') as File).name
      uploads.push(name)
      if (name === 'A.pdf') await firstUpload
      return ok({ id: name === 'A.pdf' ? 21 : 22 })
    }
    if (config.url?.endsWith('/attachments/22')) {
      return ok({ id: 22, ocrStatus: 'DONE', ocrText: 'Resultado B\nFecha de atención: 09/04/2026' })
    }
    assert.equal(config.url, '/care-subjects/4/health-entries')
    saved.push(JSON.parse(config.data))
    await saving
    return ok({ id: 101 })
  }
  const form = await openExam(t)
  const read = () => act(async () => { form.button('Leer texto del archivo').click() })
  await form.pick('A.pdf')
  await read()
  await form.pick('B.pdf')
  await read()
  await act(async () => { finishFirst() })
  await form.edit('#entry-title', 'Control')
  await act(async () => { form.button('Registrar').click() })
  assert.ok(form.input.disabled)
  assert.ok(form.button('Leer texto del archivo').disabled)
  await act(async () => { finishSave() })
  assert.deepEqual(uploads, ['A.pdf', 'B.pdf'])
  assert.equal(saved.length, 1)
  assert.equal(saved[0].sourceAttachmentId, 22)
  assert.match(saved[0].details, /Resultado B/)
  assert.equal(saved[0].occurredOn, '2026-04-09')
})

test('al cambiar el adjunto, la persona puede revisar y conservar su corrección antes de guardar', async (t) => {
  let id = 0
  const saved: { details: string; sourceAttachmentId: number }[] = []
  api.defaults.adapter = async (config) => {
    const ok = (data: unknown) => ({ config, data, headers: {}, status: 200, statusText: 'OK' })
    if (config.method === 'post' && config.url?.endsWith('/attachments')) return ok({ id: ++id })
    if (config.method === 'get') return ok({ id, ocrStatus: 'DONE', ocrText: 'Texto extraído\nFecha de atención: 09/04/2026' })
    saved.push(JSON.parse(config.data))
    return ok({ id: 100 })
  }
  const form = await openExam(t)
  await form.pick('A.pdf')
  await act(async () => { form.button('Leer texto del archivo').click() })
  await form.edit('#entry-details', 'Resultado corregido')
  await form.pick('B.pdf')
  await act(async () => { form.button('Leer texto del archivo').click() })
  await form.edit('#entry-title', 'Control')
  assert.ok(form.button('Registrar').disabled)
  await act(async () => { form.button('Ya revisé los campos').click() })
  await act(async () => { form.button('Registrar').click() })
  assert.equal(saved[0].details, 'Resultado corregido')
  assert.equal(saved[0].sourceAttachmentId, 2)
})
