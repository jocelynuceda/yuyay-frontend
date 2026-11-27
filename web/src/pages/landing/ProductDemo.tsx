import { useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../components/ui/cx'
import { Icon, type IconName } from '../../components/ui/Icon'
import { LionAvatar } from '../../components/ui/LionAvatar'
import { focusRing } from '../../utils/styles'

/*
 * Vistas de ejemplo de la app, armadas con las mismas piezas visuales (tarjetas, insignias, avatares)
 * que las pantallas reales. Todos los datos son ficticios: Rosa, Ana y Bruno no existen.
 */

export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'pending' | 'neutral' | 'sky'; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'ok' && 'bg-accent-tint text-accent-text',
        tone === 'pending' && 'bg-[#FDEFC8] text-[#7A4F00] dark:bg-[#3A2E10] dark:text-[#F5C96A]',
        tone === 'neutral' && 'bg-primary-tint text-soft-text',
        tone === 'sky' && 'bg-soft text-ink',
      )}
    >
      {tone === 'ok' ? <Icon name="check" className="h-3 w-3" /> : null}
      {children}
    </span>
  )
}

/** Fila de un registro, como en la lista de la ficha de una persona. */
function EntryRow({ title, meta, pill, by }: { title: string; meta: string; pill: ReactNode; by?: string }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-card px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary-fg">
        <Icon name="medkit" className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{meta}</p>
      </div>
      <div className="grid justify-items-end gap-1">
        {pill}
        {by ? <span className="text-xs text-muted">{by}</span> : null}
      </div>
    </li>
  )
}

function Heading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>
        <p className="font-display text-xl font-bold">{title}</p>
      </div>
      {action ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
          <Icon name="plus" className="h-3.5 w-3.5" /> {action}
        </span>
      ) : null}
    </div>
  )
}

function DashboardView() {
  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-linear-to-br from-primary to-soft-text p-5 text-white dark:from-hero-from dark:to-hero-to">
        <p className="text-sm text-white/80">Resumen de hoy</p>
        <p className="font-display text-2xl font-bold">Hola, Ana</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
          <Icon name="calendar" className="h-4 w-4" /> Próxima cita: martes 2, 10:30 a. m. · Rosa
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Personas', '2'],
          ['Avisos sin leer', '3'],
          ['Invitaciones', '0'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-card p-3">
            <p className="font-display text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="text-sm font-semibold">Último aviso</p>
        <p className="mt-1 text-sm text-muted">Bruno actualizó «Losartán» en el perfil de Rosa · hace 2 h</p>
      </div>
    </div>
  )
}

function MedicationView() {
  return (
    <div className="grid gap-4">
      <Heading eyebrow="Rosa · 78 años" title="Medicación" action="Agregar" />
      <ul className="grid gap-2">
        <EntryRow title="Losartán 50 mg" meta="Cada 12 h · para la presión" pill={<Pill tone="ok">Confirmado</Pill>} by="v2 · Bruno" />
        <EntryRow title="Metformina 850 mg" meta="Con el almuerzo" pill={<Pill tone="ok">Confirmado</Pill>} by="v1 · Ana" />
        <EntryRow title="Paracetamol 500 mg" meta="Solo si hay dolor" pill={<Pill tone="pending">Por confirmar</Pill>} by="v1 · Ana" />
      </ul>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name="history" className="h-4 w-4" /> Bruno cambió la frecuencia de cada 24 h a cada 12 h · hace 3 días
      </p>
    </div>
  )
}

function OcrView() {
  return (
    <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
      {/* Receta de ejemplo: solo líneas, sin datos legibles de una persona real */}
      <div aria-hidden="true" className="relative rounded-2xl border border-line bg-white p-4 text-[#1E2158]">
        <p className="text-xs font-bold tracking-wide text-[#4A5680]">RECETA · EJEMPLO</p>
        <div className="mt-3 grid gap-2">
          {[90, 70, 80, 55, 75].map((width, index) => (
            <span key={index} className="block h-2 rounded-full bg-[#1E2158]/15" style={{ width: `${width}%` }} />
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-[#6A64C2]/12 px-2 py-1 font-mono text-xs">Losartán 50 mg · 1 c/12 h</p>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#E3F3F8] px-2 py-0.5 text-[0.7rem] font-semibold">
          <Icon name="camera" className="h-3 w-3" /> Foto
        </span>
      </div>
      <div className="grid content-start gap-3">
        <p className="flex items-start gap-2 rounded-2xl bg-[#FDEFC8] p-3 text-sm text-[#7A4F00] dark:bg-[#3A2E10] dark:text-[#F5C96A]">
          <Icon name="alert" className="mt-0.5 h-4 w-4" />
          Revisa cada dato con la receta antes de guardar.
        </p>
        {[
          ['Medicamento', 'Losartán'],
          ['Dosis', '50 mg'],
          ['Frecuencia', 'Cada 12 h'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold text-muted">{label}</p>
            <p className="rounded-xl border border-line bg-card px-3 py-2 text-sm">{value}</p>
          </div>
        ))}
        <span className="justify-self-start rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">Confirmar y guardar</span>
      </div>
    </div>
  )
}

function FamilyView() {
  const people: { name: string; role: string; note?: string; avatar: Parameters<typeof LionAvatar>[0]['avatar']; pending?: boolean }[] = [
    { name: 'Ana Torres', role: 'Principal', note: 'Hija', avatar: { kind: 'adult', variant: 'lioness' } },
    { name: 'Bruno Torres', role: 'Cuidador', note: 'Hijo', avatar: { kind: 'adult', variant: 'lion' } },
    { name: 'carmen@example.com', role: 'Invitación pendiente', avatar: { kind: 'adult', variant: 'lioness' }, pending: true },
  ]
  return (
    <div className="grid gap-4">
      <Heading eyebrow="Rosa · 78 años" title="Cuidadores" action="Invitar" />
      <ul className="grid gap-2">
        {people.map((person) => (
          <li key={person.name} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <LionAvatar avatar={person.avatar} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{person.name}</p>
              <p className="text-sm text-muted">{person.note ?? 'Recibirá un correo para unirse'}</p>
            </div>
            <Pill tone={person.pending ? 'pending' : person.role === 'Principal' ? 'neutral' : 'sky'}>{person.role}</Pill>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">Todos ven lo mismo y cada cambio dice quién lo hizo.</p>
    </div>
  )
}

function AppointmentsView() {
  return (
    <div className="grid gap-4">
      <Heading eyebrow="Rosa · 78 años" title="Consultas" action="Nueva cita" />
      <ul className="grid gap-2">
        <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-soft text-center leading-tight">
            <span className="font-display text-xl font-bold">2</span>
            <span className="text-xs font-semibold">dic</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Control con cardiología</p>
            <p className="text-sm text-muted">Martes, 10:30 a. m. · Clínica de ejemplo</p>
          </div>
          <Pill tone="ok">Recordatorio móvil</Pill>
        </li>
        <li className="flex items-center gap-4 rounded-2xl border border-line bg-card px-4 py-3 opacity-80">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-tint text-center leading-tight">
            <span className="font-display text-xl font-bold">14</span>
            <span className="text-xs font-semibold">nov</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Control de presión</p>
            <p className="text-sm text-muted">Consulta pasada · con resumen preparado</p>
          </div>
        </li>
      </ul>
      <p className="flex items-center gap-2 text-sm text-muted">
        <Icon name="bell" className="h-4 w-4" /> Puedes activar un recordatorio en tu dispositivo.
      </p>
    </div>
  )
}

function SummaryView() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid content-start gap-3">
        <Heading eyebrow="Para la consulta del 2 de diciembre" title="Resumen para el médico" />
        <ul className="grid gap-2 text-sm">
          {['Medicación · 3 registros', 'Alergias · 1 registro', 'Cambios desde la última consulta'].map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2">
              <Icon name="check" className="h-4 w-4 text-primary-fg" /> {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">Solo se comparte lo que elegiste.</p>
      </div>
      <div className="grid content-start gap-3 rounded-2xl border border-line bg-card p-4 text-center">
        <p className="text-sm font-semibold">Código de acceso</p>
        <p className="font-display text-3xl font-bold tracking-[0.18em] tabular-nums">482 913</p>
        <p className="text-xs text-muted">Se renueva cada 30 segundos y se usa una sola vez.</p>
        <p className="flex items-center justify-center gap-2 rounded-xl bg-primary-tint px-3 py-2 text-xs font-semibold text-soft-text">
          <Icon name="clock" className="h-4 w-4" /> El enlace vence en 24 horas
        </p>
      </div>
    </div>
  )
}

const VIEWS: { id: string; label: string; icon: IconName; caption: string; component: ComponentType }[] = [
  { id: 'inicio', label: 'Inicio', icon: 'home', caption: 'Al entrar ves la próxima cita, los avisos y a las personas que cuidas.', component: DashboardView },
  { id: 'medicacion', label: 'Medicación', icon: 'medkit', caption: 'Cada medicamento con su dosis, su frecuencia y si ya está confirmado.', component: MedicationView },
  { id: 'recetas', label: 'Recetas', icon: 'camera', caption: 'Yuyay lee la foto de la receta; tú revisas y confirmas cada dato.', component: OcrView },
  { id: 'familia', label: 'Familia', icon: 'users', caption: 'Invita a otros cuidadores por correo; el principal decide quién entra.', component: FamilyView },
  { id: 'citas', label: 'Citas', icon: 'calendar', caption: 'Anota las consultas y activa recordatorios en el móvil.', component: AppointmentsView },
  { id: 'resumen', label: 'Resumen', icon: 'file', caption: 'Un enlace temporal con código: el médico lo abre sin crear una cuenta.', component: SummaryView },
]

/** Ventana de navegador que enmarca una vista de ejemplo de la app. */
export function AppFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[var(--shadow-soft)]', className)}>
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          {['bg-[#F49AB8]', 'bg-[#F5C96A]', 'bg-[#9DD6B4]'].map((color) => (
            <span key={color} className={cx('h-2.5 w-2.5 rounded-full', color)} />
          ))}
        </span>
        <span className="mx-auto rounded-full bg-surface px-3 py-0.5 text-xs text-muted">Yuyay · datos de ejemplo</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  )
}

/** Selector de funcionalidades: pestañas accesibles (flechas, Inicio y Fin) que cambian la vista. */
export function ProductDemo() {
  const [selected, setSelected] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const view = VIEWS[selected]
  const View = view.component

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = VIEWS.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (selected === last ? 0 : selected + 1)
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (selected === 0 ? last : selected - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    setSelected(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <div role="tablist" aria-label="Vistas de la app" className="flex min-w-0 flex-wrap gap-2 lg:grid">
        {VIEWS.map((item, index) => {
          const isSelected = index === selected
          return (
            <button
              key={item.id}
              ref={(element) => {
                tabs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`demo-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls="demo-panel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(index)}
              onKeyDown={onKeyDown}
              className={cx(
                'flex min-h-11 shrink-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left font-semibold transition-colors',
                focusRing,
                isSelected ? 'border-primary bg-primary text-white' : 'border-line bg-card hover:border-primary-fg/50',
              )}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </button>
          )
        })}
      </div>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${view.id}`} tabIndex={0} className={cx('grid min-w-0 gap-3 rounded-[1.75rem]', focusRing)}>
        <AppFrame>
          <div key={view.id} className="landing-fade">
            <View />
          </div>
        </AppFrame>
        <p className="landing-lead text-center lg:text-left" aria-live="polite">{view.caption}</p>
      </div>
    </div>
  )
}
