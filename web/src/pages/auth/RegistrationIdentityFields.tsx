import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form'
import { Button } from '../../components/ui/Button'
import { lookupDni } from '../../services/api/auth'
import type { RegistrationIdentity } from '../../types/auth'
import { getErrorMessage } from '../../utils/apiErrors'
import { a11yProps } from '../forms/fieldProps'
import { Field } from '../forms/fields'

type Lookup =
  | { status: 'idle' | 'loading' }
  | { status: 'found'; fullName: string }
  | { status: 'error'; message: string }

/**
 * DNI y nombre de usuario del alta. El nombre sale del DNI: la persona confirma que es ella y
 * después puede cambiar cómo quiere que la vean.
 */
export function RegistrationIdentityFields({ prefix, dni, dniValue, fullName, name, errors, onConfirm, onReset }: {
  prefix: string
  dni: UseFormRegisterReturn
  dniValue: string
  /** Vacío mientras la persona no confirme su nombre. */
  fullName: string
  name: UseFormRegisterReturn
  errors: FieldErrors<RegistrationIdentity>
  onConfirm: (fullName: string) => void
  onReset: () => void
}) {
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const dniId = `${prefix}-dni`
  const legalNameId = `${prefix}-full-name`
  const aliasId = `${prefix}-name`
  const complete = /^\d{8}$/.test(dniValue)

  function forget() {
    request.current?.abort()
    setLookup({ status: 'idle' })
    onReset()
  }

  async function search() {
    request.current?.abort()
    const current = new AbortController()
    request.current = current
    setLookup({ status: 'loading' })
    try {
      const found = await lookupDni(dniValue, current.signal)
      if (!current.signal.aborted) setLookup({ status: 'found', fullName: found.fullName })
    } catch (error) {
      if (!current.signal.aborted) setLookup({ status: 'error', message: getErrorMessage(error) })
    }
  }

  return <>
    <Field id={dniId} label="DNI" error={errors.dni} hint="Enviamos tu DNI a un proveedor externo para mostrarte el nombre que figura en él.">
      <input
        {...dni}
        {...a11yProps(dniId, errors.dni, 'hint')}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void dni.onChange(event)
          forget()
        }}
        inputMode="numeric"
        maxLength={8}
        autoComplete="off"
      />
    </Field>
    {fullName ? (
      <Field id={legalNameId} label="Tu nombre según el DNI" error={errors.fullName}>
        <input id={legalNameId} value={fullName} readOnly />
      </Field>
    ) : lookup.status === 'found' ? (
      <div role="group" aria-label="Confirma tu identidad" className="grid gap-3 rounded-xl bg-surface p-4">
        <p role="status">¿Eres <strong>{lookup.fullName}</strong>?</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onConfirm(lookup.fullName)}>Sí, soy yo</Button>
          <Button size="sm" variant="secondary" onClick={forget}>No soy yo</Button>
        </div>
      </div>
    ) : (
      <div className="grid justify-items-start gap-1.5">
        <Button size="sm" variant="secondary" disabled={!complete} loading={lookup.status === 'loading'} onClick={() => void search()}>
          Ver mi nombre
        </Button>
        {lookup.status === 'error' ? <p role="alert" className="text-sm text-danger">{lookup.message}</p>
          : errors.fullName ? <p id={`${legalNameId}-error`} className="text-sm text-danger">{errors.fullName.message}</p> : null}
      </div>
    )}
    <Field id={aliasId} label="Nombre de usuario" error={errors.name} hint="Así te verán en Yuyay. Puedes cambiarlo.">
      <input {...name} {...a11yProps(aliasId, errors.name, 'hint')} maxLength={120} autoComplete="nickname" />
    </Field>
  </>
}
