import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/layout/AuthShell'
import { AccountTerms } from '../../components/AccountTerms'
import { needsTermsReview, useAccountTerms } from '../../hooks/useAccountTerms'
import { useAuth } from '../../hooks/useAuth'
import { registerSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { linkClass } from '../../utils/styles'
import { getPostLoginTarget } from '../../utils/redirect'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, GenderField, ServerError } from '../forms/fields'
import { GoogleSignIn } from './GoogleSignIn'
import { useDniLookup } from './useDniLookup'
import { PasswordChecklist, PasswordInput } from './PasswordFields'

export default function RegisterPage() {
  const { register: submitAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const terms = useAccountTerms()
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', fullName: '', gender: '' as const, dni: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const password = useWatch({ control, name: 'password' })
  const dni = useWatch({ control, name: 'dni' })
  const { lookup, retry } = useDniLookup(dni.trim())
  const manualName = lookup.status === 'manual'
  const foundName = lookup.status === 'found' ? lookup.fullName : ''

  // El nombre sigue al DNI: al cambiarlo se retira el anterior
  useEffect(() => {
    setValue('fullName', foundName, { shouldValidate: !!foundName })
  }, [foundName, setValue])

  const onSubmit = handleSubmit(async ({ name, fullName, gender, dni, email, password }) => {
    setServerError(null)
    setTermsError(null)
    if (!terms.acceptance) {
      setTermsError('Lee y acepta los términos de uso y el aviso de privacidad para crear tu cuenta.')
      return
    }
    try {
      if (await submitAuth({ name, fullName, gender, dni, email, password, ...terms.acceptance })) {
        void navigate(getPostLoginTarget(location.state), { replace: true })
      }
    } catch (error) {
      if (needsTermsReview(error)) {
        setTermsError('Revisa el documento vigente y confirma tu aceptación para continuar.')
        terms.review()
        return
      }
      setServerError(applyServerErrors(error, setError, ['name', 'fullName', 'gender', 'dni', 'email', 'password']))
    }
  })

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Empieza a cuidar en equipo, paso a paso."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className={linkClass}>
            Inicia sesión
          </Link>
        </>
      }
    >
      <FormShell title="Crear una cuenta" onSubmit={onSubmit} compact>
        <ServerError message={serverError} />
        <GoogleSignIn
          mode="register"
          onStart={() => setServerError(null)}
          onSignedIn={() => void navigate(getPostLoginTarget(location.state), { replace: true })}
          onError={setServerError}
        />
        <Field id="auth-dni" label="DNI" error={errors.dni} hint="Lo enviamos a APIsPERU para obtener tu nombre. No lo guardamos.">
          <input
            {...register('dni')}
            {...a11yProps('auth-dni', errors.dni, 'hint')}
            inputMode="numeric"
            maxLength={8}
            autoComplete="off"
          />
        </Field>
        {lookup.status === 'loading' ? <p role="status" className="-mt-3 text-sm text-muted">Buscando tu nombre…</p> : null}
        {lookup.status === 'error' ? (
          <div role="alert" className="-mt-3 flex flex-wrap items-center gap-3 text-sm text-danger">
            <span>{lookup.message}</span>
            {lookup.invalid ? null : (
              <button type="button" className="font-semibold text-primary-fg underline" onClick={retry}>Reintentar</button>
            )}
          </div>
        ) : null}
        <Field id="auth-full-name" label="Nombre completo" error={errors.fullName} hint={manualName ? lookup.message : 'Se completa con tu DNI.'}>
          <input
            {...register('fullName')}
            {...a11yProps('auth-full-name', errors.fullName, 'hint')}
            readOnly={!manualName}
            maxLength={200}
            autoComplete={manualName ? 'name' : 'off'}
          />
        </Field>
        <Field id="auth-name" label="Nombre de usuario" error={errors.name} hint="Así te verán en Yuyay.">
          <input {...register('name')} {...a11yProps('auth-name', errors.name, 'hint')} maxLength={120} autoComplete="nickname" />
        </Field>
        <GenderField field={register('gender')} legend="Género (opcional, puedes saltarlo)" />
        <Field id="auth-email" label="Correo electrónico" error={errors.email}>
          <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
        </Field>
        <Field id="auth-password" label="Contraseña" error={errors.password}>
          <PasswordInput
            {...register('password', {
              onChange: () => {
                if (getValues('confirmPassword')) void trigger('confirmPassword')
              },
            })}
            id="auth-password"
            error={errors.password}
            hint="checklist"
            shown={shown}
            onToggle={() => setShown((value) => !value)}
            autoComplete="new-password"
          />
        </Field>
        <PasswordChecklist id="auth-password-hint" password={password} />
        <Field id="auth-confirm" label="Confirma tu contraseña" error={errors.confirmPassword}>
          <PasswordInput
            {...register('confirmPassword')}
            id="auth-confirm"
            error={errors.confirmPassword}
            shown={shown}
            autoComplete="new-password"
          />
        </Field>
        <AccountTerms terms={terms} requireAcceptance disabled={isSubmitting} validationError={terms.acceptance ? null : termsError} />
        <FormActions submitting={isSubmitting} submitLabel="Registrarme" submittingLabel="Creando cuenta…" />
      </FormShell>
    </AuthShell>
  )
}
