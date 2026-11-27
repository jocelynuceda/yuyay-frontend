import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AccountTermsDialog } from '../../components/AccountTerms'
import { OfflineBanner } from '../../components/layout/OfflineBanner'
import { Logo } from '../../components/ui/Brand'
import { cx } from '../../components/ui/cx'
import { Icon, type IconName } from '../../components/ui/Icon'
import { LionAvatar } from '../../components/ui/LionAvatar'
import { useAccountTerms } from '../../hooks/useAccountTerms'
import { focusRing, linkButtonClass, linkClass, linkSecondaryClass } from '../../utils/styles'
import { LandingHeader } from './LandingHeader'
import { art, FACTS, FAQ, LANDING_NAV, PRIVACY, SCATTERED, STEPS, TEAM } from './landingContent'
import { Pill, ProductDemo } from './ProductDemo'

type Art = { src: string; width: number; height: number }
type Band = 'light' | 'plain' | 'sky' | 'dark' | 'lilac'

/** Ilustración con su tamaño real (sin saltos al cargar). Las que acompañan a un texto son decorativas. */
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

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary-fg sm:text-sm">{children}</p>
}

function Section({ id, band, label, className, children }: { id?: string; band: Band; label: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={label} className={cx('landing-section overflow-hidden', `band-${band}`, className)}>
      <div className="landing-container relative">{children}</div>
    </section>
  )
}

/** Título y bajada de una sección, con el mismo ritmo en todas. */
function SectionHeading({ id, eyebrow, title, lead, center = false }: { id: string; eyebrow: string; title: string; lead?: string; center?: boolean }) {
  return (
    <div className={cx('reveal max-w-2xl', center && 'mx-auto text-center')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="landing-title">{title}</h2>
      {lead ? <p className="landing-lead mt-4">{lead}</p> : null}
    </div>
  )
}

// ---- 1. Hero ----

function HeroVisual() {
  return (
    <div className="reveal relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="relative overflow-hidden rounded-[2rem] bg-soft/70 dark:bg-soft">
        <div aria-hidden="true" className="landing-dots absolute -right-16 -top-16 h-72 w-72 text-primary-fg/40" />
        <Illustration
          image={art.abueloHija}
          eager
          alt="Ilustración: un adulto mayor sonríe junto a su hija, que lo acompaña."
          className="relative mx-auto max-w-md px-6 pt-6"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Tarjeta con la misma forma que la ficha de una persona en la app (datos ficticios) */}
        <div className="rounded-3xl border border-line bg-card p-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-3">
            <LionAvatar avatar={{ kind: 'elder', variant: 'lion' }} size="md" />
            <div>
              <p className="font-semibold leading-tight">Don Julio · 81 años</p>
              <p className="text-xs text-muted">Medicación · 2 registros</p>
            </div>
          </div>
          <ul className="mt-3 grid gap-2 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
              <span className="font-semibold">Losartán 50 mg</span> <Pill tone="ok">Confirmado</Pill>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2">
              <span className="font-semibold">Metformina 850 mg</span> <Pill tone="pending">Por confirmar</Pill>
            </li>
          </ul>
        </div>

        <div className="grid content-start gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
            <LionAvatar avatar={{ kind: 'adult', variant: 'lioness' }} size="sm" />
            <p><span className="font-semibold">Lucía</span> actualizó una dosis · hace 2 h</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-soft text-ink">
              <Icon name="calendar" className="h-4 w-4" />
            </span>
            <p><span className="font-semibold">Cardiología</span> · mar 2 dic</p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-right text-xs text-muted">Datos de ejemplo</p>
    </div>
  )
}

function Hero() {
  const trust = ['Sin anuncios', 'El médico no necesita una cuenta', 'Tú decides qué compartir']
  return (
    <section id="que-es" aria-labelledby="hero-titulo" className="landing-section band-light -mt-14 overflow-hidden pt-[calc(var(--landing-section-y)+3.5rem)]">
      <div className="landing-container grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="reveal">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-sm text-muted">
            <span className="font-semibold text-ink">Yuyay</span> significa «recordar» en quechua
          </p>
          <h1 id="hero-titulo" className="font-display text-[clamp(2.5rem,1.7rem+3.6vw,4.25rem)] font-bold leading-[1.02] tracking-tight text-balance">
            La salud de tu familia, en un solo lugar.
          </h1>
          <p className="landing-lead mt-5 max-w-xl text-[clamp(1.0625rem,1rem+0.35vw,1.25rem)]">
            Organiza medicamentos, recetas y citas médicas. Comparte el cuidado con tu familia y llega preparado a cada consulta.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={linkButtonClass}>
              Comenzar gratis
              <Icon name="chevron-right" />
            </Link>
            <a href="#como-funciona" className={linkSecondaryClass}>
              Ver cómo funciona
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {trust.map((text) => (
              <li key={text} className="flex items-center gap-1.5">
                <Icon name="check" className="h-4 w-4 text-primary-fg" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  )
}

// ---- 2. Problema ----

function Problem() {
  return (
    <Section band="dark" label="escena-titulo">
      <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="reveal">
          <Eyebrow>Consultorio · 10:40 a. m.</Eyebrow>
          <h2 id="escena-titulo" className="landing-title">«¿Qué medicamento está tomando ahora?»</h2>
          <p className="landing-lead mt-4 max-w-md">
            Lo pregunta el médico. Quien acompaña no está seguro: la información existe, pero está repartida.
          </p>
          <ul className="mt-6 grid gap-2">
            {SCATTERED.map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-2xl border border-line bg-card/60 px-4 py-3">
                <Icon name={icon} className="h-5 w-5 text-primary-fg" />
                {text}
              </li>
            ))}
          </ul>
          <a href="#como-funciona" className={cx('mt-6 inline-flex items-center gap-2 rounded-sm font-semibold text-primary-fg underline-offset-4 hover:underline', focusRing)}>
            Yuyay lo reúne en un solo lugar
            <Icon name="chevron-right" className="h-4 w-4" />
          </a>
        </div>
        <figure className="reveal">
          <Illustration
            image={art.escena}
            alt="Ilustración: una adulta mayor y su hija, que duda con el celular en la mano, frente a una doctora."
            className="rounded-3xl"
          />
          <figcaption className="mt-3 text-sm text-muted">Escena ilustrativa · no es un testimonio real</figcaption>
        </figure>
      </div>
    </Section>
  )
}

// ---- 3. Cómo funciona ----

function Steps() {
  return (
    <Section id="como-funciona" band="plain" label="pasos-titulo">
      <SectionHeading id="pasos-titulo" eyebrow="Cómo funciona" title="Tres pasos para cuidar en equipo." />
      {/* Las ilustraciones ya llevan el número del paso (01, 02, 03); el texto lo repite para lectores de pantalla */}
      <ol className="mt-10 grid gap-[var(--landing-gap)] md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="landing-card reveal overflow-hidden">
            <div className="aspect-[3/2] bg-[#EFEBFA]">
              <Illustration image={step.image} className="h-full object-contain" />
            </div>
            <div className="p-5">
              <h3 className="font-display text-xl font-bold">
                <span className="sr-only">Paso {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

// ---- 4. Producto ----

function Demo() {
  return (
    <Section id="producto" band="sky" label="producto-titulo">
      <SectionHeading
        id="producto-titulo"
        eyebrow="La app por dentro"
        title="Conoce tu nueva memoria de salud."
        lead="Así se ven las pantallas de Yuyay. Elige una para recorrerla; todos los datos son de ejemplo."
      />
      <div className="reveal mt-10">
        <ProductDemo />
      </div>
    </Section>
  )
}

// ---- 5. Funcionalidades ----

function FeatureCard({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <li className="landing-card reveal flex min-w-0 flex-col p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-fg">
          <Icon name={icon} className="size-5" />
        </span>
        <h3 className="font-display text-lg leading-tight font-bold sm:text-xl">{title}</h3>
      </div>
      <p className="mt-3 leading-relaxed text-muted">{text}</p>
      {children && <div aria-hidden="true" className="mt-auto flex flex-wrap gap-2 pt-4">{children}</div>}
    </li>
  )
}

function Features() {
  return (
    <Section id="funcionalidades" band="light" label="funciones-titulo">
      <SectionHeading id="funciones-titulo" eyebrow="Funcionalidades" title="Todo lo que necesitas para cuidar mejor." />
      <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard icon="file" title="Información de salud" text="Reúne medicamentos, alergias, vacunas y exámenes en el perfil de cada persona.">
          <Pill tone="neutral">Medicación registrada</Pill>
          <Pill tone="sky">Alergias confirmadas</Pill>
        </FeatureCard>
        <FeatureCard icon="users" title="Cuidado en familia" text="Invita a otros cuidadores para organizar juntos la información de salud.">
          <Pill tone="sky">Cuidadora principal</Pill>
          <Pill tone="neutral">Invitación pendiente</Pill>
        </FeatureCard>
        <FeatureCard icon="history" title="Historial de cambios" text="Consulta quién actualizó un registro, cuándo lo hizo y qué se guardó antes." />
        <FeatureCard icon="camera" title="Digitalización de recetas" text="Yuyay lee el texto de una foto. Revisa y confirma los datos antes de guardarlos.">
          <Pill tone="neutral">Receta fotografiada</Pill>
          <Pill tone="pending">Por revisar</Pill>
        </FeatureCard>
        <FeatureCard icon="calendar" title="Citas y recordatorios" text="Consulta la agenda y activa recordatorios de citas en el móvil." />
        <FeatureCard icon="link" title="Resumen para el médico" text="Elige qué registros compartir y envía un enlace temporal que el médico puede abrir sin cuenta.">
          <Pill tone="sky">Medicación y alergias</Pill>
          <Pill tone="neutral">Enlace temporal</Pill>
        </FeatureCard>
      </ul>
    </Section>
  )
}

// ---- 6. Cifras ----

function Facts() {
  return (
    <Section id="por-que" band="sky" label="datos-titulo">
      <SectionHeading id="datos-titulo" eyebrow="¿Por qué Yuyay?" title="Cuidar a alguien es más común de lo que crees." lead="Esto dicen las cifras oficiales del Perú." />
      <ul className="mt-10 grid gap-[var(--landing-gap)] md:grid-cols-3">
        {FACTS.map((fact) => (
          <li key={fact.value} className="landing-card reveal grid content-start gap-3 p-6">
            <Illustration image={fact.image} className="mb-1 max-w-24 rounded-xl" />
            <p className="font-display text-[clamp(2.25rem,1.8rem+1.4vw,3.25rem)] font-bold leading-none tracking-tight">{fact.value}</p>
            <p className="text-muted">{fact.text}</p>
            <p className="border-l-4 border-primary-fg pl-3 font-semibold">{fact.why}</p>
            <p className="mt-1 w-fit rounded-full bg-primary-tint px-3 py-1 text-xs font-semibold text-soft-text">
              Fuente:{' '}
              {fact.url ? (
                <a href={fact.url} target="_blank" rel="noopener noreferrer" className={`rounded-sm underline underline-offset-2 ${focusRing}`}>
                  {fact.source}
                  <span className="sr-only"> (abre el informe en otra pestaña)</span>
                </a>
              ) : fact.source}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ---- 7. Privacidad ----

function Privacy({ onTerms }: { onTerms: () => void }) {
  return (
    <Section id="privacidad" band="plain" label="privacidad-titulo">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <div className="reveal grid content-start gap-5">
          <div>
            <Eyebrow>Privacidad</Eyebrow>
            <h2 id="privacidad-titulo" className="landing-title">Tu salud. Tus datos. Tú decides.</h2>
            <p className="landing-lead mt-4">
              La información de salud es delicada. Por eso nada se comparte sin que lo elijas, y todo queda registrado.
            </p>
          </div>
          <button type="button" onClick={onTerms} className={cx(linkClass, 'justify-self-start text-left')}>
            Leer los términos de uso y el aviso de privacidad
          </button>
          <p className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
            <Icon name="alert" className="mt-0.5 h-5 w-5 text-primary-fg" />
            <span>
              Yuyay organiza información de salud. <strong>No sustituye</strong> el diagnóstico, el tratamiento ni las indicaciones de un profesional de la salud.
            </span>
          </p>
        </div>
        <ul className="grid gap-[var(--landing-gap)] sm:grid-cols-2">
          {PRIVACY.map((item) => (
            <li key={item.title} className="reveal flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-soft text-ink">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ---- 8. Preguntas frecuentes ----

function Faq() {
  return (
    <Section id="preguntas" band="plain" label="faq-titulo">
      <div className="grid items-start gap-6 lg:grid-cols-[0.65fr_1fr] lg:gap-12">
        <div>
          <h2 id="faq-titulo" className="landing-title">Preguntas frecuentes</h2>
          <Illustration
            image={{ src: '/landing/preguntas-frecuentes.webp', width: 1050, height: 700 }}
            className="mt-5 max-w-md rounded-3xl"
          />
        </div>
        <div className="divide-y divide-line rounded-3xl border border-line bg-card px-4 sm:px-6">
          {FAQ.map(({ q, a }) => (
            <details key={q}>
              <summary className={cx('cursor-pointer rounded-md py-4 font-semibold marker:text-primary-fg', focusRing)}>{q}</summary>
              <p className="max-w-prose pb-4 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ---- 9. Equipo ----

const initials = (name: string) => name.split(' ').filter((_, i, all) => i === 0 || i === all.length - 2).map((part) => part[0]).join('')

function Team() {
  return (
    <Section id="nosotros" band="light" label="equipo-titulo">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div className="reveal">
          <Eyebrow>Nosotros</Eyebrow>
          <h2 id="equipo-titulo" className="landing-title">Hecho por estudiantes de la UTEC.</h2>
          <p className="landing-lead mt-4">
            Yuyay nació en el curso CS2031 Desarrollo Basado en Plataformas (Lima, 2026), a partir de una pregunta que muchas
            familias conocen: ¿quién tiene la última receta?
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {TEAM.map((name) => (
            <li key={name} className="reveal flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display font-bold text-primary-fg">
                {initials(name)}
              </span>
              <p className="font-semibold leading-snug">{name}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

// ---- 10. Cierre ----

function Closing() {
  return (
    <Section band="lilac" label="cierre-titulo">
      <div aria-hidden="true" className="landing-dots absolute -bottom-24 -right-20 h-[24rem] w-[24rem] text-[#1E2158]/30 dark:text-white/20" />
      <div className="reveal relative max-w-3xl">
        <p className="font-semibold">«¿Qué medicamento está tomando ahora?»</p>
        <h2 id="cierre-titulo" className="landing-title mt-3 text-[clamp(2.25rem,1.6rem+2.8vw,3.5rem)]">
          En tu próxima consulta, recuerda lo que importa.
        </h2>
        <p className="landing-lead mt-4">Tu información de salud organizada, disponible y lista para compartir.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to="/register" className={linkButtonClass}>
            Crear cuenta gratis
            <Icon name="chevron-right" />
          </Link>
          <Link to="/login" className={cx('inline-flex min-h-12 items-center rounded-full px-5 font-semibold underline underline-offset-4', focusRing)}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </Section>
  )
}

// ---- 11. Footer ----

const footerLink = `rounded-sm text-sm underline-offset-4 hover:underline ${focusRing}`

function Footer({ onTerms }: { onTerms: () => void }) {
  return (
    <footer className="band-dark px-4 py-12 sm:px-6">
      <div className="landing-container grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="font-semibold">Recordar, juntos.</p>
          <p className="max-w-sm text-sm text-muted">
            Proyecto académico del curso CS2031 Desarrollo Basado en Plataformas · UTEC · Lima, 2026. Las demostraciones usan
            datos ficticios. Yuyay no es historia clínica oficial y no sustituye la atención médica.
          </p>
        </div>
        <nav aria-label="Secciones de la página">
          <p className="text-sm font-semibold">Explora</p>
          <ul className="mt-3 grid gap-2 text-muted">
            {LANDING_NAV.map((item) => (
              <li key={item.id}><a href={`#${item.id}`} className={footerLink}>{item.label}</a></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold">Cuenta y legal</p>
          <ul className="mt-3 grid gap-2 text-muted">
            <li><Link to="/register" className={footerLink}>Crear cuenta</Link></li>
            <li><Link to="/login" className={footerLink}>Iniciar sesión</Link></li>
            <li>
              <button type="button" onClick={onTerms} className={cx(footerLink, 'text-left')}>
                Términos de uso y aviso de privacidad
              </button>
            </li>
          </ul>
        </div>
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
  // Los términos y el aviso de privacidad son públicos: se leen en el mismo diálogo del registro
  const terms = useAccountTerms()
  return (
    <div ref={root} className="landing-root min-h-svh text-ink">
      <LandingHeader />
      <OfflineBanner />
      <main>
        <Hero />
        <Problem />
        <Steps />
        <Demo />
        <Features />
        <Facts />
        <Privacy onTerms={terms.show} />
        <Faq />
        <Team />
        <Closing />
      </main>
      <Footer onTerms={terms.show} />
      <AccountTermsDialog terms={terms} />
    </div>
  )
}
