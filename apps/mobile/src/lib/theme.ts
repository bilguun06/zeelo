import { palette, themes } from '@orgil/ui';
import { useColorScheme } from 'nativewind';

/** Raw colour values for places classNames can't reach (icons, SVG, gradients, charts). */
export function useTheme() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const c = dark ? themes.dark : themes.light;
  return {
    dark,
    c,
    palette,
    // Chart series — validated pair (light: on white, dark: on #181A24) for CVD separation & contrast.
    series: dark ? (['#EC5A3A', '#4F8EF5'] as const) : (['#F04A28', '#2F6FDB'] as const),
    icon: c.text,
    iconMuted: c.textMuted,
  };
}
