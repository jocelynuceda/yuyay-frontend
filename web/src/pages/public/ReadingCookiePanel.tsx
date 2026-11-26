import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { rememberReading } from '../../services/api/readingCookie'
import { focusRing } from '../../utils/styles'

function Shield() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="m12 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" />
  </svg>
}

export function ReadingCookiePanel({ token, grant }: { token: string; grant: string }) {
  const [mode, setMode] = useState<'panel' | 'tab' | 'ball' | 'saved'>('panel')
  const [right, setRight] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const handle = useRef<HTMLButtonElement>(null)
  const minimize = useRef<HTMLButtonElement>(null)
  const savedNotice = useRef<HTMLSpanElement>(null)
  const initial = useRef(true)
  const drag = useRef<{ id: number; start: number; left: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  useEffect(() => {
    if (initial.current) { initial.current = false; return }
    const target = mode === 'saved' ? savedNotice : mode === 'panel' ? minimize : handle
    target.current?.focus({ preventScroll: true })
  }, [mode])

  async function accept() {
    if (saving) return
    setSaving(true)
    setError(false)
    try {
      await rememberReading(token, grant)
      setMode('saved')
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  const position = `fixed z-40 bottom-[max(1rem,env(safe-area-inset-bottom))] ${right ? 'right-4' : 'left-4'}`
  const surface = 'border border-line bg-card text-ink shadow-lg'
  if (mode === 'saved') return <span ref={savedNotice} tabIndex={-1} role="status" className="sr-only">Permiso de lectura guardado en este navegador.</span>
  if (mode === 'tab') return <button ref={handle} onClick={() => setMode('panel')}
    className={`${position} ${surface} ${focusRing} flex min-h-11 items-center gap-2 rounded-full px-4 text-sm`}><Shield /> Permiso de lectura</button>
  if (mode === 'ball') return <button ref={handle} aria-label="Abrir el permiso de lectura"
    title="Abrir el permiso de lectura. Arrastra o usa las flechas para moverlo."
    className={`${position} ${surface} ${focusRing} grid size-11 touch-none cursor-grab place-items-center rounded-full text-primary active:cursor-grabbing`}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return
      suppressClick.current = false
      drag.current = { id: event.pointerId, start: event.clientX, left: event.currentTarget.getBoundingClientRect().left, moved: false }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      const motion = drag.current
      if (!motion || motion.id !== event.pointerId) return
      const distance = event.clientX - motion.start
      if (!motion.moved && Math.abs(distance) < 6) return
      motion.moved = true
      const left = Math.max(0, Math.min(document.documentElement.clientWidth - event.currentTarget.offsetWidth, motion.left + distance))
      event.currentTarget.style.transform = `translateX(${left - motion.left}px)`
    }}
    onPointerUp={event => {
      if (drag.current?.moved) {
        const bounds = event.currentTarget.getBoundingClientRect()
        setRight(bounds.left + bounds.width / 2 > document.documentElement.clientWidth / 2)
        suppressClick.current = true
      }
      drag.current = null
      event.currentTarget.style.removeProperty('transform')
    }}
    onLostPointerCapture={event => { drag.current = null; event.currentTarget.style.removeProperty('transform') }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setRight(event.key === 'ArrowRight') }
    }}
    onClick={event => { if (!suppressClick.current || event.detail === 0) setMode('panel') }}><Shield /></button>
  return <aside aria-labelledby="reading-cookie-title"
    className={`${position} ${surface} max-h-[calc(100dvh-2rem)] w-[min(23.5rem,calc(100%-2rem))] overflow-auto rounded-2xl p-4`}>
    <div className="flex items-center gap-2">
      <span className="rounded-lg bg-primary-tint p-2 text-primary"><Shield /></span>
      <h2 id="reading-cookie-title" className="grow text-base font-semibold">¿Guardar esta lectura?</h2>
      <button ref={minimize} disabled={saving} onClick={() => setMode('tab')} aria-label="Minimizar" className={`size-9 rounded-lg ${focusRing}`}>−</button>
      <button disabled={saving} onClick={() => setMode('ball')} aria-label="Reducir a un escudo" className={`grid size-9 place-items-center rounded-lg ${focusRing}`}><Icon name="x" className="size-4" /></button>
    </div>
    <p className="mt-2 text-sm text-muted">Una cookie te permitirá volver a este resumen en este navegador sin pedir otro código mientras tu permiso siga vigente.</p>
    <p className="mt-2 text-xs text-muted">Úsalo solo en un dispositivo de confianza. Aceptar no amplía el tiempo de lectura.</p>
    {error && <p role="alert" className="mt-2 text-sm text-danger">No pudimos guardar la lectura. Puedes seguir leyendo en esta pestaña.</p>}
    <div className="mt-3 flex gap-2">
      <button disabled={saving} onClick={() => setMode('ball')} className={`min-h-11 flex-1 rounded-xl border border-line ${focusRing}`}>Ahora no</button>
      <button disabled={saving} onClick={() => void accept()} className={`min-h-11 flex-1 rounded-xl bg-primary font-semibold text-white ${focusRing}`}>{saving ? 'Guardando…' : 'Aceptar'}</button>
    </div>
  </aside>
}
