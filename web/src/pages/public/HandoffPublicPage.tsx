import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { openHandoffSession } from '../../services/api/handoffs'
import { emptyOpenHandoff, openHandoffFields, openHandoffSchema, type OpenHandoffFormValues } from '../../schemas/handoff'
import type { CategoryCode, HandoffItem, HandoffPublicView } from '../../types'
import { CATEGORY_CODES } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { categoryLabels, confidenceLabels, formatDate } from '../../utils/format'
import { focusRing, PublicShell } from './PublicShell'

/**
 * Vista para el médico (/traspaso/:token). Pide nombre y rol del visitante,
 * abre la sesión y muestra el resumen en letra grande y solo lectura.
 */
export function HandoffPublicPage({ token }: { token: string }) {
  const [view, setView] = useState<HandoffPublicView | null>(null)

  return (
    <PublicShell>
      {view ? <HandoffSummary view={view} /> : <VisitorForm token={token} onOpened={setView} />}
    </PublicShell>
  )
}

function VisitorForm({ token, onOpened }: { token: string; onOpened: (view: HandoffPublicView) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OpenHandoffFormValues, unknown, z.output<typeof openHandoffSchema>>({
    resolver: zodResolver(openHandoffSchema),
    defaultValues: emptyOpenHandoff,
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      onOpened(await openHandoffSession(token, values))
    } catch (error) {
      setServerError(applyServerErrors(error, setError, openHandoffFields))
    }
  })

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-semibold">Resumen de salud para la consulta</h1>
      <p className="mt-3 text-lg text-muted">
        Antes de ver la información, indique quién la consulta. Queda registrado para la familia.
      </p>

      {serverError ? (
        <p role="alert" className="mt-6 rounded-xl bg-danger-bg p-4 text-lg text-danger">
          {serverError}
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-5">
        <Field label="Su nombre" error={errors.visitorName?.message} id="visitorName">
          <input
            id="visitorName"
            autoComplete="name"
            maxLength={120}
            aria-invalid={!!errors.visitorName}
            aria-describedby={errors.visitorName ? 'visitorName-error' : undefined}
            className={inputClass(!!errors.visitorName)}
            {...register('visitorName')}
          />
        </Field>
        <Field label="Su rol" hint="Por ejemplo: médico de guardia, enfermera, cardiólogo." error={errors.visitorRole?.message} id="visitorRole">
          <input
            id="visitorRole"
            autoComplete="organization-title"
            maxLength={80}
            aria-invalid={!!errors.visitorRole}
            aria-describedby={errors.visitorRole ? 'visitorRole-error' : 'visitorRole-hint'}
            className={inputClass(!!errors.visitorRole)}
            {...register('visitorRole')}
          />
        </Field>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white transition disabled:opacity-60 ${focusRing}`}
        >
          {isSubmitting ? 'Abriendo…' : 'Ver resumen'}
        </button>
      </form>
    </section>
  )
}

function HandoffSummary({ view }: { view: HandoffPublicView }) {
  const byCategory = CATEGORY_CODES.map((code) => ({
    code,
    items: view.items.filter((item) => item.categoryCode === code),
  })).filter((group) => group.items.length > 0)

  return (
    <article className="grid gap-8 text-lg leading-relaxed">
      <header>
        <p className="text-base font-semibold uppercase tracking-wide text-muted">Resumen de salud</p>
        <h1 className="mt-1 text-4xl font-semibold">{view.careSubjectName}</h1>
        <p className="mt-2 text-muted">Preparado el {formatDate(view.createdAt)}</p>
      </header>

      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Motivo de la consulta</h2>
        <p className="mt-2 whitespace-pre-line">{view.reason}</p>
        {view.questions ? (
          <>
            <h2 className="mt-6 text-2xl font-semibold">Preguntas de la familia</h2>
            <p className="mt-2 whitespace-pre-line">{view.questions}</p>
          </>
        ) : null}
      </section>

      {byCategory.length === 0 ? <p className="text-muted">Este resumen no incluye registros.</p> : null}

      {byCategory.map(({ code, items }) => (
        <section key={code} aria-labelledby={`cat-${code}`}>
          <h2 id={`cat-${code}`} className="text-2xl font-semibold">
            {categoryLabels[code as CategoryCode]?.plural ?? code}
          </h2>
          <ul className="mt-3 grid gap-3">
            {items.map((item) => (
              <HandoffItemCard key={item.healthEntryVersionId} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}

function HandoffItemCard({ item }: { item: HandoffItem }) {
  const facts = [item.dose && `Dosis: ${item.dose}`, item.frequency].filter(Boolean).join(' · ')
  return (
    <li className="rounded-2xl bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-xl font-semibold">{item.title}</h3>
        <span
          className={`rounded-full px-3 py-1 text-base font-semibold ${
            item.confidenceLevel === 'CONFIRMED' ? 'bg-accent-tint text-accent-text' : 'bg-soft text-soft-text'
          }`}
        >
          {confidenceLabels[item.confidenceLevel]}
        </span>
      </div>
      {facts ? <p className="mt-2 font-semibold">{facts}</p> : null}
      {item.details ? <p className="mt-2 whitespace-pre-line">{item.details}</p> : null}
      {item.notes ? <p className="mt-2 whitespace-pre-line text-muted">{item.notes}</p> : null}
      <p className="mt-3 text-base text-muted">
        {item.occurredOn ? `Fecha: ${formatDate(item.occurredOn)} · ` : ''}Actualizado el {formatDate(item.declaredAt)}
      </p>
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
  `rounded-xl border bg-white px-4 py-3 text-lg ${invalid ? 'border-danger' : 'border-line'} ${focusRing}`
