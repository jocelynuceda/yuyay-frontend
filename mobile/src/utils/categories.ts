import type { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/** Los exámenes son registros de salud, pero tienen su propia sección y no van en el perfil clínico. */
export const EXAM_CATEGORY = 'EXAM_RESULT';

/** Ícono, colores y nombre en plural de cada categoría de salud (códigos del backend). */
export const categoryMeta: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; plural: string }
> = {
  ALLERGY: { icon: 'flower-outline', bg: colors.accent, fg: colors.ink, plural: 'Alergias' },
  CONDITION: { icon: 'pulse-outline', bg: colors.soft, fg: colors.softText, plural: 'Condiciones' },
  MEDICATION: { icon: 'medkit-outline', bg: colors.primaryTint, fg: colors.primary, plural: 'Medicación' },
  IMMUNIZATION: { icon: 'shield-checkmark-outline', bg: colors.primary, fg: colors.white, plural: 'Vacunas' },
  EPISODE: { icon: 'flash-outline', bg: colors.amberBg, fg: colors.amberText, plural: 'Episodios' },
  EXAM_RESULT: { icon: 'flask-outline', bg: colors.soft, fg: colors.softText, plural: 'Exámenes' },
};

export const fallbackCategory = categoryMeta.CONDITION;
