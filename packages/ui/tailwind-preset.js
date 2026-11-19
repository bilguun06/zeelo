/**
 * Shared Tailwind preset — used by apps/admin (Tailwind) and apps/mobile (NativeWind).
 * Kept as plain CommonJS so both toolchains can require() it without a build step.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#14161F', 2: '#1C1F2B', 3: '#262A38' },
        brand: { DEFAULT: '#FF5533', soft: '#FFE9E2', dark: '#FF6A4D' },
        mint: { DEFAULT: '#42D6A4', soft: '#E3F8F0' },
        canvas: { DEFAULT: '#FFF8F5', dark: '#0D0E14' },
        surface: { DEFAULT: '#FFFFFF', dark: '#181A24', alt: '#F8EEE9', altdark: '#222533' },
        ink: { DEFAULT: '#14161F', muted: '#8C8481', inverse: '#F6F1EE' },
        line: { DEFAULT: '#F1E4DE', dark: '#2C2F3D' },
        danger: { DEFAULT: '#EF5350', soft: '#FDECEC' },
        warning: { DEFAULT: '#FFB547', soft: '#FFF5E3' },
      },
      borderRadius: {
        card: '22px',
        xl2: '18px',
        xl3: '24px',
      },
      fontFamily: {
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 24px rgba(20, 22, 31, 0.06)',
        raised: '0 16px 40px rgba(20, 22, 31, 0.12)',
        glow: '0 10px 30px rgba(255, 85, 51, 0.35)',
      },
    },
  },
};
