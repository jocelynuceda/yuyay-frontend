import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { loginSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'

export default function LoginPage() {
  const { login: submitAuth } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null)
    try {
      await submitAuth(email, password)
      void navigate('/personas', { replace: true })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['email', 'password']))
    }
  })

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-6 text-center text-4xl font-semibold text-primary">Yuyay</h1>
      <FormShell title="Iniciar sesión" onSubmit={onSubmit}>
        <ServerError message={serverError} />
        <Field id="auth-email" label="Correo electrónico" error={errors.email}>
          <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
        </Field>
        <Field id="auth-password" label="Contraseña" error={errors.password}>
          <input
            {...register('password')}
            {...a11yProps('auth-password', errors.password)}
            type="password"
            autoComplete="current-password"
          />
        </Field>
        <FormActions submitting={isSubmitting} submitLabel="Entrar" submittingLabel="Ingresando…" />
      </FormShell>
      <p className="mt-5 text-center text-sm">
        ¿Aún no tienes cuenta?{' '}
        <Link to="/registro" className="font-semibold text-primary underline">
          Regístrate
        </Link>
      </p>
    </main>
  )
}
