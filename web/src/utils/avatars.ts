import type { Gender } from '../types'

/**
 * Catálogo de avatares de león (el mismo de mobile/src/components/LionAvatar.tsx).
 */
/** `default`: sin edad registrada (el león de melena grande). No es una opción del selector. */
export type LionKind = 'adult' | 'cub' | 'elder' | 'default'
export type LionVariant = 'lion' | 'lioness'
export type AvatarChoice = { kind: LionKind; variant: LionVariant }
export type AvatarId = `${LionKind}-${LionVariant}`

/** Avatar redondo en public/lions (copia de mobile/assets/lions/*-face.png). Sin edad, la leona usa la adulta. */
export const avatarSrc = ({ kind, variant }: AvatarChoice) =>
  kind === 'default' && variant === 'lioness' ? '/lions/adult-lioness-face.png' : `/lions/${kind}-${variant}-face.png`

const labels: Record<LionKind, Record<LionVariant, string>> = {
  cub: { lion: 'Leoncito', lioness: 'Leoncita' },
  adult: { lion: 'León', lioness: 'Leona' },
  elder: { lion: 'León abuelo', lioness: 'Leona abuela' },
  default: { lion: 'León', lioness: 'Leona' },
}

/** Cachorro si es menor de edad, abuelo desde los 60, adulto entre medio y el de melena si no hay edad. */
export function lionForAge(age: number | null): LionKind {
  if (age === null) return 'default'
  if (age < 18) return 'cub'
  if (age >= 60) return 'elder'
  return 'adult'
}

export const avatarId = ({ kind, variant }: AvatarChoice): AvatarId => `${kind}-${variant}`
export const avatarLabel = ({ kind, variant }: AvatarChoice) => labels[kind][variant]

/** Opciones del selector, de menor a mayor edad. */
export const avatarOptions: (AvatarChoice & { id: AvatarId; label: string })[] = (['cub', 'adult', 'elder'] as const).flatMap(
  (kind) => (['lion', 'lioness'] as const).map((variant) => ({ kind, variant, id: avatarId({ kind, variant }), label: labels[kind][variant] })),
)

export function parseAvatarId(value: string | null | undefined): AvatarChoice | null {
  const option = avatarOptions.find((o) => o.id === value)
  return option ? { kind: option.kind, variant: option.variant } : null
}

/** Leona si es mujer y león si es hombre; sin género (u "otro") se alterna por id, y sin id es león. */
export function lionVariantFor(gender: Gender | null | undefined, id?: number): LionVariant {
  if (gender === 'FEMALE') return 'lioness'
  if (gender === 'MALE') return 'lion'
  return id !== undefined && id % 2 === 1 ? 'lioness' : 'lion'
}

/** Avatar automático: la edad elige el tipo de león y el género, león o leona. */
export const defaultAvatar = (age: number | null, id?: number, gender?: Gender | null): AvatarChoice => ({
  kind: lionForAge(age),
  variant: lionVariantFor(gender, id),
})
