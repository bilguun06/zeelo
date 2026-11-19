/**
 * Zeelo design system tokens.
 * Single source of truth for the mobile app (NativeWind) and the admin dashboard (Tailwind).
 */

export const palette = {
  navy: '#14161F',
  navy2: '#1C1F2B',
  navy3: '#262A38',
  blue: '#FF5533',
  blueSoft: '#FFE9E2',
  mint: '#42D6A4',
  mintSoft: '#E3F8F0',
  background: '#FFF8F5',
  white: '#FFFFFF',
  text: '#14161F',
  textMuted: '#8C8481',
  border: '#F1E4DE',
  danger: '#EF5350',
  dangerSoft: '#FDECEC',
  warning: '#FFB547',
  warningSoft: '#FFF5E3',
} as const;

/** Semantic colours per theme. */
export const themes = {
  light: {
    background: palette.background,
    surface: palette.white,
    surfaceAlt: '#F8EEE9',
    text: palette.text,
    textMuted: palette.textMuted,
    border: palette.border,
    primary: palette.blue,
    accent: palette.mint,
    danger: palette.danger,
    warning: palette.warning,
  },
  dark: {
    background: '#0D0E14',
    surface: '#181A24',
    surfaceAlt: '#222533',
    text: '#F6F1EE',
    textMuted: '#8C8481',
    border: '#2C2F3D',
    primary: '#FF6A4D',
    accent: palette.mint,
    danger: '#FF6B68',
    warning: palette.warning,
  },
} as const;

export type ThemeName = keyof typeof themes;
export type ThemeColors = { [K in keyof (typeof themes)['light']]: string };

export const gradients = {
  card: [palette.navy, palette.navy3, '#C9401F'] as const,
  primary: [palette.blue, '#FF7A5C'] as const,
  mint: [palette.mint, '#2FBF8F'] as const,
  aurora: ['#14161F', '#2E2026', '#FF5533'] as const,
  /** Deep hero backdrop used behind headers. */
  hero: ['#0B0C12', '#1C1D29', '#4A2419'] as const,
  /** Premium card: midnight → electric → violet. */
  premium: ['#16171F', '#D93A1C', '#FF7A45'] as const,
  electric: ['#FF5533', '#FF8A4C'] as const,
  violet: ['#3A3D4D', '#14161F'] as const,
  sunset: ['#FFB547', '#FF7A59'] as const,
  ocean: ['#2EC4B6', '#159A8C'] as const,
  emerald: ['#42D6A4', '#16A37A'] as const,
  rose: ['#FF7A90', '#EF5350'] as const,
};

/** Accent pairs for icon tiles (gradient start/end) — decorative only, not data colours. */
export const accentTiles = {
  blue: gradients.electric,
  mint: gradients.emerald,
  amber: gradients.sunset,
  violet: gradients.violet,
  ocean: gradients.ocean,
  rose: gradients.rose,
} as const;
export type AccentTile = keyof typeof accentTiles;

export const radii = { sm: 12, md: 18, lg: 22, xl: 24, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const fontFamily = {
  display: 'Manrope',
  body: 'Inter',
} as const;

export const typeScale = {
  hero: { size: 34, lineHeight: 40, weight: '800' },
  h1: { size: 26, lineHeight: 32, weight: '800' },
  h2: { size: 20, lineHeight: 26, weight: '700' },
  h3: { size: 17, lineHeight: 22, weight: '700' },
  body: { size: 15, lineHeight: 22, weight: '400' },
  caption: { size: 13, lineHeight: 18, weight: '500' },
  micro: { size: 11, lineHeight: 14, weight: '600' },
} as const;

export const shadows = {
  card: '0 8px 24px rgba(20, 22, 31, 0.06)',
  raised: '0 16px 40px rgba(20, 22, 31, 0.12)',
  glow: '0 10px 30px rgba(255, 85, 51, 0.35)',
} as const;

/** Status colours used consistently across apps for loan/application states. */
export const statusTone: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  UNDER_REVIEW: 'info',
  INFO_REQUESTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  DISBURSED: 'success',
  COMPLETED: 'neutral',
  ACTIVE: 'info',
  OVERDUE: 'danger',
  PAID: 'success',
  PARTIAL: 'warning',
};
