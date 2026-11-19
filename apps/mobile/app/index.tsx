import { gradients } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { LogoMark3D } from '@/components/brand';
import { Aurora } from '@/components/three-d';
import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { KEYS, prefs } from '@/lib/storage';

const native = Platform.OS !== 'web';
const LOGO = 132;
/** How long the finished logo stays on screen before routing (ms). */
const HOLD_MS = 2500;
// Face of the 3D tile inside LogoMark3D's 80×88 viewBox (x/y 8..72) — used to clip the shine.
const FACE = { inset: (8 / 80) * LOGO, size: (64 / 80) * LOGO, radius: (19 / 80) * LOGO };

/**
 * Animated splash: the 3D logo flips in, settles into a gentle floating tilt with a pulsing
 * glow ring and a light sweep across its face, the wordmark rises, then the app routes.
 */
export default function Splash() {
  const { status } = useAuth();
  const { t } = useI18n();
  const flip = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(float, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: native })),
      Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: native })),
      Animated.loop(Animated.sequence([
        Animated.delay(700),
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: native }),
      ])),
      Animated.loop(Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: native })),
    ];
    let timer: ReturnType<typeof setTimeout> | undefined;
    Animated.sequence([
      Animated.timing(flip, { toValue: 1, duration: 1100, easing: Easing.out(Easing.back(1.4)), useNativeDriver: native }),
      Animated.timing(text, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start(() => {
      loops.slice(0, 3).forEach((l) => l.start());
      timer = setTimeout(() => setAnimDone(true), HOLD_MS);
    });
    loops[3].start();
    return () => { loops.forEach((l) => l.stop()); if (timer) clearTimeout(timer); };
  }, [flip, text, float, ring, shine, dots]);

  useEffect(() => {
    if (!animDone || status === 'loading') return;
    (async () => {
      if (status === 'signedIn') return router.replace('/(tabs)');
      if (status === 'locked') return router.replace('/(auth)/login');
      const onboarded = await prefs.get(KEYS.onboarded);
      router.replace(onboarded ? '/(auth)/login' : '/onboarding');
    })();
  }, [animDone, status]);

  const logoTransform = [
    { perspective: 800 },
    { translateY: Animated.add(flip.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }), float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] })) },
    { scale: flip.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
    { rotateY: Animated.add(flip.interpolate({ inputRange: [0, 1], outputRange: [-200, 0] }), float.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 9, 0, -9, 0] })).interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
    { rotateX: float.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['6deg', '0deg', '-6deg', '0deg', '6deg'] }) },
  ];

  return (
    <LinearGradient colors={[...gradients.aurora]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Aurora height={900} />
      <View style={{ width: LOGO * 2, height: LOGO * 1.6, alignItems: 'center', justifyContent: 'center' }}>
        {/* pulsing glow ring behind the logo */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', width: LOGO * 1.1, height: LOGO * 1.1, borderRadius: LOGO, borderWidth: 2, borderColor: '#FFB199',
            opacity: Animated.multiply(text, ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] })),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
          }}
        />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: LOGO * 1.3, height: LOGO * 1.3, borderRadius: LOGO, backgroundColor: '#FF5533', opacity: Animated.multiply(flip, 0.22), transform: [{ scale: 1.1 }] }} />
        <Animated.View style={{ opacity: flip.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }), transform: logoTransform }}>
          <LogoMark3D size={LOGO} />
          {/* light sweep clipped to the tile face */}
          <View pointerEvents="none" style={{ position: 'absolute', left: FACE.inset, top: FACE.inset, width: FACE.size, height: FACE.size, borderRadius: FACE.radius, overflow: 'hidden' }}>
            <Animated.View style={{ position: 'absolute', top: -FACE.size * 0.3, bottom: -FACE.size * 0.3, width: FACE.size * 0.35, transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-FACE.size * 0.6, FACE.size * 1.3] }) }, { rotate: '22deg' }] }}>
              <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: text, alignItems: 'center', transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Text className="font-display text-[46px] tracking-tight text-white">{t('common.appName')}</Text>
        <Text className="mt-1 font-inter-medium text-[14px] tracking-wide text-white/70">{t('splash.tagline')}</Text>
      </Animated.View>
      <View className="absolute bottom-20 flex-row gap-2">
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', opacity: dots.interpolate({ inputRange: [0, (i + 0.5) / 3, 1], outputRange: [0.25, 1, 0.25] }) }} />
        ))}
      </View>
    </LinearGradient>
  );
}
