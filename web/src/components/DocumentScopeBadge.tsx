import { Badge, type BadgeProps } from './ui/Badge'
import { scopeBadge, type ScopeTone } from '../utils/documentScope'
import type { DocumentScopeLabel } from '../types'

const tones: Record<ScopeTone, NonNullable<BadgeProps['tone']>> = {
  positive: 'accent',
  neutral: 'soft',
  danger: 'danger',
}

/** Etiqueta del uso del documento; no se muestra si no hay clasificación. */
export function DocumentScopeBadge({ label }: { label: DocumentScopeLabel | null | undefined }) {
  const badge = scopeBadge(label)
  if (!badge) return null
  return <Badge tone={tones[badge.tone]}>{badge.text}</Badge>
}
