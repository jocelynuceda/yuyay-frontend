import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { JSDOM } from 'jsdom'
import { act } from 'react'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import type { Attachment } from '../src/types'
import { MAX_RECORDING_MINUTES, prepareVoiceFile, recordVoiceNote } from '../src/pages/documents/voiceRecording'

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://yuyay.test/' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  requestAnimationFrame: (callback: FrameRequestCallback) => { callback(0); return 0 },
  IS_REACT_ACT_ENVIRONMENT: true,
  isSecureContext: true,
})
Object.assign(dom.window.HTMLMediaElement.prototype, { load() {}, pause() {} })
Object.assign(dom.window.HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) { this.open = true },
  close(this: HTMLDialogElement) { this.open = false },
})

const { createRoot } = await import('react-dom/client')
const { VoiceNotesPanel } = await import('../src/pages/documents/VoiceNotesPanel')
const { AuthContext } = await import('../src/contexts/auth-context')
const { ToastContext } = await import('../src/contexts/toast-context')
const { api, clearTokens, setTokens } = await import('../src/services/http')

class Recorder {
  static supported = 'audio/webm;codecs=opus'
  static current: Recorder | null = null
  static isTypeSupported(type: string) { return type === Recorder.supported }
  state: RecordingState = 'inactive'
  mimeType: string
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(_stream: MediaStream, options: MediaRecorderOptions) {
    this.mimeType = options.mimeType ?? ''
    Recorder.current = this
  }

  start() { this.state = 'recording' }

  stop() {
    this.state = 'inactive'
    queueMicrotask(() => {
      this.emit(new Blob(['final'], { type: this.mimeType }))
      this.onstop?.()
    })
  }

  emit(data: Blob) { this.ondataavailable?.({ data }) }
}

Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, writable: true, value: Recorder })

function microphone(getUserMedia?: () => Promise<unknown>) {
  Recorder.current = null
  let released = 0
  const stream = { getTracks: () => [{ stop: () => { released += 1 } }] }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: getUserMedia ?? (() => Promise.resolve(stream)) },
  })
  return { stream, released: () => released }
}

test('los archivos de audio se normalizan al MIME exacto y se valida el límite del backend', () => {
  assert.equal(prepareVoiceFile(new File(['audio'], 'a.webm', { type: 'audio/webm;codecs=opus' })).type, 'audio/webm')
  assert.equal(prepareVoiceFile(new File(['audio'], 'a.m4a', { type: 'audio/x-m4a' })).type, 'audio/mp4')
  assert.equal(prepareVoiceFile(new File(['audio'], 'a.m4a')).type, 'audio/mp4')
  assert.throws(() => prepareVoiceFile(new File(['pdf'], 'a.pdf', { type: 'application/pdf' })), /M4A o WebM/)
  assert.throws(() => prepareVoiceFile(new File([], 'a.m4a')), /vacío/)
  const limit = 10 * 1024 * 1024
  assert.equal(prepareVoiceFile(new File([new Uint8Array(limit)], 'a.m4a')).size, limit)
  assert.throws(() => prepareVoiceFile(new File([new Uint8Array(limit + 1)], 'a.m4a')), /10 MB/)
})

test('el grabador elige MP4 cuando WebM no está disponible y se detiene al alcanzar la duración', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const mic = microphone()
  Recorder.supported = 'audio/mp4'
  const recording = recordVoiceNote(new AbortController().signal, () => {})
  await Promise.resolve()
  assert.equal(Recorder.current?.mimeType, 'audio/mp4')
  Recorder.current?.emit(new Blob(['inicio-']))
  t.mock.timers.tick(MAX_RECORDING_MINUTES * 60_000)
  const file = await recording
  assert.equal(file?.type, 'audio/mp4')
  assert.match(file?.name ?? '', /\.m4a$/)
  assert.equal(await file?.text(), 'inicio-final')
  assert.equal(mic.released(), 1)
})

test('el grabador libera el micrófono si el permiso llega después de cancelar', async () => {
  let allow: (stream: unknown) => void = () => {}
  const mic = microphone(() => new Promise((resolve) => { allow = resolve }))
  const controller = new AbortController()
  const recording = recordVoiceNote(controller.signal, () => assert.fail('Grabación cancelada'))
  controller.abort()
  allow(mic.stream)
  assert.equal(await recording, null)
  assert.equal(Recorder.current, null)
  assert.equal(mic.released(), 1)
})

test('el grabador informa permisos, micrófono ausente, contexto inseguro y tamaño excesivo', async (t) => {
  const signal = new AbortController().signal
  const onStart = () => {}
  microphone(() => Promise.reject(new DOMException('', 'NotAllowedError')))
  await assert.rejects(recordVoiceNote(signal, onStart), /Permite el acceso al micrófono/)
  microphone(() => Promise.reject(new DOMException('', 'NotFoundError')))
  await assert.rejects(recordVoiceNote(signal, onStart), /No encontramos un micrófono/)
  globalThis.isSecureContext = false
  t.after(() => { globalThis.isSecureContext = true })
  await assert.rejects(recordVoiceNote(signal, onStart), /HTTPS/)
  globalThis.isSecureContext = true

  const mic = microphone()
  const oversized = recordVoiceNote(signal, onStart)
  await Promise.resolve()
  Recorder.current?.emit(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]))
  await assert.rejects(oversized, /10 MB/)
  assert.equal(mic.released(), 1)
})

const attachment = (values: Partial<Attachment> = {}): Attachment => ({
  id: 1, careSubjectId: 1, consultationId: null, uploadedById: 1, uploadedByName: 'Ana',
  originalFilename: 'nota.m4a', contentType: 'audio/x-m4a', sizeBytes: 12, ocrStatus: 'DONE',
  ocrText: null, ocrError: null, uploadedAt: '2026-11-07T00:00:00Z', ocrCompletedAt: null, ...values,
})

function ok(config: InternalAxiosRequestConfig, data: unknown) {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function fail(config: InternalAxiosRequestConfig, status: number, message: string) {
  return Object.assign(new Error(message), {
    config, isAxiosError: true, response: { ...ok(config, { message }), status },
  })
}

function mountPanel(t: TestContext, adapter: AxiosAdapter) {
  const previousAdapter = api.defaults.adapter
  api.defaults.adapter = adapter
  setTokens({ accessToken: 'voice-access', refreshToken: 'voice-refresh' })
  const root = createRoot(document.getElementById('root')!)
  t.after(async () => {
    await act(async () => root.unmount())
    clearTokens()
    api.defaults.adapter = previousAdapter
  })
  const notices: string[] = []
  const noop = async () => {}
  const user = { id: 1, name: 'Ana', email: 'ana@yuyay.test' }
  const render = (subjectId = 1, isPrincipal = false) => act(async () => root.render(
    <AuthContext.Provider value={{
      user, isAuthenticated: true, isLoading: false, restoreError: null, retryRestore: noop,
      login: noop, register: noop, logout: noop, updateUser: () => {},
    }}>
      <ToastContext.Provider value={{ success: (message) => notices.push(message), info: () => {}, error: () => {} }}>
        <VoiceNotesPanel subjectId={subjectId} isPrincipal={isPrincipal} />
      </ToastContext.Provider>
    </AuthContext.Provider>,
  ))
  return { render, notices }
}

const body = () => document.body.textContent ?? ''
const button = (label: string) => [...document.querySelectorAll('button')].find((el) =>
  el.getAttribute('aria-label') === label || el.textContent?.trim() === label,
)
async function click(label: string) {
  const element = button(label)
  assert.ok(element, `Falta el botón ${label}`)
  await act(async () => element.click())
}

test('el panel lista audio, carga contenido privado y recupera errores de carga, guardado y borrado', async (t) => {
  const mic = microphone()
  Recorder.supported = 'audio/webm;codecs=opus'
  const revoked: string[] = []
  const url = t.mock.method(URL, 'createObjectURL', (blob: Blob) => `blob:${blob.type}`)
  t.mock.method(URL, 'revokeObjectURL', (value: string) => revoked.push(value))
  let notes = [
    attachment(),
    attachment({ id: 2, originalFilename: 'otra.webm', contentType: 'audio/webm', uploadedById: 2 }),
    attachment({ id: 3, originalFilename: 'receta.pdf', contentType: 'application/pdf' }),
  ]
  let contentRequests = 0
  let uploadRequests = 0
  let deleteRequests = 0
  const { render, notices } = mountPanel(t, async (config) => {
    assert.equal(config.headers.get('Authorization'), 'Bearer voice-access')
    const path = config.url
    if (path === '/care-subjects/1/attachments' && config.method === 'get') return ok(config, [...notes])
    if (path === '/care-subjects/1/attachments/1/content') {
      assert.equal(config.responseType, 'blob')
      assert.ok(config.signal)
      if (++contentRequests === 1) throw fail(config, 403, 'No tienes acceso al audio.')
      return ok(config, new Blob(['audio guardado'], { type: 'audio/x-m4a' }))
    }
    if (path === '/care-subjects/1/attachments' && config.method === 'post') {
      const file = config.data.get('file') as File
      assert.equal(file.type, 'audio/webm')
      assert.match(file.name, /\.webm$/)
      assert.equal(await file.text(), 'inicio-final')
      if (++uploadRequests === 1) throw fail(config, 400, 'El servidor rechazó el audio.')
      const created = attachment({ id: 4, contentType: file.type, originalFilename: file.name })
      notes.push(created)
      return ok(config, created)
    }
    if (path === '/care-subjects/1/attachments/1' && config.method === 'delete') {
      if (++deleteRequests === 1) throw fail(config, 409, 'El archivo está vinculado a un registro.')
      notes = notes.filter((note) => note.id !== 1)
      return ok(config, null)
    }
    assert.fail(`Petición inesperada ${config.method} ${path}`)
  })

  await render()
  assert.match(body(), /nota\.m4a/)
  assert.match(body(), /otra\.webm/)
  assert.doesNotMatch(body(), /receta\.pdf/)
  assert.equal(button('Borrar otra.webm'), undefined)
  assert.equal(contentRequests, 0)
  await click('Abrir reproductor de nota.m4a')
  assert.match(body(), /No pudimos abrir el audio/)
  await click('Reintentar')
  const audio = document.querySelector('audio')!
  assert.equal(audio.src, 'blob:audio/mp4')
  assert.equal(document.querySelector<HTMLAnchorElement>('a[download]')?.download, 'nota.m4a')
  await act(async () => audio.dispatchEvent(new dom.window.Event('error')))
  assert.match(body(), /El navegador no pudo reproducir este audio/)

  await click('Grabar nota de voz')
  assert.match(body(), /Grabando…/)
  Recorder.current?.emit(new Blob(['inicio-']))
  await click('Detener grabación')
  assert.equal(mic.released(), 1)
  assert.match(body(), /Vista previa/)
  assert.equal(uploadRequests, 0)
  await click('Guardar nota de voz')
  assert.match(body(), /El servidor rechazó el audio/)
  assert.match(body(), /Vista previa/)
  await click('Guardar nota de voz')
  assert.equal(uploadRequests, 2)
  assert.match(body(), /nota-de-voz-\d+\.webm/)
  assert.doesNotMatch(body(), /Vista previa/)
  assert.deepEqual(revoked, ['blob:audio/webm'])
  assert.equal(url.mock.callCount(), 2)

  await click('Borrar nota.m4a')
  assert.equal(document.querySelector('dialog')?.open, true)
  await click('Volver')
  assert.equal(deleteRequests, 0)
  await click('Borrar nota.m4a')
  await click('Borrar nota de voz')
  assert.match(body(), /El archivo está vinculado a un registro/)
  await click('Borrar nota de voz')
  assert.equal(deleteRequests, 2)
  assert.doesNotMatch(body(), /nota\.m4a/)
  assert.deepEqual(revoked, ['blob:audio/webm', 'blob:audio/mp4'])
  assert.deepEqual(notices, ['Nota de voz guardada.', 'Nota de voz borrada.'])
})

test('cambiar de persona detiene una grabación y cancela el contenido del perfil anterior', async (t) => {
  const mic = microphone()
  let contentSignal: InternalAxiosRequestConfig['signal']
  const { render } = mountPanel(t, async (config) => {
    if (config.url === '/care-subjects/1/attachments') return ok(config, [attachment()])
    if (config.url === '/care-subjects/2/attachments') return ok(config, [])
    if (config.url === '/care-subjects/1/attachments/1/content') {
      contentSignal = config.signal
      return new Promise((_, reject) => {
        config.signal?.addEventListener?.('abort', () => reject(new DOMException('', 'AbortError')), { once: true })
      })
    }
    assert.fail(`Petición inesperada ${config.url}`)
  })

  await render()
  await click('Abrir reproductor de nota.m4a')
  await click('Grabar nota de voz')
  assert.match(body(), /Grabando…/)
  await render(2)
  assert.equal(mic.released(), 1)
  assert.equal(Recorder.current?.state, 'inactive')
  assert.equal(contentSignal?.aborted, true)
  assert.doesNotMatch(body(), /nota\.m4a|Vista previa|Grabando…/)
  assert.match(body(), /Aún no hay notas de voz/)
})

test('el selector permite guardar un WebM aunque el navegador no pueda grabar', async (t) => {
  microphone()
  Recorder.supported = 'audio/ogg'
  t.after(() => { Recorder.supported = 'audio/webm;codecs=opus' })
  let notes: Attachment[] = []
  const { render } = mountPanel(t, async (config) => {
    if (config.url === '/care-subjects/1/attachments' && config.method === 'get') return ok(config, [...notes])
    assert.equal(config.url, '/care-subjects/1/attachments')
    assert.equal(config.method, 'post')
    const file = config.data.get('file') as File
    assert.equal(file.name, 'seleccionado.webm')
    assert.equal(file.type, 'audio/webm')
    notes = [attachment({ originalFilename: file.name, contentType: file.type, uploadedById: 2 })]
    return ok(config, notes[0])
  })

  await render(1, true)
  assert.equal(button('Grabar nota de voz')?.disabled, true)
  assert.equal(button('Elegir archivo de audio')?.disabled, false)
  assert.match(body(), /Este navegador no puede grabar/)
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  const file = new File(['archivo webm'], 'seleccionado.webm', { type: 'video/webm' })
  Object.defineProperty(input, 'files', { value: [file] })
  await act(async () => input.dispatchEvent(new dom.window.Event('change', { bubbles: true })))
  assert.match(body(), /Vista previa · seleccionado\.webm/)
  await click('Guardar nota de voz')
  assert.match(body(), /seleccionado\.webm/)
  assert.doesNotMatch(body(), /Vista previa/)
  assert.ok(button('Borrar seleccionado.webm'))
})
