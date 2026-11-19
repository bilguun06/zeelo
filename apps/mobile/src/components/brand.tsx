import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Zeelo Z-arrow glyph path (128 box, stroke-based). */
export const ZEELO_GLYPH = 'M58 14 H114 V72 M114 14 L16 112 H114';

/** App icon: white Z-arrow on a brand-orange rounded square. */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="18" fill="#FF5533" />
      <G transform="translate(10.6 10.6) scale(0.33)">
        <Path d={ZEELO_GLYPH} stroke="#FFFFFF" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    </Svg>
  );
}

/**
 * 3D app icon — same Z-arrow mark, rendered as an extruded glossy tile:
 * soft ground glow, darker side extrusion, gradient face, bevel highlight, gloss,
 * and an embossed glyph with its own depth + cast shadow.
 */
export function LogoMark3D({ size = 56, glow = true }: { size?: number; glow?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}${uid}`;
  const u = (n: string) => `url(#${n}${uid})`;
  const glyph = (stroke: string, dx = 0, dy = 0, opacity = 1) => (
    <G transform={`translate(${18.5 + dx} ${18.5 + dy}) scale(0.33)`} opacity={opacity}>
      <Path d={ZEELO_GLYPH} stroke={stroke} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 80 88">
      <Defs>
        <RadialGradient id={id('glow')} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#FF5533" stopOpacity={0.55} /><Stop offset="1" stopColor="#FF5533" stopOpacity={0} /></RadialGradient>
        <LinearGradient id={id('side')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#C2340F" /><Stop offset="1" stopColor="#7E1D06" /></LinearGradient>
        <LinearGradient id={id('face')} x1="0.15" y1="0" x2="0.85" y2="1"><Stop offset="0" stopColor="#FF8A5C" /><Stop offset="0.55" stopColor="#FF5533" /><Stop offset="1" stopColor="#E8401D" /></LinearGradient>
        <LinearGradient id={id('bevel')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} /><Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.08} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></LinearGradient>
        <LinearGradient id={id('gloss')} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></LinearGradient>
        <LinearGradient id={id('glyph')} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#FFE6DD" /></LinearGradient>
      </Defs>
      {glow && <Ellipse cx="40" cy="80" rx="34" ry="7" fill={u('glow')} />}
      {/* extrusion (side wall) */}
      <Rect x="8" y="14" width="64" height="64" rx="19" fill={u('side')} />
      {/* face */}
      <Rect x="8" y="8" width="64" height="64" rx="19" fill={u('face')} />
      <Rect x="8.75" y="8.75" width="62.5" height="62.5" rx="18.3" fill="none" stroke={u('bevel')} strokeWidth={1.5} />
      <Path d="M27 8 H53 A19 19 0 0 1 72 27 V30 C58 36 22 36 8 30 V27 A19 19 0 0 1 27 8 Z" fill={u('gloss')} />
      {/* embossed glyph: cast shadow, depth, face */}
      {glyph('#8A2007', 1.2, 3.4, 0.45)}
      {glyph('#FFC2AE', 0, 1.6)}
      <G transform="translate(18.5 18.5) scale(0.33)">
        <Path d={ZEELO_GLYPH} stroke={u('glyph')} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    </Svg>
  );
}

/** Bare orange Z-arrow glyph (primary logo symbol). */
export function LogoGlyph({ size = 32, color = '#FF5533' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128">
      <Path d={ZEELO_GLYPH} stroke={color} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Onboarding illustrations — original geometric artwork in brand colours. */
export function Illustration({ kind, size = 260 }: { kind: 1 | 2 | 3; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Circle cx="130" cy="130" r="118" fill="#FF5533" opacity={0.08} />
      <Circle cx="130" cy="130" r="86" fill="#FF5533" opacity={0.1} />
      {kind === 1 && (
        <G>
          <Rect x="78" y="40" width="104" height="180" rx="22" fill="#14161F" />
          <Rect x="88" y="60" width="84" height="52" rx="12" fill="#FF5533" />
          <Rect x="98" y="72" width="40" height="6" rx="3" fill="#fff" opacity={0.6} />
          <Rect x="98" y="86" width="60" height="12" rx="4" fill="#fff" />
          <Rect x="88" y="124" width="84" height="14" rx="7" fill="#42D6A4" />
          <Rect x="88" y="148" width="60" height="8" rx="4" fill="#fff" opacity={0.25} />
          <Rect x="88" y="164" width="72" height="8" rx="4" fill="#fff" opacity={0.25} />
          <Circle cx="196" cy="70" r="20" fill="#42D6A4" />
          <Path d="M187 70 l6 6 l12 -12" stroke="#14161F" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx="60" cy="170" r="14" fill="#FFB547" />
        </G>
      )}
      {kind === 2 && (
        <G>
          <Path d="M130 36 L196 62 V124 C196 168 166 198 130 214 C94 198 64 168 64 124 V62 Z" fill="#14161F" />
          <Path d="M130 58 L178 77 V124 C178 156 157 178 130 191 C103 178 82 156 82 124 V77 Z" fill="#FF5533" />
          <Path d="M108 126 l16 16 l30 -32" stroke="#fff" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M206 44 l6 12 l12 6 l-12 6 l-6 12 l-6 -12 l-12 -6 l12 -6 Z" fill="#42D6A4" />
          <Circle cx="50" cy="96" r="8" fill="#FFB547" />
        </G>
      )}
      {kind === 3 && (
        <G>
          <Rect x="46" y="64" width="168" height="132" rx="22" fill="#14161F" />
          <Rect x="70" y="140" width="18" height="36" rx="5" fill="#FF5533" />
          <Rect x="98" y="118" width="18" height="58" rx="5" fill="#FF5533" />
          <Rect x="126" y="128" width="18" height="48" rx="5" fill="#42D6A4" />
          <Rect x="154" y="98" width="18" height="78" rx="5" fill="#42D6A4" />
          <Path d="M70 112 L106 92 L134 102 L184 74" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Circle cx="184" cy="74" r="7" fill="#fff" />
          <Rect x="70" y="80" width="54" height="8" rx="4" fill="#fff" opacity={0.3} />
          <Circle cx="212" cy="58" r="16" fill="#FFB547" />
        </G>
      )}
    </Svg>
  );
}
