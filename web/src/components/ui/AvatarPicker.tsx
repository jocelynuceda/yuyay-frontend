import { useAvatar, type AvatarTarget } from '../../hooks/useAvatar'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'
import { avatarId, avatarOptions, type AvatarChoice } from '../../utils/avatars'
import { LionAvatar } from './LionAvatar'
import { Modal } from './Modal'

/** Diálogo para elegir el avatar. "Automático" vuelve al que corresponde por la edad. */
export function AvatarPicker({
  open,
  onClose,
  title,
  target,
}: {
  open: boolean
  onClose: () => void
  title: string
  target: AvatarTarget
}) {
  const { avatar, automatic, isCustom, setAvatar } = useAvatar(target)
  const currentId = avatarId(avatar)

  function pick(choice: AvatarChoice | null) {
    setAvatar(choice)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label="Avatares" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Option label="Automático" hint="Según la edad" selected={!isCustom} onSelect={() => pick(null)} avatar={automatic} />
        {avatarOptions.map((o) => (
          <Option key={o.id} label={o.label} selected={isCustom && o.id === currentId} onSelect={() => pick(o)} avatar={o} />
        ))}
      </div>
    </Modal>
  )
}

function Option({
  label,
  hint,
  selected,
  onSelect,
  avatar,
}: {
  label: string
  hint?: string
  selected: boolean
  onSelect: () => void
  avatar: AvatarChoice
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'relative grid justify-items-center gap-1 rounded-2xl border-2 p-3 text-center transition-colors',
        selected ? 'border-primary bg-primary-tint' : 'border-transparent bg-surface hover:bg-primary-tint',
        focusRing,
      )}
    >
      <LionAvatar avatar={avatar} size="lg" className="bg-card" />
      <span className="text-sm font-semibold">{label}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      {selected ? (
        <span aria-hidden className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-primary text-white">
          <Icon name="check" className="size-3.5" />
        </span>
      ) : null}
    </button>
  )
}

/** Avatar de una persona cuidada: el elegido en su perfil o el automático por edad. */
export function SubjectAvatar({
  subject,
  size,
  animated,
  className,
}: {
  subject: { id: number; birthDate: string | null }
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
  className?: string
}) {
  const { avatar } = useAvatar({ type: 'subject', id: subject.id, birthDate: subject.birthDate })
  return <LionAvatar avatar={avatar} size={size} animated={animated} className={className} />
}

/** Avatar del usuario con sesión iniciada. */
export function MyAvatar({ size, animated, className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; animated?: boolean; className?: string }) {
  const { avatar } = useAvatar({ type: 'me' })
  return <LionAvatar avatar={avatar} size={size} animated={animated} className={className} />
}
