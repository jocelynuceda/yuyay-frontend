const MAX_VOICE_BYTES = 10 * 1024 * 1024
export const MAX_RECORDING_MINUTES = 5
export const VOICE_FILE_ACCEPT = 'audio/webm,audio/mp4,audio/x-m4a,.webm,.weba,.m4a'

const WEBM = 'audio/webm'
const MP4 = 'audio/mp4'
const SIZE_ERROR = 'El audio supera el tamaño máximo de 10 MB.'
const RECORDING_ERROR = 'No pudimos grabar el audio. Inténtalo de nuevo o elige un archivo.'

export function voiceMimeType(type: string) {
  const mime = type.split(';', 1)[0].trim().toLowerCase()
  if (mime === MP4 || mime === 'audio/x-m4a') return MP4
  if (mime === WEBM) return WEBM
  return null
}

export function prepareVoiceFile(file: File): File {
  if (file.size === 0) throw new Error('El audio está vacío.')
  if (file.size > MAX_VOICE_BYTES) throw new Error(SIZE_ERROR)

  const unknownMime = !file.type || file.type === 'application/octet-stream'
  let type = voiceMimeType(file.type)
  if (unknownMime && /\.m4a$/i.test(file.name)) type = MP4
  // Chromium etiqueta .webm como video/webm por extensión, incluso si solo tiene audio.
  if ((unknownMime || file.type === 'video/webm') && /\.web[ma]$/i.test(file.name)) type = WEBM
  if (!type) throw new Error('Usa un archivo de audio M4A o WebM.')
  return file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified })
}

function recordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  // Versiones antiguas de Safari pueden grabar MP4 sin exponer isTypeSupported.
  if (typeof MediaRecorder.isTypeSupported !== 'function') return MP4
  return [`${WEBM};codecs=opus`, WEBM, `${MP4};codecs=mp4a.40.2`, MP4].find((type) =>
    MediaRecorder.isTypeSupported(type),
  ) ?? null
}

function recordingSupport() {
  if (globalThis.isSecureContext === false) {
    return { unavailable: 'Para grabar con el micrófono, abre Yuyay con HTTPS.' }
  }
  const mimeType = recordingMimeType()
  if (!globalThis.navigator?.mediaDevices?.getUserMedia || !mimeType) {
    return { unavailable: 'Este navegador no puede grabar en un formato compatible.' }
  }
  return { mimeType }
}

export function recordingUnavailableReason() {
  return recordingSupport().unavailable
}

function microphoneError(error: unknown) {
  const name = error instanceof Error || error instanceof DOMException ? error.name : undefined
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permite el acceso al micrófono en tu navegador para grabar.'
    case 'NotFoundError':
      return 'No encontramos un micrófono. Conecta uno o elige un archivo.'
    case 'NotReadableError':
    case 'AbortError':
      return 'No pudimos usar el micrófono. Comprueba que esté disponible o elige un archivo.'
    default:
      return RECORDING_ERROR
  }
}

/** Graba hasta que se llame a stop o se alcance el límite. Abortar descarta y libera el micrófono. */
export async function recordVoiceNote(signal: AbortSignal, onStart: (stop: () => void) => void): Promise<File | null> {
  if (signal.aborted) return null
  const { mimeType, unavailable } = recordingSupport()
  if (!mimeType) throw new Error(unavailable)

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    if (signal.aborted) return null
    throw new Error(microphoneError(error))
  }

  let tracks = stream.getTracks()
  function releaseMicrophone() {
    tracks.forEach((track) => track.stop())
    tracks = []
  }
  // getUserMedia puede seguir esperando permiso después de cancelar o salir de la pestaña.
  if (signal.aborted) {
    releaseMicrophone()
    return null
  }

  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
  } catch {
    releaseMicrophone()
    throw new Error(RECORDING_ERROR)
  }

  return new Promise((resolve, reject) => {
    const chunks: Blob[] = []
    let size = 0
    let timer: ReturnType<typeof setTimeout>

    function stop() {
      clearTimeout(timer)
      if (recorder.state !== 'inactive') recorder.stop()
      releaseMicrophone()
    }

    function cleanup() {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      signal.removeEventListener('abort', cancel)
      stop()
    }

    function cancel() {
      cleanup()
      resolve(null)
    }

    function fail(message: string) {
      cleanup()
      reject(new Error(message))
    }

    recorder.ondataavailable = ({ data }) => {
      size += data.size
      if (size > MAX_VOICE_BYTES) fail(SIZE_ERROR)
      else if (data.size) chunks.push(data)
    }
    recorder.onerror = () => fail(RECORDING_ERROR)
    recorder.onstop = () => {
      cleanup()
      if (size === 0) {
        reject(new Error('La grabación quedó vacía. Inténtalo de nuevo.'))
        return
      }
      const type = voiceMimeType(recorder.mimeType || mimeType)
      if (!type) {
        reject(new Error(RECORDING_ERROR))
        return
      }
      const extension = type === WEBM ? 'webm' : 'm4a'
      resolve(new File(chunks, `nota-de-voz-${Date.now()}.${extension}`, { type }))
    }
    signal.addEventListener('abort', cancel, { once: true })

    try {
      // Recibe fragmentos para poder revisar el tamaño durante la grabación.
      recorder.start(1000)
    } catch {
      fail(RECORDING_ERROR)
      return
    }
    timer = setTimeout(stop, MAX_RECORDING_MINUTES * 60_000)
    onStart(stop)
  })
}
