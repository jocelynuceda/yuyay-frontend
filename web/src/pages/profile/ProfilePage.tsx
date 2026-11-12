import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { LoadError } from '../../components/layout/LoadError'
import { AvatarPicker, MyAvatar } from '../../components/ui/AvatarPicker'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { AvatarButton } from '../../components/ui/AvatarButton'
import { Icon } from '../../components/ui/Icon'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { useLogout } from '../../hooks/useLogout'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'
import { profileSchema } from '../../schemas/profile'
import { getMe, updateMe } from '../../services/api/users'
import type { UserProfile } from '../../types'
import { applyServerErrors } from '../../utils/apiErrors'
import { formatDate, userRoleLabels } from '../../utils/format'
import type { ThemePreference } from '../../contexts/theme-context'

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Según el sistema' },
]

function ThemeSetting() {
  const { preference, setPreference } = useTheme()
  return (
    <Card as="section" aria-labelledby="theme-setting" className="grid gap-4">
      <h2 id="theme-setting" className="text-xl font-bold">
        Tema
      </h2>
      <div className="flex flex-wrap gap-2">
        {themeOptions.map(({ value, label }) => (
          <Button
            key={value}
            variant={preference === value ? 'primary' : 'secondary'}
            aria-pressed={preference === value}
            onClick={() => setPreference(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </Card>
  )
}

function ProfileForm({ profile, onSaved }: { profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors, isValid, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name },
    mode: 'onChange',
  })
  const name = useWatch({ control, name: 'name' })
  const unchanged = name.trim() === profile.name

  const onSubmit = handleSubmit(async (values) => {
    try {
      const updated = await updateMe({ name: values.name })
      onSaved(updated)
      reset({ name: updated.name })
      toast.success('Perfil actualizado.')
    } catch (error) {
      const message = applyServerErrors(error, setError, ['name'])
      if (message) toast.error(message)
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Input
        label="Nombre"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <div>
        <Button type="submit" loading={isSubmitting} disabled={!isValid || unchanged}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  const { updateUser } = useAuth()
  const logout = useLogout()
  const { data, error, loading, reload } = useFetch((signal) => getMe(signal), [])
  const [saved, setSaved] = useState<UserProfile | null>(null)
  const [pickingAvatar, setPickingAvatar] = useState(false)
  const profile = saved ?? data

  function handleSaved(updated: UserProfile) {
    setSaved(updated)
    updateUser({ name: updated.name })
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Mi perfil"
        description="Tus datos de cuenta."
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Perfil' }]}
      />
      {error && !profile ? (
        <LoadError message={error} onRetry={reload} />
      ) : !profile ? (
        <Card className="grid max-w-2xl gap-4">
          <p role="status" className="sr-only">
            {loading ? 'Cargando perfil…' : ''}
          </p>
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton lines={3} />
        </Card>
      ) : (
        <div className="grid max-w-2xl gap-6">
          <Card className="grid gap-6">
            <div className="flex items-center gap-4">
              <AvatarButton onClick={() => setPickingAvatar(true)}>
                <MyAvatar size="xl" animated />
              </AvatarButton>
              <AvatarPicker open={pickingAvatar} onClose={() => setPickingAvatar(false)} title="Tu avatar" target={{ type: 'me' }} />
              <div className="min-w-0">
                <h2 className="text-xl font-bold wrap-break-word">{profile.name}</h2>
                <p className="text-muted wrap-break-word">{profile.email}</p>
              </div>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Rol</dt>
                <dd className="font-semibold">{userRoleLabels[profile.role] ?? profile.role}</dd>
              </div>
              <div>
                <dt className="text-muted">Miembro desde</dt>
                <dd className="font-semibold">{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
          </Card>
          <Card as="section" aria-labelledby="edit-profile" className="grid gap-4">
            <h2 id="edit-profile" className="text-xl font-bold">
              Editar nombre
            </h2>
            <ProfileForm profile={profile} onSaved={handleSaved} />
          </Card>
          <ThemeSetting />
          <div>
            <Button variant="secondary" onClick={() => void logout()}>
              <Icon name="logout" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
