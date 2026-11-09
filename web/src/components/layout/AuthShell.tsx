import type { ReactNode } from 'react'
import { Logo } from '../ui/Brand'
import { ThemeToggle } from './ThemeToggle'

/** Estrella de 4 puntas, el motivo visual de Yuyay (igual que en la app móvil). */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M12 1.5c.7 5.2 4 8.6 9.2 9.5-5.2.9-8.5 4.3-9.2 9.5C11.3 15.3 8 11.9 2.8 11 8 10.1 11.3 6.7 12 1.5Z"
      />
    </svg>
  )
}

/** Marco de las pantallas de acceso, como en la app: cabecera con degradado, saludo y el formulario debajo. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-hero-from via-hero-via to-hero-to px-6 pt-6 pb-16 text-on-hero sm:px-8">
        <Sparkle className="absolute top-20 right-10 h-5 w-5 text-white/70" />
        <Sparkle className="absolute right-36 bottom-20 h-3 w-3 text-cream" />
        <div aria-hidden="true" className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-white/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <Logo onHero />
          <ThemeToggle />
        </div>
        <h1 className="relative mt-8 text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="relative mt-2 text-on-hero-soft">{subtitle}</p>
      </section>
      <div className="relative -mt-10 px-2 sm:px-4">{children}</div>
      {footer ? <div className="mt-6 text-center text-sm">{footer}</div> : null}
    </main>
  )
}
