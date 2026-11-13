/**
 * Catálogo de avatares de león (el mismo de mobile/src/components/LionAvatar.tsx).
 */
export type LionKind = 'adult' | 'cub' | 'elder'
export type LionVariant = 'lion' | 'lioness'
export type AvatarChoice = { kind: LionKind; variant: LionVariant }
export type AvatarId = `${LionKind}-${LionVariant}`

/** Recorte de la cabeza en public/lions (copia de mobile/assets/lions/*-face.png). */
export const avatarSrc = ({ kind, variant }: AvatarChoice) => `/lions/${kind}-${variant}-face.png`

const labels: Record<LionKind, Record<LionVariant, string>> = {
  cub: { lion: 'Leoncito', lioness: 'Leoncita' },
  adult: { lion: 'León', lioness: 'Leona' },
  elder: { lion: 'León abuelo', lioness: 'Leona abuela' },
}

/** Cachorro si es menor de edad, león viejo desde los 60 y adulto en los demás casos (o sin edad). */
export function lionForAge(age: number | null): LionKind {
  if (age === null) return 'adult'
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

/** Avatar automático: la edad elige el león y el id alterna león y leona (el backend no guarda el sexo). */
export const defaultAvatar = (age: number | null, id?: number): AvatarChoice => ({
  kind: lionForAge(age),
  variant: id !== undefined && id % 2 === 1 ? 'lioness' : 'lion',
})
