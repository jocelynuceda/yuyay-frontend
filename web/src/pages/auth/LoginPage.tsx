import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/layout/AuthShell'
import { useAuth } from '../../hooks/useAuth'
import { loginSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { linkClass } from '../../utils/styles'
import { getPostLoginTarget } from '../../utils/redirect'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'
import { PasswordInput } from './PasswordFields'

export default function LoginPage() {
  const { login: submitAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      await submitAuth(email, password)
      void navigate(getPostLoginTarget(location.state), { replace: true })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['email', 'password']))
    }
  })

  return (
    <AuthShell
      title="Hola de nuevo"
      subtitle="Tu familia y tus cuidados, en un solo lugar."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link to="/registro" className={linkClass}>
            Regístrate
          </Link>
        </>
      }
    >
      <FormShell title="Iniciar sesión" onSubmit={onSubmit}>
        <ServerError message={serverError} />
        <Field id="auth-email" label="Correo electrónico" error={errors.email}>
          <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
        </Field>
        <Field id="auth-password" label="Contraseña" error={errors.password}>
          <PasswordInput
            {...register('password')}
            id="auth-password"
            error={errors.password}
            shown={shown}
            onToggle={() => setShown((value) => !value)}
            autoComplete="current-password"
          />
        </Field>
        <Link to="/recuperar-contrasena" className="-mt-2 justify-self-end text-sm font-semibold text-primary underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <FormActions submitting={isSubmitting} submitLabel="Entrar" submittingLabel="Ingresando…" />
      </FormShell>
    </AuthShell>
  )
}
