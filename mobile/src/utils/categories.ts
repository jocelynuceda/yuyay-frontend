import type { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import type { Colors } from '../theme';

/** Los exámenes son registros de salud, pero tienen su propia sección y no van en el perfil clínico. */
export const EXAM_CATEGORY = 'EXAM_RESULT';

/** Ícono, colores (claves del tema: usar `colors[meta.bg]`) y nombre en plural de cada categoría de salud (códigos del backend). */
export const categoryMeta: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    bg: keyof Colors;
    fg: keyof Colors;
    plural: string;
    /** Reemplaza al ícono y a su fondo de color. */
    image?: ImageSourcePropType;
  }
> = {
  ALLERGY: {
    icon: 'flower-outline',
    bg: 'accent',
    fg: 'ink',
    plural: 'Alergias',
    image: require('../../assets/categories/allergy.png'),
  },
  CONDITION: {
    icon: 'pulse-outline',
    bg: 'soft',
    fg: 'softText',
    plural: 'Condiciones',
    image: require('../../assets/categories/condition.png'),
  },
  MEDICATION: {
    icon: 'medkit-outline',
    bg: 'primaryTint',
    fg: 'primary',
    plural: 'Medicación',
    image: require('../../assets/categories/medication.png'),
  },
  IMMUNIZATION: {
    icon: 'shield-checkmark-outline',
    bg: 'primary',
    fg: 'white',
    plural: 'Vacunas',
    image: require('../../assets/categories/immunization.png'),
  },
  EPISODE: {
    icon: 'flash-outline',
    bg: 'amberBg',
    fg: 'amberText',
    plural: 'Episodios',
    image: require('../../assets/categories/episode.png'),
  },
  EXAM_RESULT: {
    icon: 'flask-outline',
    bg: 'soft',
    fg: 'softText',
    plural: 'Exámenes',
    image: require('../../assets/categories/exam.png'),
  },
};

export const fallbackCategory = categoryMeta.CONDITION;
