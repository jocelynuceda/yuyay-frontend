import type { FieldErrors, UseFormRegisterReturn } from 'react-hook-form'
import type { RegistrationIdentity } from '../../types/auth'
import { a11yProps } from '../forms/fieldProps'
import { Field } from '../forms/fields'

export function RegistrationIdentityFields({ prefix, dni, fullName, name, errors }: {
  prefix: string
  dni: UseFormRegisterReturn
  fullName: UseFormRegisterReturn
  name: UseFormRegisterReturn
  errors: FieldErrors<RegistrationIdentity>
}) {
  const dniId = `${prefix}-dni`
  const legalNameId = `${prefix}-full-name`
  const aliasId = `${prefix}-name`
  return <>
    <Field id={dniId} label="DNI" error={errors.dni} hint="Al crear tu cuenta, enviamos tu DNI a un proveedor externo para contrastar los nombres y apellidos que escribes.">
      <input {...dni} {...a11yProps(dniId, errors.dni, 'hint')} inputMode="numeric" maxLength={8} autoComplete="off" />
    </Field>
    <Field id={legalNameId} label="Nombres y apellidos según tu DNI" error={errors.fullName}>
      <input {...fullName} {...a11yProps(legalNameId, errors.fullName)} maxLength={200} autoComplete="name" />
    </Field>
    <Field id={aliasId} label="Nombre de usuario" error={errors.name} hint="Así te verán en Yuyay.">
      <input {...name} {...a11yProps(aliasId, errors.name, 'hint')} maxLength={120} autoComplete="nickname" />
    </Field>
  </>
}
