import { avatarSrc, type AvatarChoice } from '../../utils/avatars'
import { cx } from './cx'

const sizes = { sm: 'size-8', md: 'size-12', lg: 'size-16', xl: 'size-24' } as const

export interface LionAvatarProps {
  avatar: AvatarChoice
  size?: keyof typeof sizes
  /** Si se indica, el avatar se anuncia con esta etiqueta; si no, es decorativo. */
  label?: string
  /** Respiración suave (se apaga con prefers-reduced-motion). */
  animated?: boolean
  className?: string
}

/** Avatar circular de león. */
export function LionAvatar({ avatar, size = 'md', label, animated = false, className }: LionAvatarProps) {
  return (
    <span
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-soft', sizes[size], className)}
    >
      <img src={avatarSrc(avatar)} alt="" className={cx('size-full object-contain', animated && 'lion-breathe')} />
    </span>
  )
}
