import { accentTiles, type AccentTile } from '@orgil/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const native = Platform.OS !== 'web';

/**
 * Pseudo-3D tilt: idles with a slow float, follows the finger while touched, springs back on release.
 * Uses perspective + rotateX/rotateY so it works identically on iOS, Android and web.
 */
export function Tilt3D({ children, max = 10, float = true, style }: { children: ReactNode; max?: number; float?: boolean; style?: ViewStyle }) {
  const rx = useRef(new Animated.Value(0)).current;
  const ry = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const size = useRef({ w: 1, h: 1 });
  const touching = useRef(false);

  useEffect(() => {
    if (!float) return;
    const loop = Animated.loop(Animated.timing(idle, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [float, idle]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderGrant: () => { touching.current = true; },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const nx = Math.max(-1, Math.min(1, (locationX / size.current.w) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, (locationY / size.current.h) * 2 - 1));
      ry.setValue(nx * max);
      rx.setValue(-ny * max);
    },
    onPanResponderRelease: () => {
      touching.current = false;
      Animated.parallel([
        Animated.spring(rx, { toValue: 0, useNativeDriver: native, friction: 5 }),
        Animated.spring(ry, { toValue: 0, useNativeDriver: native, friction: 5 }),
      ]).start();
    },
    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {
      Animated.parallel([Animated.spring(rx, { toValue: 0, useNativeDriver: native }), Animated.spring(ry, { toValue: 0, useNativeDriver: native })]).start();
    },
  }), [max, rx, ry]);

  const idleY = idle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 4, 0, -4, 0] });
  const idleX = idle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [2, 0, -2, 0, 2] });
  const lift = idle.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] });

  return (
    <Animated.View
      {...pan.panHandlers}
      onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}
      style={[style, {
        transform: [
          { perspective: 900 },
          { translateY: lift },
          { rotateX: Animated.add(rx, idleX).interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }) },
          { rotateY: Animated.add(ry, idleY).interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }) },
        ],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Moving holographic sheen for premium surfaces. */
export function Sheen({ width = 360 }: { width?: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1800),
      Animated.timing(x, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -40, bottom: -40, width: 90, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-140, width + 40] }) }, { rotate: '20deg' }] }}>
      <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** Soft glowing orbs used as a backdrop (no blur filter needed — radial gradients). */
export function Aurora({ height = 320, variant = 'hero' }: { height?: number; variant?: 'hero' | 'soft' }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const drift = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 24, 0] });
  const soft = variant === 'soft';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height, overflow: 'hidden' }}>
      <Animated.View style={{ position: 'absolute', left: -30, right: -30, top: 0, bottom: 0, transform: [{ translateX: drift }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="o1" cx="80%" cy="10%" r="55%"><Stop offset="0" stopColor="#FF5533" stopOpacity={soft ? 0.25 : 0.85} /><Stop offset="1" stopColor="#FF5533" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="o2" cx="5%" cy="85%" r="50%"><Stop offset="0" stopColor="#FFB547" stopOpacity={soft ? 0.18 : 0.45} /><Stop offset="1" stopColor="#FFB547" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="o3" cx="45%" cy="40%" r="40%"><Stop offset="0" stopColor="#FF8A4C" stopOpacity={soft ? 0.12 : 0.45} /><Stop offset="1" stopColor="#FF8A4C" stopOpacity={0} /></RadialGradient>
          </Defs>
          <Rect width="400" height="320" fill="url(#o1)" />
          <Rect width="400" height="320" fill="url(#o2)" />
          <Rect width="400" height="320" fill="url(#o3)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * Full-screen ambient backdrop: a tinted vertical gradient plus large soft colour orbs and a faint
 * dot grid, so page backgrounds read as vivid "glass" rather than flat grey.
 */
export function Backdrop({ dark }: { dark: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 16000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const drift = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 30, 0] });
  const base: [string, string, string] = dark ? ['#15131A', '#0D0E14', '#17121A'] : ['#FFF1EB', '#FFF8F5', '#FFF4E9'];
  const k = dark ? 0.5 : 0.4; // orb intensity — kept soft so content stays the focus
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>
      <LinearGradient colors={base} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Animated.View style={{ position: 'absolute', left: -40, right: -40, top: -40, bottom: -40, transform: [{ translateY: drift }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="bd1" cx="90%" cy="6%" r="45%"><Stop offset="0" stopColor="#FF5533" stopOpacity={0.55 * k} /><Stop offset="1" stopColor="#FF5533" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="bd2" cx="0%" cy="30%" r="42%"><Stop offset="0" stopColor="#FF8A4C" stopOpacity={0.4 * k} /><Stop offset="1" stopColor="#FF8A4C" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="bd3" cx="100%" cy="58%" r="45%"><Stop offset="0" stopColor="#FFB547" stopOpacity={0.45 * k} /><Stop offset="1" stopColor="#FFB547" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="bd4" cx="10%" cy="88%" r="45%"><Stop offset="0" stopColor="#FF7AB6" stopOpacity={0.3 * k} /><Stop offset="1" stopColor="#FF7AB6" stopOpacity={0} /></RadialGradient>
            <RadialGradient id="bd5" cx="55%" cy="100%" r="35%"><Stop offset="0" stopColor="#FFB547" stopOpacity={0.25 * k} /><Stop offset="1" stopColor="#FFB547" stopOpacity={0} /></RadialGradient>
          </Defs>
          <Rect width="400" height="800" fill="url(#bd1)" />
          <Rect width="400" height="800" fill="url(#bd2)" />
          <Rect width="400" height="800" fill="url(#bd3)" />
          <Rect width="400" height="800" fill="url(#bd4)" />
          <Rect width="400" height="800" fill="url(#bd5)" />
          {/* faint dot grid for depth */}
          <G opacity={dark ? 0.04 : 0.035}>
            {Array.from({ length: 20 }).map((_, row) => Array.from({ length: 10 }).map((__, col) => (
              <Rect key={`${row}-${col}`} x={col * 40 + 18} y={row * 40 + 18} width={3} height={3} rx={1.5} fill={dark ? '#FFFFFF' : '#14161F'} />
            )))}
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Gradient icon tile with a top highlight and drop glow — reads as a raised 3D chip. */
export function GradientTile({ tone, size = 56, radius = 20, children }: { tone: AccentTile; size?: number; radius?: number; children: ReactNode }) {
  const [a, b] = accentTiles[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: radius, shadowColor: a, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
      <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size * 0.55 }} />
        <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
      </LinearGradient>
    </View>
  );
}

// ── Isometric 3D illustrations (three shaded faces per solid) ──

function Shadow({ cx = 130, cy = 222, rx = 78 }: { cx?: number; cy?: number; rx?: number }) {
  return (
    <>
      <Defs><RadialGradient id="sh" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#14161F" stopOpacity={0.35} /><Stop offset="1" stopColor="#14161F" stopOpacity={0} /></RadialGradient></Defs>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.22} fill="url(#sh)" />
    </>
  );
}

/** Stack of 3D coins with a phone — "borrow anytime". */
export function IsoCoins({ size = 260 }: { size?: number }) {
  const coin = (y: number, k: number) => (
    <G key={k}>
      <Ellipse cx={170} cy={y + 12} rx={42} ry={16} fill="#C27C0E" />
      <Rect x={128} y={y} width={84} height={12} fill="#E39A1F" />
      <Ellipse cx={170} cy={y} rx={42} ry={16} fill="url(#coinTop)" />
      <Ellipse cx={170} cy={y} rx={28} ry={10} fill="none" stroke="#FFF1C9" strokeWidth={2} opacity={0.7} />
    </G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Defs>
        <SvgLinear id="coinTop" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE08A" /><Stop offset="1" stopColor="#FFB547" /></SvgLinear>
        <SvgLinear id="phoneFace" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF5533" /><Stop offset="1" stopColor="#FF8A4C" /></SvgLinear>
        <SvgLinear id="screen" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#16171F" /><Stop offset="1" stopColor="#4A2419" /></SvgLinear>
      </Defs>
      <Shadow cy={226} rx={96} />
      {/* phone slab: front face + side + top edge */}
      <Path d="M54 70 L118 40 L118 196 L54 226 Z" fill="url(#phoneFace)" />
      <Path d="M118 40 L130 46 L130 202 L118 196 Z" fill="#C93519" />
      <Path d="M54 70 L118 40 L130 46 L66 76 Z" fill="#FFB199" />
      <Path d="M62 80 L110 57 L110 186 L62 209 Z" fill="url(#screen)" />
      <Path d="M70 96 L102 81 L102 92 L70 107 Z" fill="#42D6A4" />
      <Path d="M70 116 L96 104 L96 109 L70 121 Z" fill="#fff" opacity={0.5} />
      <Path d="M70 128 L102 113 L102 118 L70 133 Z" fill="#fff" opacity={0.3} />
      <Path d="M70 160 L102 145 L102 160 L70 175 Z" fill="#FF5533" />
      {[196, 180, 164, 148].map((y, i) => coin(y, i))}
      {/* sparkle */}
      <Path d="M214 64 l5 11 l11 5 l-11 5 l-5 11 l-5 -11 l-11 -5 l11 -5 Z" fill="#42D6A4" />
      <Path d="M40 40 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#FFB547" />
    </Svg>
  );
}

/** 3D shield with check — "secure & trustworthy". */
export function IsoShield({ size = 260 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Defs>
        <SvgLinear id="shFront" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FF5533" /><Stop offset="1" stopColor="#D93A1C" /></SvgLinear>
        <SvgLinear id="shSide" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#A8301A" /><Stop offset="1" stopColor="#14161F" /></SvgLinear>
        <SvgLinear id="shInner" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF7A5C" /><Stop offset="1" stopColor="#FF5533" /></SvgLinear>
      </Defs>
      <Shadow cy={230} rx={84} />
      {/* extruded side */}
      <Path d="M130 40 L194 64 V122 C194 166 166 196 130 212 L142 218 C178 202 206 172 206 128 V70 Z" fill="url(#shSide)" />
      {/* front */}
      <Path d="M118 34 L182 58 V116 C182 160 154 190 118 206 C82 190 54 160 54 116 V58 Z" fill="url(#shFront)" />
      <Path d="M118 52 L166 70 V116 C166 150 146 172 118 186 C90 172 70 150 70 116 V70 Z" fill="url(#shInner)" />
      <Path d="M118 52 L166 70 V90 L118 72 L70 90 V70 Z" fill="#fff" opacity={0.18} />
      <Path d="M96 118 l15 15 l29 -31" stroke="#fff" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* orbiting mint ring */}
      <Ellipse cx={124} cy={128} rx={104} ry={30} fill="none" stroke="#42D6A4" strokeWidth={3} opacity={0.6} strokeDasharray="6 10" />
      <Path d="M220 50 l5 11 l11 5 l-11 5 l-5 11 l-5 -11 l-11 -5 l11 -5 Z" fill="#42D6A4" />
    </Svg>
  );
}

/** Isometric bar chart on a platform — "manage finances in one place". */
export function IsoChart({ size = 260 }: { size?: number }) {
  // isometric bar: front-left face, front-right face, top face
  const bar = (x: number, h: number, c: [string, string, string], k: number) => {
    const base = 184 - (x - 70) * 0.18;
    return (
      <G key={k}>
        <Path d={`M${x} ${base} L${x + 18} ${base + 10} L${x + 18} ${base + 10 - h} L${x} ${base - h} Z`} fill={c[0]} />
        <Path d={`M${x + 18} ${base + 10} L${x + 36} ${base} L${x + 36} ${base - h} L${x + 18} ${base + 10 - h} Z`} fill={c[1]} />
        <Path d={`M${x} ${base - h} L${x + 18} ${base - 10 - h} L${x + 36} ${base - h} L${x + 18} ${base + 10 - h} Z`} fill={c[2]} />
      </G>
    );
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Shadow cy={226} rx={100} />
      {/* platform */}
      <Path d="M30 190 L130 140 L230 190 L130 240 Z" fill="#FFE9E2" />
      <Path d="M30 190 L130 240 L130 252 L30 202 Z" fill="#F2CFC2" />
      <Path d="M130 240 L230 190 L230 202 L130 252 Z" fill="#E6B3A1" />
      {bar(70, 40, ['#D93A1C', '#FF5533', '#FFB199'], 0)}
      {bar(108, 70, ['#D93A1C', '#FF5533', '#FFB199'], 1)}
      {bar(146, 56, ['#16A37A', '#42D6A4', '#9BEBD0'], 2)}
      {bar(184, 96, ['#16A37A', '#42D6A4', '#9BEBD0'], 3)}
      {/* trend arrow */}
      <Path d="M70 112 L118 82 L160 96 L214 50" stroke="#FFB547" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M214 50 l-16 2 l10 12 Z" fill="#FFB547" />
      <Path d="M40 60 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 Z" fill="#42D6A4" />
    </Svg>
  );
}

export function IsoIllustration({ kind, size }: { kind: 1 | 2 | 3; size?: number }) {
  return kind === 1 ? <IsoCoins size={size} /> : kind === 2 ? <IsoShield size={size} /> : <IsoChart size={size} />;
}
