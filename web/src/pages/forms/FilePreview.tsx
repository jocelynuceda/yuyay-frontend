import { useEffect, useRef } from 'react'

/** Vista previa de un archivo desde una URL local: imagen, audio o PDF. */
export function FilePreview({ file, name, large = false }: { file: Blob; name: string; large?: boolean }) {
  const ref = useRef<HTMLImageElement & HTMLAudioElement & HTMLIFrameElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (ref.current) ref.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (file.type.startsWith('image/')) return <img ref={ref} alt={name} className={`max-w-full rounded-xl border border-line ${large ? 'max-h-[80vh] w-full object-contain' : 'max-h-96 justify-self-start'}`} />
  if (file.type.startsWith('audio/')) return <audio ref={ref} controls aria-label={name} className="w-full" />
  // Solo PDF va en un iframe: otro tipo (p. ej. HTML) se ejecutaría con el origen de la app
  if (file.type !== 'application/pdf') return <p className="text-sm text-muted">Este archivo no tiene vista previa.</p>
  return <iframe ref={ref} title={name} className={`w-full rounded-xl border border-line ${large ? 'h-[80vh]' : 'h-96'}`} />
}
