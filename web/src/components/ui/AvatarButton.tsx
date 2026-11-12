import type { ReactNode } from 'react'
import { focusRing } from '../../utils/styles'
import { cx } from './cx'
import { Icon } from './Icon'

/** Avatar clicable con un lápiz en la esquina, para abrir el selector de avatar. */
export function AvatarButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label="Cambiar avatar" className={cx('group relative shrink-0 rounded-full', focusRing)}>
      {children}
      <span
        aria-hidden
        className="absolute right-0 bottom-0 grid size-7 place-items-center rounded-full border-2 border-card bg-primary text-white transition-transform group-hover:scale-110"
      >
        <Icon name="pencil" className="size-3.5" />
      </span>
    </button>
  )
}
