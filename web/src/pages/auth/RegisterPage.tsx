import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from '../../components/layout/AuthShell'
import { useAuth } from '../../hooks/useAuth'
import { registerSchema } from '../../schemas/auth'
import { applyServerErrors } from '../../utils/apiErrors'
import { linkClass } from '../../utils/styles'
import { getPostLoginTarget } from '../../utils/redirect'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'

export default function RegisterPage() {
  const { register: submitAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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
      void navigate(getPostLoginTarget(location.state), { replace: true })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['name', 'email', 'password']))
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
      <FormShell title="Crear una cuenta" onSubmit={onSubmit}>
        <ServerError message={serverError} />
        <Field id="auth-name" label="Nombre" error={errors.name}>
          <input {...register('name')} {...a11yProps('auth-name', errors.name)} autoComplete="name" />
        </Field>
        <Field id="auth-email" label="Correo electrónico" error={errors.email}>
          <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
        </Field>
        <Field
          id="auth-password"
          label="Contraseña"
          error={errors.password}
          hint="Usa al menos 8 caracteres e incluye una letra entre a y z y un número."
        >
          <input
            {...register('password')}
            {...a11yProps('auth-password', errors.password, 'password')}
            type="password"
            autoComplete="new-password"
          />
        </Field>
        <FormActions submitting={isSubmitting} submitLabel="Registrarme" submittingLabel="Creando cuenta…" />
      </FormShell>
    </AuthShell>
  )
}
