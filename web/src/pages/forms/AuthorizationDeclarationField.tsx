import { useId } from 'react'
import type { CareAuthorizationOption, CareAuthorizationPolicy } from '../../types'
import { findOption, splitAuthorizationOptions, type AuthorizationChoice } from '../../utils/authorization'
import { focusRing } from '../../utils/styles'

/**
 * Pregunta de autorización al añadir (o completar) una persona. Muestra el texto del catálogo del
 * backend: opciones con su ayuda visible, ninguna marcada, y la confirmación solo cuando corresponde.
 */
export function AuthorizationDeclarationField({
  policy,
  value,
  onChange,
  error,
}: {
  policy: CareAuthorizationPolicy
  value: AuthorizationChoice
  onChange: (value: AuthorizationChoice) => void
  error?: string | null
}) {
  const id = useId()
  const { ownOptions, thirdPartyOptions } = splitAuthorizationOptions(policy)
  const selected = findOption(policy, value.type)
  const errorId = `${id}-error`

  const option = (o: CareAuthorizationOption) => (
    <label
      key={o.type}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 has-checked:border-primary has-checked:bg-primary-tint has-focus-visible:outline-3 has-focus-visible:outline-primary"
    >
      <input
        type="radio"
        name={`${id}-type`}
        value={o.type}
        checked={value.type === o.type}
        // Cambiar de opción vuelve a pedir la confirmación
        onChange={() => onChange({ type: o.type, confirmed: false })}
        aria-describedby={`${id}-${o.type}-help`}
        className="mt-1 accent-primary"
      />
      <span className="grid gap-0.5">
        <span className="font-semibold">{o.label}</span>
        <span id={`${id}-${o.type}-help`} className="text-sm text-muted">
          {o.description}
        </span>
      </span>
    </label>
  )

  return (
    <fieldset className="grid gap-3" aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-semibold">¿Para quién es este perfil?</legend>
      {ownOptions.length > 0 ? <div className="grid gap-2">{ownOptions.map(option)}</div> : null}
      {thirdPartyOptions.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold">Si es otra persona: {policy.thirdPartyQuestion}</p>
          {thirdPartyOptions.map(option)}
        </div>
      ) : null}

      {selected?.confirmationText ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface px-4 py-3">
          <input
            type="checkbox"
            checked={value.confirmed}
            onChange={(event) => onChange({ ...value, confirmed: event.target.checked })}
            className={`mt-1 accent-primary ${focusRing}`}
          />
          <span className="text-sm">{selected.confirmationText}</span>
        </label>
      ) : null}

      {selected && !selected.confirmationText ? (
        <p role="status" className="rounded-xl bg-accent-tint p-4 text-sm text-accent-text">
          {selected.description.replace(/\.?$/, '.')} No se creará el perfil todavía: puedes volver más tarde o elegir otra opción.
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        Esto queda registrado como tu declaración, con fecha. Yuyay no verifica la autorización.
      </p>
    </fieldset>
  )
}
