import { useId, type FormEventHandler, type InputHTMLAttributes, type ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'
import { focusRing } from '../../utils/styles'

// Piezas comunes de los formularios. Si la base agrega Input/Button propios, se reemplazan aquí.

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: FieldError
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error?.message ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function ServerError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-danger-bg p-4 text-danger">
      {message}
    </p>
  )
}

export function FormActions({
  submitting,
  submitLabel,
  submittingLabel = 'Guardando…',
  onCancel,
}: {
  submitting: boolean
  submitLabel: string
  submittingLabel?: string
  onCancel?: () => void
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={`rounded-full border border-line px-6 py-2.5 font-semibold ${focusRing}`}
        >
          Cancelar
        </button>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className={`rounded-full bg-primary px-6 py-2.5 font-semibold text-white shadow-[var(--shadow-soft)] disabled:opacity-60 ${focusRing}`}
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  )
}

/** Opción de radio con aspecto de botón (categoría, certeza, rol). */
export function ChoiceOption({ children, ...input }: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 has-checked:border-primary has-checked:bg-primary-tint has-focus-visible:outline-3 has-focus-visible:outline-primary">
      <input type="radio" className="accent-primary" {...input} />
      {children}
    </label>
  )
}

/**
 * Formulario en tarjeta con título. `noValidate`: la validación la hace Zod.
 * Con `bare` va dentro de un modal, que ya pone la tarjeta y el título.
 */
export function FormShell({
  title,
  description,
  bare = false,
  onSubmit,
  children,
}: {
  title: string
  description?: string
  bare?: boolean
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
}) {
  const titleId = useId()
  if (bare) {
    return (
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {description ? <p className="text-sm text-muted">{description}</p> : null}
        {children}
      </form>
    )
  }
  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby={titleId} className="grid gap-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div>
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </form>
  )
}
