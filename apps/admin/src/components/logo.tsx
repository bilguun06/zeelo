const GLYPH = 'M58 14 H114 V72 M114 14 L16 112 H114';

/** App icon: white Z-arrow on a brand-orange rounded square. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#FF5533" />
      <g transform="translate(10.6 10.6) scale(0.33)">
        <path d={GLYPH} stroke="#fff" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}

/** Primary logo: orange Z-arrow glyph + "Zeelo" wordmark. */
export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={30} height={30} viewBox="0 0 128 128" aria-hidden>
        <path d={GLYPH} stroke="#FF5533" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <div className="leading-none">
        <div className={`font-display text-[26px] font-extrabold tracking-[-0.04em] ${light ? 'text-white' : 'text-ink dark:text-ink-inverse'}`}>Zeelo</div>
        <div className={`mt-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-white/50' : 'text-ink-muted'}`}>Admin console</div>
      </div>
    </div>
  );
}
