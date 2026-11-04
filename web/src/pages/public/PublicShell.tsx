import type { ReactNode } from 'react'

/** Marco de las páginas públicas (sin sesión): logo, contenido centrado y aviso de privacidad. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-surface text-ink">
      <header className="border-b border-line bg-white/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-display text-2xl font-semibold text-primary">Yuyay</span>
          <span className="text-sm text-muted">Acceso de solo lectura</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10 text-sm text-muted sm:px-6">
        Información de salud compartida por su familia. Cada acceso queda registrado en la bitácora.
      </footer>
    </div>
  )
}

export function StatusPanel({ title, message, tone = 'info' }: { title: string; message?: string; tone?: 'info' | 'error' }) {
  return (
    <section
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-2xl p-6 ${tone === 'error' ? 'bg-danger-bg text-danger' : 'bg-white text-ink'}`}
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      {message ? <p className="mt-2 text-lg">{message}</p> : null}
    </section>
  )
}

/** Clase de foco visible y común a botones y campos. */
export const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary'
