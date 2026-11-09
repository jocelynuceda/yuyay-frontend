import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { registerSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { getPostLoginTarget } from '../../utils/redirect'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'
import { AuthBrand } from './AuthBrand'
import { PasswordChecklist, PasswordInput } from './PasswordFields'

export default function RegisterPage() {
  const { register: submitAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setServerError(null)
    try {
      await submitAuth(name, email, password)
      void navigate(getPostLoginTarget(location.state), { replace: true })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['name', 'email', 'password']))
    }
  })

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <div className="mb-2 flex justify-end">
        <ThemeToggle />
      </div>
      <AuthBrand />
      <FormShell title="Crear una cuenta" onSubmit={onSubmit}>
        <ServerError message={serverError} />
        <Field id="auth-name" label="Nombre" error={errors.name}>
          <input {...register('name')} {...a11yProps('auth-name', errors.name)} autoComplete="name" />
        </Field>
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
        <FormActions submitting={isSubmitting} submitLabel="Registrarme" submittingLabel="Creando cuenta…" />
      </FormShell>
      <p className="mt-5 text-center text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className="font-semibold text-primary underline">
          Inicia sesión
        </Link>
      </p>
    </main>
  )
}
