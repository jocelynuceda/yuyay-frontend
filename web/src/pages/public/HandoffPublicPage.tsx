import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { getHandoffAccessRequirements, openHandoffSession, openHandoffSource } from '../../services/api/handoffs'
import { emptyOpenHandoff, openHandoffFields, openHandoffSchema, type OpenHandoffFormValues } from '../../schemas/handoff'
import type { CategoryCode, HandoffItem, HandoffPublicView, OpenHandoffRequest } from '../../types'
import { CATEGORY_CODES } from '../../types'
import { applyServerErrors, getErrorMessage } from '../../utils/apiErrors'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { focusRing } from '../../utils/styles'
import { PublicShell, StatusPanel } from './PublicShell'
import { SummaryPdfDownload } from './SummaryPdfDownload'
import { resumeReading, supportsReadingCookie } from '../../services/api/readingCookie'
import { ReadingCookiePanel } from './ReadingCookiePanel'
import { useReadingAvailability } from './useReadingAvailability'
import { isAccessLost } from '../../utils/accessStatus'

/**
 * Vista para el médico (/handoff/:token). Pide nombre y rol del visitante,
 * abre la sesión y muestra el resumen en letra grande y solo lectura.
 */
export function HandoffPublicPage({ token }: { token: string }) {
  return <HandoffSessionContent key={token} token={token} />
}

function HandoffSessionContent({ token }: { token: string }) {
  const [opened, setOpened] = useState<{ view: HandoffPublicView; deadline: number | null } | null>(null)
  const [closed, setClosed] = useState<'expired' | 'unavailable' | null>(null)
  const endReading = useCallback(() => { setOpened(null); setClosed('unavailable') }, [])
  const paused = useReadingAvailability(token, opened !== null, endReading)
  const [codeRequired, setCodeRequired] = useState<boolean>()
  const [rememberAvailable, setRememberAvailable] = useState(false)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getHandoffAccessRequirements(token, controller.signal)
      .then(async (required) => {
        if (controller.signal.aborted) return
        if (required && supportsReadingCookie()) {
          const startedAt = performance.now()
          try {
            const view = await resumeReading(token, controller.signal)
            if (controller.signal.aborted) return
            if (view) { acceptView(view, startedAt); return }
            setRememberAvailable(true)
          } catch {
            // El código permite continuar si el servidor aún no ofrece reanudación.
            if (controller.signal.aborted) return
          }
        }
        setCodeRequired(required)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (axios.isAxiosError(error) && isAccessLost(error.response?.status)) endReading()
        else setRequirementsError(getErrorMessage(error))
      })
    return () => controller.abort()
  }, [token, endReading])

  function acceptView(view: HandoffPublicView, startedAt: number) {
    const now = performance.now()
    const remaining = view.accessExpiresAt
      ? Date.parse(view.accessExpiresAt) - (view.serverTime ? Date.parse(view.serverTime) : Date.now()) - (now - startedAt)
      : null
    if (remaining !== null && (!Number.isFinite(remaining) || remaining <= 0)) {
      setClosed('expired')
      return
    }
    setClosed(null)
    setOpened({ view, deadline: remaining === null ? null : now + remaining })
  }

  useEffect(() => {
    if (opened?.deadline == null) return
    const deadline = opened.deadline
    const check = () => {
      if (performance.now() >= deadline) { setOpened(null); setClosed('expired') }
    }
    const timer = setTimeout(check, Math.max(0, deadline - performance.now()))
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [opened])

  return (
    <PublicShell compact>
      {closed === 'expired' && <StatusPanel tone="error" title="Terminó el tiempo de lectura" message="Si necesitas volver a consultar el resumen, pide un nuevo enlace a quien lo compartió." />}
      {closed === 'unavailable' && <StatusPanel tone="error" title="Ya no tienes acceso a este resumen" message="Si necesitas volver a leerlo, pide un nuevo enlace a quien lo compartió." />}
      {opened && paused && <StatusPanel title="Lectura en pausa" message="Estamos comprobando que el enlace siga activo. La lectura continuará cuando podamos confirmarlo." />}
      {opened && <div hidden={paused}>
        <HandoffSummary view={opened.view} token={token} deadline={opened.deadline} onUnavailable={endReading} />
        {opened.view.accessGrant && rememberAvailable && <ReadingCookiePanel token={token} grant={opened.view.accessGrant} />}
      </div>}
      {!opened && !closed && (requirementsError
        ? <StatusPanel title="No pudimos abrir el enlace" message={requirementsError} tone="error" />
        : codeRequired === undefined
          ? <StatusPanel title="Comprobando enlace…" />
          : <VisitorForm token={token} codeRequired={codeRequired} onOpened={acceptView} />)}
    </PublicShell>
  )
}

async function openTimedHandoff(token: string, request: OpenHandoffRequest) {
  const startedAt = performance.now()
  return { view: await openHandoffSession(token, request), startedAt }
}

function VisitorForm({ token, codeRequired, onOpened }: {
  token: string
  codeRequired: boolean
  onOpened: (view: HandoffPublicView, startedAt: number) => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OpenHandoffFormValues, unknown, z.output<typeof openHandoffSchema>>({
    resolver: zodResolver(openHandoffSchema),
    defaultValues: emptyOpenHandoff,
    mode: 'onTouched',
  })
  const accessCode = useWatch({ control, name: 'accessCode' }) ?? ''
  const codeComplete = accessCode.length === 6
  const accessCodeField = register('accessCode')

  const onSubmit = handleSubmit(async (values) => {
    if (codeRequired && !values.accessCode) return
    setServerError(null)
    try {
      const result = await openTimedHandoff(token, values)
      onOpened(result.view, result.startedAt)
    } catch (error) {
      setServerError(applyServerErrors(error, setError, openHandoffFields))
    }
  })

  return (
    <section className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-semibold">Abrir resumen compartido</h1>
      <p className="mt-3 text-lg text-muted">
        No necesitas una cuenta de Yuyay para leerlo. Tu nombre y rol quedan en la bitácora.
      </p>

      {serverError ? (
        <p role="alert" className="mt-6 rounded-xl bg-danger-bg p-4 text-lg text-danger">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-5">
        <Field label="Tu nombre" error={errors.visitorName?.message} id="visitorName">
          <input
            id="visitorName"
            autoComplete="name"
            placeholder="Dr. Pedro Ramos"
            maxLength={120}
            aria-invalid={!!errors.visitorName}
            aria-describedby={errors.visitorName ? 'visitorName-error' : undefined}
            className={inputClass(!!errors.visitorName)}
            {...register('visitorName')}
          />
        </Field>
        <Field label="Tu rol" error={errors.visitorRole?.message} id="visitorRole">
          <input
            id="visitorRole"
            autoComplete="organization-title"
            placeholder="Médico"
            maxLength={80}
            aria-invalid={!!errors.visitorRole}
            aria-describedby={errors.visitorRole ? 'visitorRole-error' : undefined}
            className={inputClass(!!errors.visitorRole)}
            {...register('visitorRole')}
          />
        </Field>
        {codeRequired ? (
          <Field label="Código de acceso" error={errors.accessCode?.message} id="accessCode">
            <div className="relative w-full max-w-sm">
              <div aria-hidden="true" className="grid grid-cols-6 gap-1.5 sm:gap-2">
                {Array.from({ length: 6 }, (_, digit) => (
                  <span key={digit} className={`grid h-12 place-items-center rounded-xl border text-xl tabular-nums sm:h-14 ${errors.accessCode ? 'border-danger' : 'border-line'} ${accessCode[digit] ? 'bg-primary-tint' : 'text-muted'}`}>
                    {accessCode[digit] ?? '·'}
                  </span>
                ))}
              </div>
              <input
                {...accessCodeField}
                id="accessCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-invalid={!!errors.accessCode}
                aria-describedby={errors.accessCode ? 'accessCode-error' : codeComplete ? undefined : 'accessCode-hint'}
                value={accessCode}
                onChange={(event) => setValue('accessCode', event.target.value.replace(/[^0-9]/g, '').slice(0, 6), { shouldValidate: !!errors.accessCode })}
                className={`absolute inset-0 w-full rounded-xl bg-transparent text-transparent caret-transparent ${focusRing}`}
              />
            </div>
            <div aria-hidden={codeComplete} className={`grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out motion-reduce:transition-none ${codeComplete ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}>
              <div className="min-h-0 overflow-hidden">
                <p id="accessCode-hint" className="text-sm text-muted">
                  Coloca el código de 6 dígitos de quien te compartió el resumen.
                </p>
              </div>
            </div>
          </Field>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting || (codeRequired && !codeComplete)}
          className={`rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white transition disabled:opacity-60 sm:justify-self-end ${focusRing}`}
        >
          {isSubmitting ? 'Abriendo…' : 'Ver resumen'}
        </button>
      </form>
    </section>
  )
}

function HandoffSummary({ view, token, deadline, onUnavailable }: { view: HandoffPublicView; token: string; deadline: number | null; onUnavailable: () => void }) {
  const byCategory = CATEGORY_CODES.map((code) => ({
    code,
    items: view.items.filter((item) => item.categoryCode === code),
  })).filter((group) => group.items.length > 0)

  return (
    <article className="rounded-3xl bg-card p-5 text-base leading-relaxed shadow-sm [overflow-wrap:anywhere] sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="rounded-full bg-primary-tint px-2.5 py-1 font-semibold text-primary-fg">Solo lectura</span>
        {view.accessExpiresAt ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" title="Hora de Lima">
          Lectura hasta el {readingExpiry.format(new Date(view.accessExpiresAt))}
        </span> : null}
      </div>
      <header>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 max-w-full text-3xl font-semibold tracking-tight">Resumen de {view.careSubjectName}</h1>
          {view.downloadAllowed === true && deadline !== null
            ? <SummaryPdfDownload token={token} accessGrant={view.accessGrant} deadline={deadline} onUnavailable={onUnavailable} /> : null}
        </div>
        <p className="mt-1 text-sm text-muted">Preparado el {formatDate(view.createdAt)}</p>
      </header>

      <section className="mt-5">
        <h2 className="text-lg font-semibold">Motivo de la consulta</h2>
        <p className="mt-1 whitespace-pre-wrap break-words">{view.reason}</p>
        {view.questions ? (
          <>
            <h2 className="mt-5 text-lg font-semibold">Preguntas de la familia</h2>
            <p className="mt-1 whitespace-pre-wrap break-words">{view.questions}</p>
          </>
        ) : null}
      </section>

      {byCategory.length === 0 ? <p className="text-muted">Este resumen no incluye registros.</p> : null}

      {byCategory.map(({ code, items }) => (
        <section key={code} aria-labelledby={`cat-${code}`} className="mt-5">
          <h2 id={`cat-${code}`} className="text-lg font-semibold">
            {categoryLabels[code as CategoryCode]?.plural ?? code}
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-4">
            {items.map((item) => (
              <HandoffItemCard key={item.healthEntryVersionId} item={item} token={token} accessGrant={view.accessGrant} onUnavailable={onUnavailable} />
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}

function HandoffItemCard({ item, token, accessGrant, onUnavailable }: { item: HandoffItem; token: string; accessGrant?: string | null; onUnavailable: () => void }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  async function openSource() {
    const controller = new AbortController()
    pending.current = controller
    setOpening(true)
    setError(null)
    try {
      if (!(await openHandoffSource(token, item.healthEntryVersionId, accessGrant, controller.signal))) {
        setError('Permita abrir una nueva pestaña para ver el documento original.')
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      if (axios.isAxiosError(cause) && cause.response?.status === 410) onUnavailable()
      else setError(getErrorMessage(cause))
    } finally {
      setOpening(false)
    }
  }
  const facts = [item.dose && `Dosis: ${item.dose}`, item.frequency].filter(Boolean).join(' · ')
  return (
    <li className="min-w-0 border-l-[3px] border-primary-fg/40 pl-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 max-w-full font-semibold">{item.title}</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            item.confidenceLevel === 'CONFIRMED' ? 'bg-accent-tint text-accent-text' : 'bg-soft text-soft-text'
          }`}
        >
          {confidenceLabels[item.confidenceLevel]}
        </span>
      </div>
      {facts ? <p className="mt-2 font-semibold">{facts}</p> : null}
      {item.details ? <p className="mt-2 whitespace-pre-wrap break-words">{item.details}</p> : null}
      {item.notes ? <p className="mt-2 whitespace-pre-line text-muted">{item.notes}</p> : null}
      <p className="mt-2 text-sm text-muted">
        {item.occurredOn ? `Fecha: ${formatDate(item.occurredOn)} · ` : ''}Actualizado el {formatDate(item.declaredAt)}
      </p>
      {item.hasSourceAttachment ? (
        <div className="mt-2 grid gap-1">
          <button type="button" onClick={() => void openSource()} disabled={opening}
            className={`justify-self-start rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-60 ${focusRing}`}>
            {opening ? 'Abriendo original…' : 'Ver documento original'}
          </button>
          <p className="text-sm text-muted">Respaldo del registro compartido. Se abre en otra pestaña.</p>
          {error ? <p role="alert" className="text-base text-danger">{error}</p> : null}
        </div>
      ) : null}
    </li>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-lg font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-base text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-base text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const inputClass = (invalid: boolean) =>
  `rounded-xl border bg-card px-4 py-3 text-lg ${invalid ? 'border-danger' : 'border-line'} ${focusRing}`

const readingExpiry = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
