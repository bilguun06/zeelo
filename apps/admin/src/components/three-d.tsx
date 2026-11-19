'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Card that tilts toward the cursor in 3D and shows a moving light glare. */
export function TiltCard({ children, className, max = 8, style }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-4px)`;
    if (glare.current) glare.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.28), transparent 55%)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0)';
    if (glare.current) glare.current.style.background = 'transparent';
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={cn('relative transition-transform duration-200 ease-out [transform-style:preserve-3d]', className)} style={style}>
      {children}
      <div ref={glare} className="pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}

export const TILE_GRADIENTS = {
  blue: 'from-[#FF5533] to-[#FF8A4C] shadow-[0_10px_24px_-6px_rgba(255,85,51,0.6)]',
  mint: 'from-[#42D6A4] to-[#16A37A] shadow-[0_10px_24px_-6px_rgba(66,214,164,0.6)]',
  amber: 'from-[#FFB547] to-[#FF7A59] shadow-[0_10px_24px_-6px_rgba(255,149,80,0.6)]',
  violet: 'from-[#3A3D4D] to-[#14161F] shadow-[0_10px_24px_-6px_rgba(20,22,31,0.55)]',
  ocean: 'from-[#2EC4B6] to-[#159A8C] shadow-[0_10px_24px_-6px_rgba(46,196,182,0.55)]',
  rose: 'from-[#FF7A90] to-[#EF5350] shadow-[0_10px_24px_-6px_rgba(239,83,80,0.6)]',
} as const;
export type TileTone = keyof typeof TILE_GRADIENTS;

/** Raised gradient icon chip with a glossy top highlight. */
export function GradientIcon({ tone, children, size = 44 }: { tone: TileTone; children: ReactNode; size?: number }) {
  return (
    <div className={cn('relative grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-white', TILE_GRADIENTS[tone])} style={{ width: size, height: size }}>
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Animated aurora glow layer for dark surfaces. */
export function AuroraBg({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="absolute -right-24 -top-32 h-96 w-96 animate-[drift_14s_ease-in-out_infinite] rounded-full bg-[#FF5533]/50 blur-3xl" />
      <div className="absolute -bottom-40 -left-20 h-96 w-96 animate-[drift_18s_ease-in-out_infinite_reverse] rounded-full bg-[#FFB547]/20 blur-3xl" />
      <div className="absolute left-1/3 top-1/4 h-72 w-72 animate-[drift_22s_ease-in-out_infinite] rounded-full bg-[#FF8A4C]/30 blur-3xl" />
    </div>
  );
}

/** Isometric 3D scene: platform, bars, coins and a floating card — for the dashboard hero. */
export function IsoScene({ className }: { className?: string }) {
  const bar = (x: number, h: number, c: [string, string, string], k: number) => {
    const base = 196 - (x - 90) * 0.22;
    return (
      <g key={k}>
        <path d={`M${x} ${base} L${x + 20} ${base + 11} L${x + 20} ${base + 11 - h} L${x} ${base - h} Z`} fill={c[0]} />
        <path d={`M${x + 20} ${base + 11} L${x + 40} ${base} L${x + 40} ${base - h} L${x + 20} ${base + 11 - h} Z`} fill={c[1]} />
        <path d={`M${x} ${base - h} L${x + 20} ${base - 11 - h} L${x + 40} ${base - h} L${x + 20} ${base + 11 - h} Z`} fill={c[2]} />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 360 280" className={className} aria-hidden>
      <defs>
        <radialGradient id="isoShadow"><stop offset="0" stopColor="#000" stopOpacity="0.45" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <linearGradient id="isoCard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF5533" /><stop offset="1" stopColor="#FF8A4C" /></linearGradient>
        <linearGradient id="isoCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFE08A" /><stop offset="1" stopColor="#FFB547" /></linearGradient>
      </defs>
      <ellipse cx="180" cy="250" rx="150" ry="22" fill="url(#isoShadow)" />
      <path d="M40 200 L180 130 L320 200 L180 270 Z" fill="#262A38" />
      <path d="M40 200 L180 270 L180 282 L40 212 Z" fill="#2A1D19" />
      <path d="M180 270 L320 200 L320 212 L180 282 Z" fill="#14161F" />
      <path d="M60 200 L180 140 L300 200 L180 260 Z" fill="none" stroke="#FF5533" strokeOpacity="0.35" strokeDasharray="4 6" />
      {bar(90, 50, ['#D93A1C', '#FF5533', '#FFB199'], 0)}
      {bar(132, 84, ['#D93A1C', '#FF5533', '#FFB199'], 1)}
      {bar(174, 66, ['#16A37A', '#42D6A4', '#9BEBD0'], 2)}
      {bar(216, 112, ['#16A37A', '#42D6A4', '#9BEBD0'], 3)}
      <path d="M96 128 L150 96 L194 112 L250 58" stroke="#FFB547" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M250 58 l-17 2 l10 13 Z" fill="#FFB547" />
      <g className="animate-[float_5s_ease-in-out_infinite]">
        <path d="M262 132 L322 104 L322 146 L262 174 Z" fill="url(#isoCard)" />
        <path d="M322 104 L330 108 L330 150 L322 146 Z" fill="#D93A1C" />
        <rect x="272" y="136" width="14" height="10" rx="2" fill="#FFE08A" transform="skewY(-25) translate(0 128)" />
        <path d="M272 158 L312 139" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g className="animate-[float_6s_ease-in-out_infinite_reverse]">
        <ellipse cx="70" cy="132" rx="22" ry="8" fill="#C27C0E" />
        <rect x="48" y="122" width="44" height="10" fill="#E39A1F" />
        <ellipse cx="70" cy="122" rx="22" ry="8" fill="url(#isoCoin)" />
        <ellipse cx="70" cy="110" rx="22" ry="8" fill="#C27C0E" />
        <rect x="48" y="100" width="44" height="10" fill="#E39A1F" />
        <ellipse cx="70" cy="100" rx="22" ry="8" fill="url(#isoCoin)" />
      </g>
      <path d="M300 40 l5 11 l11 5 l-11 5 l-5 11 l-5 -11 l-11 -5 l11 -5 Z" fill="#42D6A4" />
      <path d="M40 60 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="#FFB547" />
    </svg>
  );
}
