import { useEffect, useRef, useState } from 'react'
import { getAttachment } from '../../services/api/attachments'
import { getErrorMessage } from '../../utils/apiErrors'
import { OCR_POLL_MS } from '../documents/useOcrPolling'

/** Unos dos minutos: pasado eso se deja de esperar y la lectura sigue en Documentos. */
const MAX_READS = 40

/**
 * Sube el archivo elegido y espera el texto que lee el backend. `cancel` descarta la lectura
 * en curso (por ejemplo, al cambiar de archivo); también se descarta al salir del formulario.
 */
export function useReadAttachment(subjectId: number, upload: () => Promise<number | undefined>) {
  const [reading, setReading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const current = useRef(0)

  function cancel() {
    current.current++
    setReading(false)
    setMessage(null)
  }

  useEffect(() => () => void current.current++, [])

  async function read(onText: (text: string) => string) {
    const turn = ++current.current
    setReading(true)
    setMessage(null)
    try {
      const id = await upload()
      if (id === undefined) return
      for (let attempt = 0; attempt < MAX_READS && turn === current.current; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, OCR_POLL_MS))
        const attachment = await getAttachment(subjectId, id)
        if (turn !== current.current) return
        if (attachment.ocrStatus === 'PENDING') continue
        if (attachment.ocrStatus === 'FAILED') setMessage(attachment.ocrError ?? 'No pudimos leer el texto del archivo.')
        else setMessage(attachment.ocrText?.trim() ? onText(attachment.ocrText) : 'No encontramos texto en el archivo.')
        return
      }
      if (turn === current.current) setMessage('La lectura está tardando. Puedes revisarla luego en Documentos.')
    } catch (error) {
      if (turn === current.current) setMessage(getErrorMessage(error))
    } finally {
      if (turn === current.current) setReading(false)
    }
  }

  return { reading, message, read, cancel }
}
