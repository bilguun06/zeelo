import { formatMNT, formatMNTCompact } from '@orgil/shared';
import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgLinear, Path, Rect, Stop } from 'react-native-svg';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Sheen, Tilt3D } from './three-d';
import { haptic, Text } from './ui';

const native = Platform.OS !== 'web';

/** Counts up to a money value (display only; the string value is the source of truth). */
export function AnimatedAmount({ value, className }: { value: string; className?: string }) {
  const [shown, setShown] = useState('0');
  useEffect(() => {
    const target = Number(value);
    const start = Date.now();
    const duration = 900;
    let raf: ReturnType<typeof requestAnimationFrame>;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? value : String(Math.round(target * eased)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text className={className}>{formatMNT(shown)}</Text>;
}

/** EMV-style chip drawn in SVG. */
function Chip() {
  return (
    <Svg width={42} height={32} viewBox="0 0 42 32">
      <Defs>
        <SvgLinear id="chipG" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE7A3" /><Stop offset="0.5" stopColor="#E7B54E" /><Stop offset="1" stopColor="#FFDD8A" /></SvgLinear>
      </Defs>
      <Rect x={0.5} y={0.5} width={41} height={31} rx={7} fill="url(#chipG)" stroke="#C99A3A" />
      <Path d="M14 1 V31 M28 1 V31 M1 11 H14 M28 11 H41 M1 21 H14 M28 21 H41" stroke="#B5852E" strokeWidth={1.2} opacity={0.7} />
      <Rect x={14} y={8} width={14} height={16} rx={3} fill="none" stroke="#B5852E" strokeWidth={1.2} opacity={0.7} />
    </Svg>
  );
}

/** The hero "Таны зээлийн эрх" card: layered 3D card stack, tilt on touch, holographic sheen, animated amount. */
export function CreditLimitCard({ limit, available, used, indicative, onApply }: { limit: string; available: string; used: string; indicative: boolean; onApply: () => void }) {
  const { t } = useI18n();
  const enter = useRef(new Animated.Value(0)).current;
  const ratio = Number(limit) > 0 ? Math.min(1, Number(available) / Number(limit)) : 0;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: native, speed: 6, bounciness: 8 }).start();
    Animated.timing(bar, { toValue: ratio, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [ratio, enter, bar]);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }}>
      {/* back cards for depth */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 26, right: 26, top: -16, height: 60, borderRadius: 24, backgroundColor: '#FFB547', opacity: 0.6, transform: [{ perspective: 600 }, { rotateX: '18deg' }] }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, top: -8, height: 60, borderRadius: 26, backgroundColor: '#FF8A4C', opacity: 0.75, transform: [{ perspective: 600 }, { rotateX: '12deg' }] }} />
      <Tilt3D max={9}>
        <View style={{ borderRadius: 28, shadowColor: '#FF5533', shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 14 }}>
          <LinearGradient colors={[...gradients.premium]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
            {/* holographic rings */}
            <Svg pointerEvents="none" width={260} height={260} viewBox="0 0 260 260" style={{ position: 'absolute', right: -90, top: -90, opacity: 0.35 }}>
              {[120, 95, 70, 45].map((r) => <Circle key={r} cx={130} cy={130} r={r} stroke="#fff" strokeOpacity={0.25} strokeWidth={1} fill="none" />)}
            </Svg>
            <View pointerEvents="none" style={{ position: 'absolute', left: -50, bottom: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: '#FFB547', opacity: 0.182 }} />
            <Sheen />
            <View className="flex-row items-center justify-between">
              <Chip />
              <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Sparkles size={12} color="#FFE0A3" /><Text className="font-inter-semibold text-[11px] text-white">Zeelo Premium</Text></View>
            </View>
            <Text className="mt-5 font-inter-medium text-[13px] text-white/70">{t('home.creditLimit')}</Text>
            <AnimatedAmount value={limit} className="mt-1 font-display text-[38px] leading-[46px] text-white" />
            <Text className="font-inter text-[13px] text-mint">{t('home.canBorrow')}</Text>

            <View className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
              <Animated.View style={{ height: 10, borderRadius: 5, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), overflow: 'hidden' }}>
                <LinearGradient colors={['#42D6A4', '#9BEBD0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
              </Animated.View>
            </View>
        <View className="mt-3 flex-row justify-between">
          <View>
            <Text className="text-[11px] text-white/60">{t('home.available')}</Text>
            <Text className="mt-0.5 font-inter-semibold text-[14px] text-white">{formatMNT(available)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-[11px] text-white/60">{t('home.used')}</Text>
            <Text className="mt-0.5 font-inter-semibold text-[14px] text-white">{formatMNT(used)}</Text>
          </View>
        </View>

            <Pressable onPress={() => { haptic.tap(); onApply(); }} className="mt-5 h-14 flex-row items-center justify-center gap-2 overflow-hidden rounded-[18px] bg-white active:opacity-90">
              <Text className="font-inter-bold text-[15px] tracking-[2px] text-navy">{t('home.getLoan')}</Text>
              <View className="h-7 w-7 items-center justify-center rounded-full bg-navy"><ArrowRight size={15} color="#fff" /></View>
            </Pressable>
            {indicative && <Text className="mt-3 text-center text-[10px] leading-[14px] text-white/50">{t('home.limitIndicative')}</Text>}
          </LinearGradient>
        </View>
      </Tilt3D>
    </Animated.View>
  );
}

/** Six-month borrowed vs repaid bars (two validated series, one axis, legend + direct totals). */
export function FlowChart({ data }: { data: { month: string; borrowed: string; repaid: string }[] }) {
  const { series, c } = useTheme();
  const { t, lang } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [Number(d.borrowed), Number(d.repaid)]));
  const W = 320, H = 140, groupW = W / data.length, barW = 12;
  const sel = active !== null ? data[active] : null;

  return (
    <View>
      <View className="mb-3 h-10 justify-center">
        {sel ? (
          <View className="flex-row gap-4">
            <Text variant="caption">{sel.month}</Text>
            <Text className="text-[13px]" style={{ color: series[0] }}>● <Text className="font-inter-semibold text-[13px] text-ink dark:text-ink-inverse">{formatMNTCompact(sel.borrowed, lang)}</Text></Text>
            <Text className="text-[13px]" style={{ color: series[1] }}>● <Text className="font-inter-semibold text-[13px] text-ink dark:text-ink-inverse">{formatMNTCompact(sel.repaid, lang)}</Text></Text>
          </View>
        ) : (
          <View className="flex-row gap-4">
            <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series[0] }} /><Text variant="caption">{t('home.borrowed')}</Text></View>
            <View className="flex-row items-center gap-1.5"><View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series[1] }} /><Text variant="caption">{t('home.repaid')}</Text></View>
          </View>
        )}
      </View>
      <Svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`}>
        <Path d={`M0 ${H} H${W}`} stroke={c.border} strokeWidth={1} />
        {data.map((d, i) => {
          const x = i * groupW + groupW / 2;
          const hb = (Number(d.borrowed) / max) * (H - 8);
          const hr = (Number(d.repaid) / max) * (H - 8);
          const dim = active !== null && active !== i ? 0.35 : 1;
          return (
            <G key={d.month}>
              <Rect x={x - barW - 1} y={H - hb} width={barW} height={Math.max(hb, 0)} rx={4} fill={series[0]} opacity={dim} />
              <Rect x={x + 1} y={H - hr} width={barW} height={Math.max(hr, 0)} rx={4} fill={series[1]} opacity={dim} />
              <Rect x={i * groupW} y={0} width={groupW} height={H} fill="transparent" onPress={() => { haptic.tap(); setActive(active === i ? null : i); }} />
            </G>
          );
        })}
      </Svg>
      <View className="-mt-4 flex-row">
        {data.map((d) => <Text key={d.month} variant="caption" className="flex-1 text-center text-[11px]">{Number(d.month.slice(5))}{lang === 'mn' ? '-р' : ''}</Text>)}
      </View>
    </View>
  );
}

export function ProgressRing({ progress, size = 56, label, onDark }: { progress: number; size?: number; label?: string; onDark?: boolean }) {
  const { c, series } = useTheme();
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? 'rgba(255,255,255,0.15)' : c.surfaceAlt} strokeWidth={6} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={onDark ? '#42D6A4' : series[1]} strokeWidth={6} fill="none" strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round" />
      </Svg>
      <Text className={`font-inter-bold text-[12px] ${onDark ? 'text-white' : 'text-ink dark:text-ink-inverse'}`}>{label ?? `${Math.round(progress * 100)}%`}</Text>
    </View>
  );
}

export function SuccessBadge() {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(s, { toValue: 1, useNativeDriver: native, speed: 5, bounciness: 14 }).start(); }, [s]);
  return (
    <Animated.View style={{ transform: [{ scale: s }] }} className="h-28 w-28 items-center justify-center rounded-full bg-mint-soft dark:bg-mint/15">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-mint"><Check size={40} color="#14161F" strokeWidth={3} /></View>
    </Animated.View>
  );
}

export function Steps({ step, total, label }: { step: number; total: number; label: string }) {
  const { t } = useI18n();
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row justify-between">
        <Text variant="micro">{t('apply.step', { a: step, b: total })}</Text>
        <Text variant="micro" className="text-brand">{label}</Text>
      </View>
      <View className="flex-row gap-1">
        {Array.from({ length: total }).map((_, i) => <View key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand' : 'bg-line dark:bg-line-dark'}`} />)}
      </View>
    </View>
  );
}
