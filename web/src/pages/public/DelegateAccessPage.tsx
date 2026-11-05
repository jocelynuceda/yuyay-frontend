import axios from 'axios'
import { useEffect, useState } from 'react'
import { listDelegateHealthEntries } from '../../services/api/delegations'
import type { CategoryCode, DelegateSession, HealthEntry } from '../../types'
import { getErrorMessage } from '../../utils/apiErrors'
import { forgetDelegateSession, getDelegateSession } from '../../utils/delegateSession'
import { categoryLabels, confidenceLabels, formatDate, formatDateTime } from '../../utils/format'
import { focusRing, PublicShell, StatusPanel } from './PublicShell'

type State =
  | { status: 'loading' }
  | { status: 'error'; title: string; message: string }
  | { status: 'ready'; session: DelegateSession; entries: HealthEntry[] }

/**
 * Vista del delegado (/acceso/:token). Canjea el enlace y muestra solo los registros
 * de las categorías que la familia permitió.
 */
export function DelegateAccessPage({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [category, setCategory] = useState<CategoryCode | 'ALL'>('ALL')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const session = await getDelegateSession(token)
        const entries = await listDelegateHealthEntries(session.accessToken)
        if (active) setState({ status: 'ready', session, entries })
      } catch (error) {
        if (!active) return
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        // 401: el acceso guardado venció o fue revocado
        if (status === 401) forgetDelegateSession(token)
        setState({ status: 'error', ...describeError(status, getErrorMessage(error)) })
      }
    }
    load()
    return () => {
      active = false
    }
  }, [token])

  if (state.status === 'loading') {
    return (
      <PublicShell>
        <StatusPanel title="Abriendo el acceso…" />
      </PublicShell>
    )
  }
  if (state.status === 'error') {
    return (
      <PublicShell>
        <StatusPanel tone="error" title={state.title} message={state.message} />
      </PublicShell>
    )
  }

  const { session, entries } = state
  const visible = category === 'ALL' ? entries : entries.filter((e) => e.categoryCode === category)

  return (
    <PublicShell>
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Acceso delegado</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{session.careSubjectName}</h1>
        <p className="mt-2 text-muted">
          Hola, {session.granteeName}. Acceso vigente hasta el {formatDateTime(session.expiresAt)}
        </p>
        <p role="note" className="mt-4 rounded-xl bg-soft/60 px-4 py-3 text-sm text-soft-text">
          Por seguridad, el acceso se cierra al cerrar esta pestaña y el enlace solo se puede abrir una vez. Puedes
          recargar la página sin perderlo.
        </p>
      </header>

      <nav aria-label="Filtrar por categoría" className="mt-6 flex flex-wrap gap-2">
        {(['ALL', ...session.categoryCodes] as const).map((code) => {
          const selected = category === code
          return (
            <button
              key={code}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(code)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${focusRing} ${
                selected ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-primary'
              }`}
            >
              {code === 'ALL' ? 'Todas' : (categoryLabels[code]?.plural ?? code)}
            </button>
          )
        })}
      </nav>

      <section aria-live="polite" className="mt-6">
        {visible.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-muted">No hay registros en esta categoría.</p>
        ) : (
          <ul className="grid gap-3">
            {visible.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </PublicShell>
  )
}

function EntryCard({ entry }: { entry: HealthEntry }) {
  const v = entry.latestVersion
  const facts = [v.dose && `Dosis: ${v.dose}`, v.frequency].filter(Boolean).join(' · ')
  return (
    <li className="rounded-2xl bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{entry.categoryName}</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-xl font-semibold">{v.title}</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            v.confidenceLevel === 'CONFIRMED' ? 'bg-accent-tint text-accent-text' : 'bg-soft text-soft-text'
          }`}
        >
          {confidenceLabels[v.confidenceLevel]}
        </span>
      </div>
      {facts ? <p className="mt-2 font-semibold">{facts}</p> : null}
      {v.details ? <p className="mt-2 whitespace-pre-line">{v.details}</p> : null}
      <p className="mt-3 text-sm text-muted">
        {v.occurredOn ? `Fecha: ${formatDate(v.occurredOn)} · ` : ''}Actualizado por {v.declaredBy.name} el{' '}
        {formatDate(v.declaredAt)}
      </p>
    </li>
  )
}

function describeError(status: number | undefined, message: string) {
  switch (status) {
    case 404:
      return { title: 'Enlace no válido', message: 'Revisa que el enlace esté completo o pide uno nuevo a la familia.' }
    case 400:
      return {
        title: 'Este enlace ya se usó',
        message: `${message} Cada enlace se abre una sola vez y el acceso se cierra al cerrar la pestaña. Pide un enlace nuevo a la familia.`,
      }
    case 401:
    case 403:
      return { title: 'El acceso ya no está vigente', message: 'Venció o la familia lo revocó. Pide un enlace nuevo.' }
    default:
      return { title: 'No pudimos abrir el acceso', message }
  }
}
