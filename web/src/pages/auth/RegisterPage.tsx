import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { registerSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'

export default function RegisterPage() {
  const { register: submitAuth } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setServerError(null)
    try {
      await submitAuth(name, email, password)
      void navigate('/personas', { replace: true })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['name', 'email', 'password']))
    }
  })

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-6 text-center text-4xl font-semibold text-primary">Yuyay</h1>
      <FormShell title="Crear una cuenta" onSubmit={onSubmit}>
        <ServerError message={serverError} />
        <Field id="auth-name" label="Nombre" error={errors.name}>
          <input {...register('name')} {...a11yProps('auth-name', errors.name)} autoComplete="name" />
        </Field>
        <Field id="auth-email" label="Correo electrónico" error={errors.email}>
          <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
        </Field>
        <Field id="auth-password" label="Contraseña" error={errors.password} hint="Usa de 8 a 72 caracteres e incluye una letra y un número.">
          <input
            {...register('password')}
            {...a11yProps('auth-password', errors.password, 'password')}
            type="password"
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
