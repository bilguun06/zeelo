import { statusTone } from '@orgil/ui';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, RefreshControl, ScrollView, Text as RNText, TextInput, View,
  type PressableProps, type TextInputProps, type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { twMerge } from 'tailwind-merge';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Backdrop } from './three-d';

export const haptic = {
  tap: () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {}),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

// NativeWind applies every class; merge so later utilities (e.g. a colour override) replace earlier ones.
export const cx = (...c: (string | false | null | undefined)[]) => twMerge(c.filter(Boolean).join(' '));

// ── Typography ──
type Variant = 'hero' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'micro' | 'label';
const VARIANTS: Record<Variant, string> = {
  hero: 'font-display text-[34px] leading-[40px] text-ink dark:text-ink-inverse',
  h1: 'font-display text-[26px] leading-[32px] text-ink dark:text-ink-inverse',
  h2: 'font-display-bold text-xl text-ink dark:text-ink-inverse',
  h3: 'font-inter-semibold text-[17px] text-ink dark:text-ink-inverse',
  body: 'font-inter text-[15px] leading-[22px] text-ink dark:text-ink-inverse',
  bodyStrong: 'font-inter-semibold text-[15px] text-ink dark:text-ink-inverse',
  caption: 'font-inter-medium text-[13px] text-ink-muted',
  micro: 'font-inter-semibold text-[11px] uppercase tracking-wider text-ink-muted',
  label: 'font-inter-semibold text-[13px] text-ink-muted',
};
// A caller-supplied text colour (e.g. text-brand) should win in dark mode too, so drop the variant's dark colour.
const COLOR_OVERRIDE = /(^|\s)text-(?!\[|center|left|right|justify)/;
export function Text({ variant = 'body', className, ...p }: TextProps & { variant?: Variant; className?: string }) {
  let base: string = VARIANTS[variant];
  if (className && COLOR_OVERRIDE.test(className) && !className.includes('dark:text-')) base = base.replace(/\sdark:text-\S+/g, '');
  return <RNText className={cx(base, className)} {...p} />;
}

// ── Buttons ──
type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'mint' | 'danger' | 'light';
const BTN: Record<BtnVariant, { box: string; text: string }> = {
  primary: { box: 'bg-brand', text: 'text-white' },
  secondary: { box: 'bg-surface-alt dark:bg-surface-altdark', text: 'text-ink dark:text-ink-inverse' },
  outline: { box: 'border border-line dark:border-line-dark', text: 'text-ink dark:text-ink-inverse' },
  ghost: { box: '', text: 'text-brand' },
  mint: { box: 'bg-mint', text: 'text-navy' },
  danger: { box: 'bg-danger', text: 'text-white' },
  light: { box: 'bg-white', text: 'text-navy' },
};
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, size = 'lg', className, ...rest }: {
  title: string; onPress?: () => void; variant?: BtnVariant; loading?: boolean; disabled?: boolean; icon?: ReactNode; size?: 'md' | 'lg'; className?: string;
} & Omit<PressableProps, 'onPress' | 'children'>) {
  const s = BTN[variant];
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }} className={className}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        onPress={() => { haptic.tap(); onPress?.(); }}
        className={cx('flex-row items-center justify-center gap-2 overflow-hidden rounded-[18px] px-5', size === 'lg' ? 'h-14' : 'h-11', s.box, (disabled || loading) && 'opacity-50')}
        style={variant === 'primary' ? { shadowColor: '#FF5533', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 } : undefined}
        {...rest}
      >
        {variant === 'primary' && (
          <LinearGradient colors={['#FF5533', '#FF7A45']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        )}
        {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#FF5533'} /> : <>{icon}<RNText className={cx('font-inter-semibold text-[15px]', s.text)}>{title}</RNText></>}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({ onPress, children, label, className }: { onPress: () => void; children: ReactNode; label: string; className?: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={() => { haptic.tap(); onPress(); }} className={cx('h-11 w-11 items-center justify-center rounded-2xl bg-surface dark:bg-surface-dark', className)}>
      {children}
    </Pressable>
  );
}

// ── Containers ──
export function Card({ children, className, onPress }: { children: ReactNode; className?: string; onPress?: () => void }) {
  const base = cx('rounded-[22px] bg-surface p-5 dark:bg-surface-dark', className);
  if (!onPress) return <View className={base} style={cardShadow}>{children}</View>;
  return <Pressable onPress={() => { haptic.tap(); onPress(); }} className={cx(base, 'active:opacity-90')} style={cardShadow}>{children}</Pressable>;
}
export const cardShadow = { shadowColor: '#14161F', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 };

export function Screen({ children, scroll = true, refreshing, onRefresh, className, edges = ['top'] }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; className?: string; edges?: ('top' | 'bottom')[];
}) {
  const { c, dark } = useTheme();
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-canvas dark:bg-canvas-dark">
      <Backdrop dark={dark} />
      {scroll ? (
        <ScrollView
          contentContainerClassName={cx('px-5 pb-32', className)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : <View className={cx('flex-1 px-5', className)}>{children}</View>}
    </SafeAreaView>
  );
}

export function Header({ title, right, back = true, subtitle }: { title: string; right?: ReactNode; back?: boolean; subtitle?: string }) {
  const { icon } = useTheme();
  return (
    <View className="mb-4 mt-2 flex-row items-center gap-3">
      {back && (
        <IconButton label="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronLeft size={22} color={icon} />
        </IconButton>
      )}
      <View className="flex-1">
        <Text variant="h2" numberOfLines={1}>{title}</Text>
        {subtitle && <Text variant="caption">{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode; className?: string }) {
  return (
    <View className={cx('mt-7', className)}>
      <View className="mb-3 flex-row items-center justify-between">
        <Text variant="h3">{title}</Text>
        {action && <Pressable onPress={action.onPress}><Text className="font-inter-semibold text-[13px] text-brand">{action.label}</Text></Pressable>}
      </View>
      {children}
    </View>
  );
}

// ── Inputs ──
export function Input({ label, error, hint, right, className, ...p }: TextInputProps & { label?: string; error?: string; hint?: string; right?: ReactNode; className?: string }) {
  const { c } = useTheme();
  return (
    <View className={cx('mb-4', className)}>
      {label && <Text variant="label" className="mb-2">{label}</Text>}
      <View className={cx('h-14 flex-row items-center rounded-[18px] border bg-surface px-4 dark:bg-surface-dark', error ? 'border-danger' : 'border-line dark:border-line-dark')}>
        <TextInput placeholderTextColor={c.textMuted} className="h-full flex-1 font-inter text-[16px] text-ink dark:text-ink-inverse" {...p} />
        {right}
      </View>
      {error ? <Text className="mt-1.5 text-[12px] text-danger">{error}</Text> : hint ? <Text variant="caption" className="mt-1.5 text-[12px]">{hint}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} className={cx('mr-2 rounded-full border px-4 py-2.5', active ? 'border-navy bg-navy dark:border-brand dark:bg-brand' : 'border-line bg-surface dark:border-line-dark dark:bg-surface-dark')}>
      <RNText className={cx('font-inter-semibold text-[13px]', active ? 'text-white' : 'text-ink dark:text-ink-inverse')}>{label}</RNText>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <View className="flex-row rounded-[18px] bg-surface-alt p-1 dark:bg-surface-altdark">
      {items.map((i) => (
        <Pressable key={i.value} onPress={() => { haptic.tap(); onChange(i.value); }} className={cx('flex-1 items-center rounded-[14px] py-2.5', value === i.value && 'bg-surface dark:bg-surface-dark')}>
          <RNText className={cx('font-inter-semibold text-[13px]', value === i.value ? 'text-ink dark:text-ink-inverse' : 'text-ink-muted')}>{i.label}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

// ── Status / feedback ──
const PILL = {
  info: 'bg-brand-soft dark:bg-brand/20', success: 'bg-mint-soft dark:bg-mint/20', warning: 'bg-warning-soft dark:bg-warning/20', danger: 'bg-danger-soft dark:bg-danger/20', neutral: 'bg-surface-alt dark:bg-surface-altdark',
};
const PILL_TEXT = { info: 'text-brand', success: 'text-emerald-700 dark:text-mint', warning: 'text-amber-700 dark:text-warning', danger: 'text-danger', neutral: 'text-ink-muted' };
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const { t } = useI18n();
  const tone = statusTone[status] ?? 'neutral';
  return (
    <View className={cx('self-start rounded-full px-2.5 py-1', PILL[tone])}>
      <RNText className={cx('font-inter-semibold text-[11px]', PILL_TEXT[tone])}>{label ?? t(`status.${status}` as never)}</RNText>
    </View>
  );
}

export function Skeleton({ className }: { className?: string }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ opacity: o }} className={cx('rounded-[18px] bg-surface-alt dark:bg-surface-altdark', className)} />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const { iconMuted } = useTheme();
  return (
    <View className="items-center py-12">
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-surface-alt dark:bg-surface-altdark"><Inbox size={24} color={iconMuted} /></View>
      <Text variant="bodyStrong" className="text-center">{title}</Text>
      {body && <Text variant="caption" className="mt-1 max-w-[260px] text-center">{body}</Text>}
      {action && <View className="mt-4">{action}</View>}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const msg = (error as { status?: number })?.status === 0 ? t('common.networkError') : (error as Error)?.message || t('common.error');
  return (
    <View className="my-4 flex-row items-center gap-3 rounded-[18px] bg-danger-soft p-4 dark:bg-danger/15">
      <AlertCircle size={20} color="#EF5350" />
      <Text className="flex-1 text-[13px] text-danger">{msg}</Text>
      {onRetry && <Pressable onPress={onRetry}><Text className="font-inter-semibold text-[13px] text-danger">{t('common.retry')}</Text></Pressable>}
    </View>
  );
}

export function Notice({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'info' }) {
  return (
    <View className={cx('rounded-[18px] p-4', tone === 'warning' ? 'bg-warning-soft dark:bg-warning/10' : 'bg-brand-soft dark:bg-brand/10')}>
      <Text className={cx('text-[12px] leading-[18px]', tone === 'warning' ? 'text-amber-800 dark:text-warning' : 'text-brand')}>{children}</Text>
    </View>
  );
}

export function Row({ label, value, strong, className }: { label: string; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <View className={cx('flex-row items-center justify-between py-2.5', className)}>
      <Text variant="caption" className="text-[14px]">{label}</Text>
      {typeof value === 'string' ? <Text className={cx(strong ? 'font-inter-bold text-[16px]' : 'font-inter-semibold text-[14px]', 'text-ink dark:text-ink-inverse')}>{value}</Text> : value}
    </View>
  );
}

export function ListItem({ icon, title, subtitle, right, onPress, danger }: { icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean }) {
  const { iconMuted } = useTheme();
  return (
    <Pressable onPress={onPress ? () => { haptic.tap(); onPress(); } : undefined} className="flex-row items-center gap-3 py-3.5 active:opacity-70">
      {icon && <View className="h-10 w-10 items-center justify-center rounded-2xl bg-surface-alt dark:bg-surface-altdark">{icon}</View>}
      <View className="flex-1">
        <Text className={cx('font-inter-semibold text-[15px]', danger ? 'text-danger' : 'text-ink dark:text-ink-inverse')}>{title}</Text>
        {subtitle && <Text variant="caption" className="mt-0.5">{subtitle}</Text>}
      </View>
      {right ?? (onPress && <ChevronRight size={18} color={iconMuted} />)}
    </Pressable>
  );
}

export const Divider = () => <View className="h-px bg-line dark:bg-line-dark" />;
