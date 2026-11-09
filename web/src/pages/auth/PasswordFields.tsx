import type { InputHTMLAttributes, Ref } from 'react'
import type { FieldError } from 'react-hook-form'
import { passwordChecks } from '../../utils/password'
import { focusRing } from '../../utils/styles'
import { a11yProps } from '../forms/fieldProps'

/** Campo de contraseña. Con `onToggle` incluye el botón para mostrarla u ocultarla. */
export function PasswordInput({
  id,
  error,
  hint,
  shown,
  onToggle,
  ref,
  ...field
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  error?: FieldError
  hint?: string
  shown: boolean
  onToggle?: () => void
  ref?: Ref<HTMLInputElement>
}) {
  const props = a11yProps(id, error, hint)
  return (
    <div className="relative">
      <input
        {...field}
        {...props}
        ref={ref}
        type={shown ? 'text' : 'password'}
        className={onToggle ? `${props.className} pr-24` : props.className}
      />
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={shown}
          aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className={`absolute inset-y-1 right-1 rounded-lg px-3 text-sm font-semibold text-primary ${focusRing}`}
        >
          {shown ? 'Ocultar' : 'Mostrar'}
        </button>
      ) : null}
    </div>
  )
}

/** Requisitos de la contraseña, actualizados mientras se escribe. */
export function PasswordChecklist({ id, password }: { id: string; password: string }) {
  return (
    <ul id={id} aria-label="Requisitos de la contraseña" className="-mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
      {passwordChecks(password).map(({ ok, label }) => (
        <li key={label} className={ok ? 'text-accent-text' : 'text-muted'}>
          <span aria-hidden="true">{ok ? '✓' : '○'}</span> {label}
          <span className="sr-only">{ok ? ' (cumplido)' : ' (pendiente)'}</span>
        </li>
      ))}
    </ul>
  )
}
