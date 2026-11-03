import { configureFonts, MD3LightTheme } from 'react-native-paper';

/**
 * Paletas de Yuyay. Los nombres de los tokens describen el uso, no el tono, así que para probar
 * otra paleta basta con cambiar ACTIVE_PALETTE.
 */
const palettes = {
  /** Café, celeste agua y crema: el celeste manda y el crema es solo acento. */
  vintage: {
    colors: {
      primary: '#694A47',
      ink: '#3B2A28',
      accent: '#96C1C5',
      soft: '#D7E9EB',
      cream: '#FFF0DE',
      surface: '#EEF6F7',
      muted: '#6B7C7E',
      danger: '#B8463E',
      dangerBg: '#FBE7E4',
      accentText: '#3F6E73',
      softText: '#2F5C61',
      onAccent: '#3B2A28',
      onHero: '#3B2A28',
      onHeroSoft: '#2F5C61',
      border: 'rgba(59, 42, 40, 0.08)',
      line: 'rgba(59, 42, 40, 0.12)',
      primaryTint: 'rgba(105, 74, 71, 0.1)',
      accentTint: 'rgba(150, 193, 197, 0.28)',
      placeholder: 'rgba(107, 124, 126, 0.55)',
    },
    gradients: {
      hero: ['#7FB3B8', '#96C1C5', '#C2DEE0'],
      strong: ['#694A47', '#8A6662'],
      dark: ['#3B2A28', '#4E3835', '#7A5C58'],
    },
    /** La cabecera es clara: logo y textos oscuros encima */
    heroIsDark: false,
  },
  /** Cobalt Blue, Pitch Black, Berry Blush, Pink Mist y Almond Silk. */
  cobalto: {
    colors: {
      primary: '#0F43B2',
      ink: '#0D0A05',
      accent: '#A85080',
      soft: '#EDA0B3',
      cream: '#EFD2C9',
      surface: '#FBF4F1',
      muted: '#6E5F63',
      danger: '#C62E46',
      dangerBg: '#FCE8EA',
      accentText: '#8A3A66',
      softText: '#6E2A4E',
      onAccent: '#FFFFFF',
      onHero: '#FFFFFF',
      onHeroSoft: 'rgba(255, 255, 255, 0.85)',
      border: 'rgba(13, 10, 5, 0.08)',
      line: 'rgba(13, 10, 5, 0.12)',
      primaryTint: 'rgba(15, 67, 178, 0.08)',
      accentTint: 'rgba(168, 80, 128, 0.22)',
      placeholder: 'rgba(110, 95, 99, 0.55)',
    },
    gradients: {
      hero: ['#0F43B2', '#A85080', '#EDA0B3'],
      strong: ['#A85080', '#C46C98'],
      dark: ['#0D0A05', '#2A2420', '#5A4F4B'],
    },
    heroIsDark: true,
  },
  /** Honeydew, Blush Pop, Pastel Petal, Verdigris y Baltic Blue. */
  verdigris: {
    colors: {
      primary: '#005F87',
      ink: '#0B2E3D',
      accent: '#30A496',
      soft: '#E5C5D2',
      cream: '#F2A4D8',
      surface: '#F2FFE9',
      muted: '#5E7A80',
      danger: '#C2365A',
      dangerBg: '#FCE6EE',
      accentText: '#1F7469',
      softText: '#6B2E4F',
      onAccent: '#0B2E3D',
      onHero: '#0B2E3D',
      onHeroSoft: '#0F4A4F',
      border: 'rgba(11, 46, 61, 0.08)',
      line: 'rgba(11, 46, 61, 0.12)',
      primaryTint: 'rgba(0, 95, 135, 0.08)',
      accentTint: 'rgba(48, 164, 150, 0.18)',
      placeholder: 'rgba(94, 122, 128, 0.55)',
    },
    gradients: {
      hero: ['#30A496', '#62BFB2', '#A9DDD3'],
      strong: ['#005F87', '#1F7FA6'],
      dark: ['#0B2E3D', '#0F3F52', '#2B6A80'],
    },
    heroIsDark: false,
  },
  /** Lavender Blush, Powder Blush, Muted Teal, Pacific Cyan y Dark Amethyst. */
  amatista: {
    colors: {
      primary: '#3E828E',
      ink: '#27153D',
      accent: '#A6C9B6',
      soft: '#F6B6B7',
      cream: '#F6B6B7',
      surface: '#FFEBED',
      muted: '#7A6A78',
      danger: '#B83A52',
      dangerBg: '#FCE3E6',
      accentText: '#2F6B74',
      softText: '#6B2B3F',
      onAccent: '#27153D',
      onHero: '#27153D',
      onHeroSoft: '#3A4F45',
      border: 'rgba(39, 21, 61, 0.08)',
      line: 'rgba(39, 21, 61, 0.12)',
      primaryTint: 'rgba(62, 130, 142, 0.1)',
      accentTint: 'rgba(166, 201, 182, 0.35)',
      placeholder: 'rgba(122, 106, 120, 0.55)',
    },
    gradients: {
      hero: ['#A6C9B6', '#BBD7C8', '#D7E8DE'],
      strong: ['#3E828E', '#5A9AA4'],
      dark: ['#27153D', '#3A2456', '#5E4A7A'],
    },
    heroIsDark: false,
  },
  /** Alice Blue, Thistle, Pearl Aqua, Dusk Blue y Deep Navy (la paleta original de Yuyay). */
  aurora: {
    colors: {
      primary: '#3E5BA3',
      ink: '#0C0D45',
      accent: '#75CBD1',
      soft: '#F2D2FF',
      cream: '#F2D2FF',
      surface: '#DAE8FB',
      muted: '#5B6187',
      danger: '#D6336C',
      dangerBg: '#FDECF2',
      accentText: '#1F7B82',
      softText: '#5E2C7A',
      onAccent: '#0C0D45',
      onHero: '#0C0D45',
      onHeroSoft: '#2A3A6B',
      border: 'rgba(12, 13, 69, 0.08)',
      line: 'rgba(12, 13, 69, 0.12)',
      primaryTint: 'rgba(62, 91, 163, 0.1)',
      accentTint: 'rgba(117, 203, 209, 0.28)',
      placeholder: 'rgba(91, 97, 135, 0.55)',
    },
    gradients: {
      hero: ['#75CBD1', '#9DD8DC', '#C9E3F8'],
      strong: ['#3E5BA3', '#5A78C0'],
      dark: ['#0C0D45', '#1C1F66', '#3E5BA3'],
    },
    heroIsDark: false,
  },
} as const;

/** Paleta en uso: 'vintage', 'cobalto', 'verdigris', 'amatista' o 'aurora' */
const ACTIVE_PALETTE: keyof typeof palettes = 'aurora';

const palette = palettes[ACTIVE_PALETTE];

export const colors = {
  ...palette.colors,
  white: '#FFFFFF',
  amberBg: '#FDEFC8',
  amberText: '#8A5A00',
};

/** Degradados de la marca: cabeceras y banners (hero), tarjetas destacadas (strong) y botones oscuros (dark). */
export const gradients = palette.gradients;

export const heroIsDark: boolean = palette.heroIsDark;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export const shadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

/** Tema de React Native Paper con la paleta y tipografía de Yuyay */
export const paperTheme = {
  ...MD3LightTheme,
  roundness: 4,
  fonts: configureFonts({ config: { fontFamily: fonts.regular } }),
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.white,
    primaryContainer: colors.cream,
    onPrimaryContainer: colors.ink,
    secondary: colors.accent,
    secondaryContainer: colors.cream,
    onSecondaryContainer: colors.ink,
    tertiary: colors.softText,
    tertiaryContainer: colors.soft,
    background: colors.surface,
    surface: colors.white,
    surfaceVariant: colors.cream,
    onSurface: colors.ink,
    onSurfaceVariant: colors.muted,
    outline: colors.line,
    error: colors.danger,
  },
};
