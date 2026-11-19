import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark3D } from './brand';
import { useTheme } from '@/lib/theme';
import { Aurora, Backdrop, IsoShield, Tilt3D } from './three-d';
import { Text } from './ui';

/** Auth layout: immersive dark hero with a floating 3D emblem, form on a raised sheet. */
export function AuthShell({ title, subtitle, children, back = true, footer }: { title: string; subtitle?: string; children: ReactNode; back?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { dark } = useTheme();
  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark">
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled" bounces={false}>
          <View className="overflow-hidden px-6 pb-16" style={{ paddingTop: insets.top + 8 }}>
            <LinearGradient colors={[...gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <Aurora height={420} />
            <View className="h-14 flex-row items-center justify-between">
              {back ? (
                <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login'))} className="h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10" accessibilityLabel="back">
                  <ChevronLeft size={22} color="#fff" />
                </Pressable>
              ) : (
                <View className="flex-row items-center gap-2.5">
                  <Tilt3D max={18}><LogoMark3D size={46} glow={false} /></Tilt3D>
                  <Text className="font-display text-[24px] tracking-tight text-white">Zeelo</Text>
                </View>
              )}
            </View>
            <View className="mt-4 flex-row items-end justify-between">
              <View className="flex-1 pr-2">
                <Text className="font-display text-[30px] leading-[36px] text-white">{title}</Text>
                {subtitle && <Text className="mt-2 font-inter text-[14px] leading-[20px] text-white/65">{subtitle}</Text>}
              </View>
              <Tilt3D max={16}><IsoShield size={118} /></Tilt3D>
            </View>
          </View>
          <View className="-mt-8 flex-1 overflow-hidden rounded-t-[32px] bg-canvas px-6 pb-8 pt-8 dark:bg-canvas-dark">
            <Backdrop dark={dark} />
            <View className="flex-1">{children}</View>
            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
