import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../../components/layout/ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { forgotPasswordSchema, resetPasswordSchema } from '../../schemas/auth'
import { forgotPassword, resetPassword } from '../../services/api/auth'
import { applyServerErrors, getErrorMessage } from '../../utils/apiErrors'
import { a11yProps } from '../forms/fieldProps'
import { Field, FormActions, FormShell, ServerError } from '../forms/fields'
import { AuthBrand } from './AuthBrand'
import { PasswordChecklist, PasswordInput } from './PasswordFields'

function RequestCodeForm({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  })

  const onSubmit = handleSubmit(async ({ email }) => {
    setServerError(null)
    try {
      await forgotPassword(email)
      onSent(email)
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['email']))
    }
  })

  return (
    <FormShell
      title="Recupera tu cuenta"
      description="Te enviaremos un código para elegir una contraseña nueva."
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />
      <Field id="auth-email" label="Correo electrónico" error={errors.email}>
        <input {...register('email')} {...a11yProps('auth-email', errors.email)} type="email" autoComplete="email" />
      </Field>
      <FormActions submitting={isSubmitting} submitLabel="Enviar código" submittingLabel="Enviando…" />
    </FormShell>
  )
}

function ResetForm({ email }: { email: string }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
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
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
    mode: 'onTouched',
  })
  const newPassword = useWatch({ control, name: 'newPassword' })

  const onSubmit = handleSubmit(async ({ code, newPassword: password }) => {
    setServerError(null)
    try {
      await resetPassword({ email, code, newPassword: password })
    } catch (error) {
      setServerError(applyServerErrors(error, setError, ['code', 'newPassword']))
      return
    }
    toast.success('Contraseña actualizada.')
    try {
      await login(email, password)
      void navigate('/', { replace: true })
    } catch {
      // La contraseña ya cambió y el código ya no sirve: se entra desde el login
      void navigate('/login', { replace: true })
    }
  })

  async function resend() {
    setResending(true)
    setServerError(null)
    setNotice(null)
    try {
      await forgotPassword(email)
      setNotice('Si pasó al menos un minuto, te enviamos un código nuevo.')
    } catch (error) {
      setServerError(getErrorMessage(error))
    } finally {
      setResending(false)
    }
  }

  return (
    <FormShell
      title="Revisa tu correo"
      description={`Si ${email} tiene una cuenta, te enviamos un código de 6 dígitos.`}
      onSubmit={onSubmit}
    >
      <ServerError message={serverError} />
      <Field id="reset-code" label="Código" error={errors.code} hint={notice ?? undefined}>
        <input
          {...register('code')}
          {...a11yProps('reset-code', errors.code, notice ?? undefined)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
        />
      </Field>
      <Field id="reset-password" label="Contraseña nueva" error={errors.newPassword}>
        <PasswordInput
          {...register('newPassword', {
            onChange: () => {
              if (getValues('confirmPassword')) void trigger('confirmPassword')
            },
          })}
          id="reset-password"
          error={errors.newPassword}
          hint="checklist"
          shown={shown}
          onToggle={() => setShown((value) => !value)}
          autoComplete="new-password"
        />
      </Field>
      <PasswordChecklist id="reset-password-hint" password={newPassword} />
      <Field id="reset-confirm" label="Confirma tu contraseña" error={errors.confirmPassword}>
        <PasswordInput
          {...register('confirmPassword')}
          id="reset-confirm"
          error={errors.confirmPassword}
          shown={shown}
          autoComplete="new-password"
        />
      </Field>
      <FormActions submitting={isSubmitting} submitLabel="Cambiar contraseña" submittingLabel="Cambiando…" />
      <button
        type="button"
        onClick={() => void resend()}
        disabled={resending || isSubmitting}
        className="justify-self-center rounded-sm text-sm font-semibold text-primary underline disabled:opacity-60"
      >
        {resending ? 'Enviando…' : 'Enviar otro código'}
      </button>
    </FormShell>
  )
}

/** Dos pasos, igual que en la app móvil: pedir el código por correo y elegir la contraseña nueva. */
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <div className="mb-2 flex justify-end">
        <ThemeToggle />
      </div>
      <AuthBrand />
      {sentTo === null ? <RequestCodeForm onSent={setSentTo} /> : <ResetForm email={sentTo} />}
      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="font-semibold text-primary underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </main>
  )
}
