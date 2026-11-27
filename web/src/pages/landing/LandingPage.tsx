import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { OfflineBanner } from '../../components/layout/OfflineBanner'
import { Logo } from '../../components/ui/Brand'
import { cx } from '../../components/ui/cx'
import { Icon } from '../../components/ui/Icon'
import { focusRing, linkButtonClass, linkSecondaryClass } from '../../utils/styles'
import { LandingHeader } from './LandingHeader'
import { art, FACTS, FEATURES, STEPS, TEAM } from './landingContent'

type Art = { src: string; width: number; height: number }

/** Ilustración de la presentación. Las que acompañan a un texto son decorativas (alt vacío). */
function Illustration({ image, alt = '', className, eager = false }: { image: Art; alt?: string; className?: string; eager?: boolean }) {
  return (
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('h-auto w-full', className)}
    />
  )
}

/** Estrella de cuatro puntas de la presentación. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx('fill-current', className)}>
      <path d="M12 0c.7 6.2 3.8 9.3 12 12-8.2 2.7-11.3 5.8-12 12-.7-6.2-3.8-9.3-12-12C8.2 9.3 11.3 6.2 12 0Z" />
    </svg>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-primary-fg sm:text-sm">{children}</p>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-sm font-medium text-muted">{children}</p>
}

function Section({
  id,
  band,
  className,
  children,
  label,
}: {
  id?: string
  band: 'light' | 'dark' | 'lilac'
  className?: string
  children: ReactNode
  label?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={label}
      className={cx('relative scroll-mt-20 overflow-hidden px-4 py-20 sm:px-6 sm:py-28', `band-${band}`, className)}
    >
      <div className="relative mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

const title = 'font-display text-3xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl'

function Hero() {
  return (
    <Section id="que-es" band="light" className="pt-12 sm:pt-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="reveal">
          <Eyebrow>Yuyay · quechua · «recordar»</Eyebrow>
          <p aria-hidden="true" className="font-display text-7xl font-bold leading-none tracking-tight sm:text-8xl lg:text-9xl">
            Yuyay
          </p>
          <h1 className="mt-6 max-w-xl font-display text-2xl font-semibold leading-snug text-balance sm:text-3xl">
            Una memoria de salud para cuidar de ti y de los tuyos
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Organiza la información de salud de tu familia, coordínate con los demás cuidadores y llega
            preparado a cada consulta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={linkButtonClass}>
              Crear cuenta gratis
              <Icon name="chevron-right" />
            </Link>
            <Link to="/login" className={linkSecondaryClass}>
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted">Sin anuncios · El médico no necesita una cuenta</p>
        </div>

        <div className="reveal relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
          {/* Círculos concéntricos de la portada de la presentación */}
          <div className="absolute inset-0 -z-0 flex items-center justify-center">
            {[100, 78, 56].map((size) => (
              <span key={size} className="absolute aspect-square rounded-full border border-primary-fg/30" style={{ width: `${size}%` }} />
            ))}
          </div>
          <Illustration image={art.abueloHija} eager className="relative mx-auto max-w-sm" />
          <div className="landing-float absolute -left-2 top-6 max-w-[14rem] rounded-2xl bg-card p-3 text-sm shadow-[var(--shadow-soft)] sm:-left-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">14 mar · Ana, hija</p>
            <p className="font-semibold">Losartán 100 mg</p>
            <span className="mt-1 inline-block rounded-full bg-accent-tint px-2 py-0.5 text-xs font-semibold text-accent-text">Confirmado</span>
          </div>
          <div className="landing-float absolute -right-2 bottom-8 max-w-[14rem] rounded-2xl bg-card p-3 text-sm shadow-[var(--shadow-soft)] [animation-delay:-2.5s] sm:-right-4">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <Icon name="calendar" className="h-3.5 w-3.5" /> Próxima consulta
            </p>
            <p className="font-semibold">Endocrinología · 28 mar</p>
          </div>
          <Sparkle className="absolute right-10 top-0 h-8 w-8 text-primary-fg" />
          <Sparkle className="absolute bottom-0 left-12 h-5 w-5 text-primary-fg/70" />
        </div>
      </div>
    </Section>
  )
}

function Scene() {
  return (
    <Section band="dark" label="escena-titulo">
      <div aria-hidden="true" className="landing-dots absolute -right-24 bottom-0 h-[28rem] w-[28rem] text-primary-fg/60" />
      <div className="grid items-end gap-10 lg:grid-cols-2">
        <div className="reveal">
          <Eyebrow>Consultorio · 10:40 a. m.</Eyebrow>
          <h2 id="escena-titulo" className={title}>«¿Qué medicamento está tomando ahora?»</h2>
          <p className="mt-6 max-w-md text-lg text-muted">
            Lo pregunta el médico. Quien acompaña no está seguro: la última receta la guardó otro familiar.
          </p>
          <Note>Escena ilustrativa · no es un testimonio real</Note>
        </div>
        <Illustration
          image={art.escena}
          alt="Ilustración: una adulta mayor y su hija, que duda con el celular en la mano, frente a una doctora."
          className="reveal relative"
        />
      </div>
    </Section>
  )
}

function Facts() {
  return (
    <Section id="por-que" band="dark" label="datos-titulo">
      <Eyebrow>¿Por qué Yuyay?</Eyebrow>
      <h2 id="datos-titulo" className={cx(title, 'reveal max-w-3xl')}>Cuidar a alguien es más común de lo que crees.</h2>
      <p className="reveal mt-4 max-w-2xl text-lg text-muted">Esto dicen las cifras oficiales del Perú.</p>
      <ul className="mt-12 grid gap-6 md:grid-cols-3">
        {FACTS.map((fact) => (
          <li key={fact.value} className="reveal overflow-hidden rounded-3xl border border-primary-fg/30 bg-card">
            <Illustration image={fact.image} className="bg-[#EFEBFA]" />
            <div className="p-6">
              <p className="font-display text-5xl font-bold tracking-tight">{fact.value}</p>
              <p className="mt-2 text-muted">{fact.text}</p>
              <p className="mt-4 border-l-4 border-primary-fg pl-3 font-semibold">{fact.why}</p>
              <p className="mt-4 inline-block rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-soft-text">
                Fuente:{' '}
                {fact.url ? (
                  <a href={fact.url} target="_blank" rel="noopener noreferrer" className={`rounded-sm underline underline-offset-2 ${focusRing}`}>
                    {fact.source}
                    <span className="sr-only"> (abre el informe en otra pestaña)</span>
                  </a>
                ) : fact.source}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Steps() {
  return (
    <Section id="que-hace" band="light" label="pasos-titulo">
      <Eyebrow>Qué hace la app</Eyebrow>
      <h2 id="pasos-titulo" className={cx(title, 'reveal')}>Yuyay funciona en tres pasos.</h2>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.title} className="reveal overflow-hidden rounded-3xl border border-primary-fg/25 bg-card shadow-[var(--shadow-soft)]">
            <Illustration image={step.image} className="bg-[#EFEBFA]" />
            <div className="p-6">
              <h3 className="text-2xl font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="reveal mt-16 font-display text-2xl font-bold sm:text-3xl">Todo lo que puedes hacer</h3>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="reveal flex gap-4 rounded-3xl border border-primary-fg/20 bg-card p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary-fg">
              <Icon name={feature.icon} className="h-6 w-6" />
            </span>
            <div>
              <h4 className="text-lg font-bold">{feature.title}</h4>
              <p className="mt-1 text-muted">{feature.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="reveal mt-10 text-center text-lg font-semibold">
        El médico no tiene que instalar ni aprender nada: quien acompaña le muestra el resumen.
      </p>
    </Section>
  )
}

const initials = (name: string) => name.split(' ').filter((_, i, all) => i === 0 || i === all.length - 2).map((part) => part[0]).join('')

function Team() {
  return (
    <Section id="equipo" band="light" label="equipo-titulo">
      <Eyebrow>Quiénes somos</Eyebrow>
      <h2 id="equipo-titulo" className={cx(title, 'reveal')}>El equipo detrás de Yuyay</h2>
      <p className="reveal mt-4 max-w-2xl text-lg text-muted">
        Yuyay nació como proyecto del curso CS2031 Desarrollo Basado en Plataformas de la UTEC (Lima, 2026).
        Todas las demostraciones usan datos ficticios.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM.map((name) => (
          <li key={name} className="reveal flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] lg:flex-col lg:text-center">
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-lg font-bold text-primary-fg">
              {initials(name)}
            </span>
            <p className="font-semibold leading-snug">{name}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Closing() {
  return (
    <Section band="lilac" label="cierre-titulo">
      <div aria-hidden="true" className="landing-dots absolute -right-20 -bottom-20 h-[26rem] w-[26rem] text-[#6A64C2]/50" />
      <div className="reveal relative">
        <Eyebrow>En la próxima consulta</Eyebrow>
        <p className="font-display text-2xl font-bold sm:text-3xl">«¿Qué medicamento está tomando ahora?»</p>
        <h2 id="cierre-titulo" className="mt-4 max-w-3xl font-serif text-5xl leading-[1.05] sm:text-7xl">
          La respuesta estará en tu memoria de salud.
        </h2>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/register" className={linkButtonClass}>
            Crear cuenta gratis
            <Icon name="chevron-right" />
          </Link>
          <Link to="/login" className={`rounded-full px-4 py-3 font-semibold underline underline-offset-4 ${focusRing}`}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </Section>
  )
}

function Footer() {
  return (
    <footer className="band-dark px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 font-semibold">Recordar, juntos.</p>
          <p className="mt-4 max-w-md text-sm text-muted">
            Yuyay no es historia clínica oficial, telemedicina ni diagnóstico. Proyecto académico · UTEC · 2026.
          </p>
        </div>
        <nav aria-label="Cuenta" className="flex gap-4 text-sm font-semibold">
          <Link to="/login" className={`rounded-sm underline-offset-4 hover:underline ${focusRing}`}>Iniciar sesión</Link>
          <Link to="/register" className={`rounded-sm underline-offset-4 hover:underline ${focusRing}`}>Crear cuenta</Link>
        </nav>
      </div>
    </footer>
  )
}

/** Muestra cada bloque al entrar en pantalla. Sin IntersectionObserver (o en pruebas) todo queda visible. */
function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = root.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -10% 0px' })
    element.querySelectorAll('.reveal').forEach((item) => observer.observe(item))
    element.classList.add('reveal-ready')
    return () => observer.disconnect()
  }, [])
  return root
}

/** Página de inicio para quien no ha iniciado sesión: qué es Yuyay, cómo funciona y cómo crear una cuenta. */
export default function LandingPage() {
  const root = useReveal()
  return (
    <div ref={root} className="min-h-svh text-ink">
      <LandingHeader />
      <OfflineBanner />
      <main>
        <Hero />
        <Scene />
        <Steps />
        <Facts />
        <Team />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}
