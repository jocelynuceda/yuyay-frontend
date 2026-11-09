import type { Ionicons } from '@expo/vector-icons';
import type { Colors } from '../theme';

/** Los exámenes son registros de salud, pero tienen su propia sección y no van en el perfil clínico. */
export const EXAM_CATEGORY = 'EXAM_RESULT';

/** Ícono, colores (claves del tema: usar `colors[meta.bg]`) y nombre en plural de cada categoría de salud (códigos del backend). */
export const categoryMeta: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; bg: keyof Colors; fg: keyof Colors; plural: string }
> = {
  ALLERGY: { icon: 'flower-outline', bg: 'accent', fg: 'ink', plural: 'Alergias' },
  CONDITION: { icon: 'pulse-outline', bg: 'soft', fg: 'softText', plural: 'Condiciones' },
  MEDICATION: { icon: 'medkit-outline', bg: 'primaryTint', fg: 'primary', plural: 'Medicación' },
  IMMUNIZATION: { icon: 'shield-checkmark-outline', bg: 'primary', fg: 'white', plural: 'Vacunas' },
  EPISODE: { icon: 'flash-outline', bg: 'amberBg', fg: 'amberText', plural: 'Episodios' },
  EXAM_RESULT: { icon: 'flask-outline', bg: 'soft', fg: 'softText', plural: 'Exámenes' },
};

export const fallbackCategory = categoryMeta.CONDITION;
