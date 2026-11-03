// Tokens do design system AT Solutions. Componentes usam só os tokens de papel
// (`cores[esquema]`), nunca `marca` direto.
import type { TextStyle } from 'react-native'

export const marca = {
  navy900: '#0B2545',
  navy700: '#163A6B',
  navy950: '#07182D',
  red500: '#E3141B',
  red600: '#B80F15',
  red300: '#FF6B71',
  white: '#FFFFFF',
  gray50: '#F5F7FA',
  gray100: '#EDF1F6',
  gray200: '#DDE3EB',
  gray400: '#94A3B8',
  gray500: '#556274',
  gray700: '#4A5568',
  gray900: '#0F172A',
} as const

export type CoresPapel = {
  bg: string
  surface: string
  surfaceAlt: string
  border: string
  borderStrong: string
  text: string
  textHeading: string
  textSecondary: string
  textMuted: string
  textAccent: string
  primary: string
  onPrimary: string
  accent: string
  onAccent: string
  success: string
  warning: string
  danger: string
  info: string
}

export type Esquema = 'claro' | 'escuro'

export const cores: Record<Esquema, CoresPapel> = {
  claro: {
    bg: marca.gray50,
    surface: marca.white,
    surfaceAlt: marca.gray100,
    border: marca.gray200,
    borderStrong: marca.gray400,
    text: marca.gray900,
    textHeading: marca.navy900,
    textSecondary: marca.gray700,
    textMuted: marca.gray500,
    textAccent: marca.red600,
    primary: marca.navy900,
    onPrimary: marca.white,
    accent: marca.red500,
    onAccent: marca.white,
    success: '#15803D',
    warning: '#B45309',
    danger: marca.red600,
    info: marca.navy700,
  },
  escuro: {
    bg: marca.navy950,
    surface: marca.navy900,
    surfaceAlt: '#10304F',
    border: '#1E3D63',
    borderStrong: '#2E5585',
    text: '#E6ECF3',
    textHeading: marca.white,
    textSecondary: '#B4C2D3',
    textMuted: '#8597AD',
    textAccent: marca.red300,
    primary: marca.white,
    onPrimary: marca.navy900,
    accent: marca.red500,
    onAccent: marca.white,
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: marca.red300,
    info: '#7FA7E0',
  },
}

export const fontes = {
  display: {
    medium: 'Saira_500Medium',
    semibold: 'Saira_600SemiBold',
    bold: 'Saira_700Bold',
  },
  corpo: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
  },
} as const

// Família do peso certo, sem fontWeight (Android ignora peso em fonte custom).
export const tipografia = {
  display: { fontFamily: fontes.display.bold, fontSize: 36, lineHeight: 40 },
  h1: { fontFamily: fontes.display.bold, fontSize: 32, lineHeight: 37 },
  h2: { fontFamily: fontes.display.semibold, fontSize: 26, lineHeight: 31 },
  h3: { fontFamily: fontes.display.semibold, fontSize: 24, lineHeight: 31 },
  overline: {
    fontFamily: fontes.display.semibold,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  h4: { fontFamily: fontes.corpo.semibold, fontSize: 20, lineHeight: 28 },
  bodyLg: { fontFamily: fontes.corpo.regular, fontSize: 18, lineHeight: 29 },
  body: { fontFamily: fontes.corpo.regular, fontSize: 16, lineHeight: 26 },
  small: { fontFamily: fontes.corpo.regular, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fontes.corpo.medium, fontSize: 12, lineHeight: 17 },
  valor: {
    fontFamily: fontes.display.semibold,
    fontSize: 28,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  rotulo: { fontFamily: fontes.corpo.semibold, fontSize: 14, lineHeight: 21 },
} satisfies Record<string, TextStyle>

export type VarianteTexto = keyof typeof tipografia

export const espaco = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const

export const raio = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const

/** Sombra só no claro; no escuro, cards com borda. */
export function sombraCard(esquema: Esquema) {
  return esquema === 'claro'
    ? {
        shadowColor: marca.navy900,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }
    : {}
}
