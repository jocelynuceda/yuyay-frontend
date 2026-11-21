import { useId } from 'react'
import { Button } from '../../components/ui/Button'
import type { useCareAuthorization } from '../../hooks/useCareAuthorization'
import { profileKinds, thirdPartyTypes } from '../../utils/careAuthorization'
import { ChoiceOption, ServerError } from './fields'

export function CareAuthorizationFields({
  authorization, disabled,
}: {
  authorization: ReturnType<typeof useCareAuthorization>
  disabled: boolean
}) {
  const profileGroup = useId()
  const thirdPartyGroup = useId()
  const { document, profileKind, option, declaration } = authorization

  if (authorization.loading) return <p role="status" className="text-sm text-muted">Cargando las opciones de autorización…</p>
  if (!document) return (
    <div className="grid justify-items-start gap-2">
      <ServerError message={authorization.error ?? 'No pudimos cargar las opciones de autorización.'} />
      <Button type="button" variant="secondary" onClick={authorization.review}>Volver a cargar</Button>
    </div>
  )

  return (
    <div className="grid gap-4 rounded-2xl border border-line p-4">
      <fieldset disabled={disabled}>
        <legend className="mb-2 font-semibold">¿Para quién es el perfil?</legend>
        <div className="grid gap-2">
          {profileKinds.map((kind) => {
            const policyOption = document.options.find((entry) => entry.type === kind)
            return kind === 'THIRD_PARTY' || policyOption ? (
              <ChoiceOption key={kind} name={profileGroup} value={kind} checked={profileKind === kind} onChange={() => authorization.chooseProfileKind(kind)}>
                <span>
                  <span className="block font-semibold">{policyOption?.label ?? 'El perfil es para otra persona.'}</span>
                  {policyOption && <span className="block text-sm text-muted">{policyOption.description}</span>}
                </span>
              </ChoiceOption>
            ) : null
          })}
        </div>
      </fieldset>
      {profileKind === 'THIRD_PARTY' && (
        <fieldset disabled={disabled}>
          <legend className="mb-2 font-semibold">{document.thirdPartyQuestion}</legend>
          <div className="grid gap-2">
            {thirdPartyTypes.map((type) => {
              const policyOption = document.options.find((entry) => entry.type === type)
              if (!policyOption) return null
              return (
                <ChoiceOption key={type} name={thirdPartyGroup} value={type} checked={authorization.thirdPartyType === type} onChange={() => authorization.chooseThirdPartyType(type)}>
                  <span>
                    <span className="block font-semibold">{policyOption.label}</span>
                    <span className="block text-sm text-muted">{policyOption.description}</span>
                  </span>
                </ChoiceOption>
              )
            })}
          </div>
        </fieldset>
      )}
      {option?.type === 'PENDING' && (
        <p role="status" className="rounded-xl bg-primary-tint p-3 text-sm">
          Puedes volver o dejar el formulario abierto. La persona se agregará cuando puedas confirmar su autorización.
        </p>
      )}
      {option?.confirmationText && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={Boolean(declaration)}
            disabled={disabled}
            onChange={(event) => authorization.confirm(event.currentTarget.checked)}
          />
          {option.confirmationText}
        </label>
      )}
      <p className="text-xs text-muted">Versión {document.textVersion}</p>
    </div>
  )
}
