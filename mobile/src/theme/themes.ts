import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { configureFonts, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

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
  /** Alice Blue, Wisteria Blue, Pearl Aqua, Dusk Blue y Deep Navy (la paleta original de Yuyay). */
  aurora: {
    colors: {
      primary: '#3E5BA3',
      ink: '#0C0D45',
      accent: '#75CBD1',
      soft: '#80A4D4',
      cream: '#80A4D4',
      surface: '#DAE8FB',
      muted: '#5B6187',
      danger: '#D6336C',
      dangerBg: '#FDECF2',
      accentText: '#1F7B82',
      softText: '#1A1F66',
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
  /** Porcelain Cream, Blush Fizz, Cherry Vibes, Crushed Aluminum y Cola Shadow. */
  cherry: {
    colors: {
      primary: '#B15B64',
      ink: '#3E2C26',
      accent: '#E6B3B8',
      soft: '#D8D1CC',
      cream: '#F6DDE0',
      surface: '#F3EEEC',
      muted: '#775E54',
      danger: '#A8323E',
      dangerBg: '#FBE6E8',
      accentText: '#8E3F48',
      softText: '#775E54',
      onAccent: '#3E2C26',
      onHero: '#3E2C26',
      onHeroSoft: '#775E54',
      border: 'rgba(62, 44, 38, 0.08)',
      line: 'rgba(62, 44, 38, 0.12)',
      primaryTint: 'rgba(177, 91, 100, 0.1)',
      accentTint: 'rgba(230, 179, 184, 0.35)',
      placeholder: 'rgba(119, 94, 84, 0.55)',
    },
    gradients: {
      hero: ['#E6B3B8', '#EDC8CB', '#F3EEEC'],
      strong: ['#B15B64', '#C67880'],
      dark: ['#3E2C26', '#5A443B', '#775E54'],
    },
    heroIsDark: false,
  },
  /**
   * Light Cyan y Frosted Blue en versión pastel, Wisteria Blue y Medium Slate Blue, sin Honeydew. No trae tonos oscuros:
   * ink, muted y los *Text son derivados, y primary es un Slate Blue algo más oscuro para el texto blanco.
   */
  frosted: {
    colors: {
      primary: '#6A64C2',
      ink: '#1E2158',
      accent: '#80A4D4',
      soft: '#C4E8EF',
      cream: '#E4F5F8',
      surface: '#F0FAFC',
      muted: '#4A5680',
      danger: '#B02A63',
      dangerBg: '#FCE8F0',
      accentText: '#1F4F7A',
      softText: '#2E2C7E',
      onAccent: '#1E2158',
      onHero: '#1E2158',
      onHeroSoft: '#262A6B',
      border: 'rgba(30, 33, 88, 0.08)',
      line: 'rgba(30, 33, 88, 0.12)',
      primaryTint: 'rgba(123, 117, 201, 0.14)',
      accentTint: 'rgba(128, 164, 212, 0.28)',
      placeholder: 'rgba(74, 86, 128, 0.55)',
      tabPill: '#C4E8EF',
      onTabPill: '#1F4F7A',
      noticeTile: '#6A64C2',
      peopleStar: '#C4E8EF',
      peopleAction: '#C4E8EF',
      onPeopleAction: '#2E2C7E',
      emptyStar: '#6A64C2',
    },
    gradients: {
      hero: ['#80A4D4', '#A3C6E2', '#C4E8EF'],
      strong: ['#5F59B8', '#6A64C2'],
      dark: ['#1E2158', '#3D3A96', '#6A64C2'],
    },
    heroIsDark: false,
  },
} as const;

/** Paleta en uso: 'vintage', 'cobalto', 'verdigris', 'amatista', 'aurora', 'cherry' o 'frosted' */
const ACTIVE_PALETTE: keyof typeof palettes = 'frosted';

const palette = palettes[ACTIVE_PALETTE];

/** Combinaciones por defecto de estas piezas; una paleta puede definir las suyas. */
const defaultPieces = {
  tabPill: '#7B75C9',
  onTabPill: '#FFFFFF',
  noticeTile: '#7B75C9',
  peopleStar: '#DDF5E3',
  peopleAction: '#7B75C9',
  onPeopleAction: '#FFFFFF',
  emptyStar: '#FFFFFF',
};

const lightColors = {
  ...defaultPieces,
  ...palette.colors,
  /** Fondo de tarjetas, campos y hojas */
  card: '#FFFFFF',
  /** Texto e íconos sobre fondos de color sólido (primary, danger, degradados oscuros) */
  white: '#FFFFFF',
  /** Texto sobre fondos de color ink (en oscuro ink es claro, así que este pasa a oscuro) */
  onInk: '#FFFFFF',
  /** Panel translúcido sobre fondos de color */
  glass: 'rgba(255, 255, 255, 0.7)',
  amberBg: '#FDEFC8',
  amberText: '#8A5A00',
};

export type Colors = { [K in keyof typeof lightColors]: string };

/**
 * Modo oscuro: índigo profundo con lila, los mismos tonos que el modo oscuro de la web (web/src/index.css).
 * primary queda en un lila medio para que el texto blanco encima siga leyéndose.
 */
const darkColors: Colors = {
  primary: '#7A74DA',
  ink: '#EEEBFA',
  accent: '#9DB9E3',
  soft: '#2F2C5E',
  cream: '#28264F',
  surface: '#16152E',
  muted: '#B3B0D6',
  danger: '#FF8DB5',
  dangerBg: '#3D1730',
  accentText: '#A9D3F0',
  softText: '#D8D4FF',
  onAccent: '#16152E',
  onHero: '#EEEBFA',
  onHeroSoft: '#CFCBEE',
  border: 'rgba(238, 235, 250, 0.08)',
  line: 'rgba(238, 235, 250, 0.14)',
  primaryTint: 'rgba(171, 166, 242, 0.16)',
  accentTint: 'rgba(157, 185, 227, 0.18)',
  placeholder: 'rgba(179, 176, 214, 0.7)',
  tabPill: '#2F2C5E',
  onTabPill: '#A9D3F0',
  noticeTile: '#7A74DA',
  peopleStar: '#2F2C5E',
  peopleAction: '#2F2C5E',
  onPeopleAction: '#D8D4FF',
  emptyStar: '#7A74DA',
  card: '#211F42',
  white: '#FFFFFF',
  onInk: '#16152E',
  glass: 'rgba(33, 31, 66, 0.72)',
  amberBg: '#3A2E10',
  amberText: '#F5C96A',
};

type GradientStops = readonly [string, string, ...string[]];

export interface Gradients {
  hero: GradientStops;
  strong: GradientStops;
  dark: GradientStops;
}

const darkGradients: Gradients = {
  hero: ['#3D3A96', '#4A4FA3', '#2F4B78'],
  strong: ['#5F59B8', '#7A74DA'],
  dark: ['#2F2C5E', '#3D3A96', '#5F59B8'],
};

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

function buildTheme(dark: boolean, colors: Colors, gradients: Gradients, heroIsDark: boolean) {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  const navBase = dark ? DarkTheme : DefaultTheme;
  return {
    dark,
    colors,
    /** Degradados de la marca: cabeceras y banners (hero), tarjetas destacadas (strong) y botones oscuros (dark). */
    gradients,
    /** La cabecera es oscura: logo y textos claros encima */
    heroIsDark,
    shadow: {
      shadowColor: dark ? '#000000' : colors.ink,
      shadowOpacity: dark ? 0.4 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    /** Tema de React Native Paper con la paleta y tipografía de Yuyay */
    paperTheme: {
      ...base,
      roundness: 4,
      fonts: configureFonts({ config: { fontFamily: fonts.regular } }),
      colors: {
        ...base.colors,
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
        surface: colors.card,
        surfaceVariant: colors.cream,
        onSurface: colors.ink,
        onSurfaceVariant: colors.muted,
        outline: colors.line,
        error: colors.danger,
        elevation: { ...base.colors.elevation, level3: colors.card },
      },
    },
    navigationTheme: {
      ...navBase,
      colors: {
        ...navBase.colors,
        primary: colors.primary,
        background: colors.surface,
        card: colors.card,
        text: colors.ink,
        border: colors.line,
      },
    },
  };
}

export type Theme = ReturnType<typeof buildTheme>;

export const lightTheme: Theme = buildTheme(false, lightColors, palette.gradients, palette.heroIsDark);
export const darkTheme: Theme = buildTheme(true, darkColors, darkGradients, true);

