import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, useWindowDimensions, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aurora, IsoIllustration, Tilt3D } from '@/components/three-d';
import { haptic, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { KEYS, prefs } from '@/lib/storage';

const SLIDES = [1, 2, 3] as const;

export default function Onboarding() {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const finish = async (to: '/(auth)/register' | '/(auth)/login') => {
    await prefs.set(KEYS.onboarded, '1');
    router.replace(to);
  };
  const next = () => (index < 2 ? list.current?.scrollToIndex({ index: index + 1, animated: true }) : finish('/(auth)/register'));
  const art = Math.min(250, width - 100, height * 0.3);

  return (
    <View className="flex-1">
      <StatusBar style="light" />
      <LinearGradient colors={[...gradients.hero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Aurora height={height} />
      <SafeAreaView className="flex-1">
        <View className="flex-row justify-end px-5 pt-2">
          <Pressable onPress={() => finish('/(auth)/login')} hitSlop={12} className="rounded-full bg-white/10 px-4 py-2"><Text className="font-inter-semibold text-[13px] text-white">{t('common.skip')}</Text></Pressable>
        </View>
        <Animated.FlatList
          ref={list}
          data={SLIDES as unknown as number[]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(i) => String(i)}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: Platform.OS !== 'web' })}
          scrollEventThrottle={16}
          renderItem={({ item, index: i }) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            const scale = scrollX.interpolate({ inputRange: range, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
            const rotate = scrollX.interpolate({ inputRange: range, outputRange: ['25deg', '0deg', '-25deg'], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
            const translate = scrollX.interpolate({ inputRange: range, outputRange: [60, 0, -60], extrapolate: 'clamp' });
            return (
              <View style={{ width }} className="flex-1 items-center justify-center px-8">
                <Animated.View style={{ transform: [{ perspective: 800 }, { scale }, { rotateY: rotate }] }}>
                  <Tilt3D max={14}>
                    <View className="items-center justify-center rounded-full" style={{ width: art + 30, height: art + 30, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                      <IsoIllustration kind={item as 1 | 2 | 3} size={art} />
                    </View>
                  </Tilt3D>
                </Animated.View>
                <Animated.View style={{ opacity, transform: [{ translateY: translate }] }} className="mt-10 items-center">
                  <Text className="text-center font-display text-[28px] leading-[34px] text-white">{t(`onboarding.s${item}Title` as never)}</Text>
                  <Text className="mt-3 text-center font-inter text-[15px] leading-[22px] text-white/65">{t(`onboarding.s${item}Body` as never)}</Text>
                </Animated.View>
              </View>
            );
          }}
        />
        <View className="px-6 pb-6">
          <View className="mb-8 flex-row justify-center gap-2">
            {SLIDES.map((_, i) => {
              const w = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [8, 32, 8], extrapolate: 'clamp' });
              return <Animated.View key={i} style={{ width: w, height: 8, borderRadius: 4, backgroundColor: index === i ? '#42D6A4' : 'rgba(255,255,255,0.25)' }} />;
            })}
          </View>
          <Pressable onPress={() => { haptic.tap(); next(); }} className="h-14 items-center justify-center overflow-hidden rounded-[18px] active:opacity-90">
            <LinearGradient colors={[...gradients.electric]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <Text className="font-inter-bold text-[15px] text-white">{index < 2 ? t('common.next') : t('onboarding.start')}</Text>
          </Pressable>
          <Pressable onPress={() => finish('/(auth)/login')} className="mt-4 items-center"><Text className="font-inter-semibold text-[14px] text-mint">{t('onboarding.haveAccount')}</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
