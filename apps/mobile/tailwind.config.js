/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset'), require('@orgil/ui/tailwind-preset')],
  theme: {
    extend: {
      fontFamily: {
        // React Native needs one family per weight.
        inter: ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
        'inter-bold': ['Inter_700Bold'],
        display: ['Manrope_800ExtraBold'],
        'display-bold': ['Manrope_700Bold'],
      },
    },
  },
};
