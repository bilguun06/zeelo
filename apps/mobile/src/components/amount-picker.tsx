import Slider from '@react-native-community/slider';
import { formatMNT } from '@orgil/shared';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { haptic, Text } from './ui';

/** Amount slider snapped to the product's configured step, with ± buttons. Values are whole-step integers. */
export function AmountPicker({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const { c } = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const bump = (dir: 1 | -1) => { haptic.tap(); onChange(clamp(value + dir * step)); };
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => bump(-1)} className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-alt active:opacity-70 dark:bg-surface-altdark"><Minus size={20} color={c.text} /></Pressable>
        <Text className="font-display text-[32px] text-ink dark:text-ink-inverse">{formatMNT(String(value))}</Text>
        <Pressable onPress={() => bump(1)} className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-alt active:opacity-70 dark:bg-surface-altdark"><Plus size={20} color={c.text} /></Pressable>
      </View>
      <Slider
        style={{ height: 44, marginTop: 8 }}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={(v) => onChange(clamp(v))}
        onSlidingComplete={() => haptic.tap()}
        minimumTrackTintColor={c.primary}
        maximumTrackTintColor={c.border}
        thumbTintColor={c.primary}
      />
      <View className="flex-row justify-between">
        <Text variant="caption" className="text-[12px]">{formatMNT(String(min))}</Text>
        <Text variant="caption" className="text-[12px]">{formatMNT(String(max))}</Text>
      </View>
    </View>
  );
}
