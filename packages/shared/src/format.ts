/**
 * Display formatting helpers. These operate on strings/numbers for DISPLAY ONLY —
 * all financial arithmetic happens in @orgil/financial-engine with decimal.js.
 */

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Formats a decimal string (e.g. "2000000.50") as "2,000,000.50₮". Whole amounts drop the decimals. */
export function formatMNT(value: string | number | null | undefined, opts: { withSymbol?: boolean; decimals?: 'auto' | 0 | 2 } = {}): string {
  const { withSymbol = true, decimals = 'auto' } = opts;
  if (value === null || value === undefined || value === '') return withSymbol ? '—' : '—';
  const raw = typeof value === 'number' ? value.toFixed(2) : String(value);
  const negative = raw.startsWith('-');
  const [intPartRaw, fracRaw = ''] = raw.replace('-', '').split('.');
  const frac = (fracRaw + '00').slice(0, 2);
  const intPart = groupThousands(intPartRaw.replace(/^0+(?=\d)/, '') || '0');
  let out = intPart;
  if (decimals === 2 || (decimals === 'auto' && frac !== '00')) out += `.${frac}`;
  return `${negative ? '-' : ''}${out}${withSymbol ? '₮' : ''}`;
}

/** Compact form for charts: 1.2 сая₮ / 1.2M₮. */
export function formatMNTCompact(value: string | number, lang: 'mn' | 'en' = 'mn'): string {
  const n = typeof value === 'number' ? value : Number(value);
  const units = lang === 'mn'
    ? [{ v: 1e9, s: ' тэрбум' }, { v: 1e6, s: ' сая' }, { v: 1e3, s: ' мян' }]
    : [{ v: 1e9, s: 'B' }, { v: 1e6, s: 'M' }, { v: 1e3, s: 'K' }];
  for (const u of units) {
    if (Math.abs(n) >= u.v) return `${(n / u.v).toFixed(1).replace(/\.0$/, '')}${u.s}₮`;
  }
  return `${Math.round(n)}₮`;
}

export function formatPercent(value: string | number, digits = 2): string {
  const n = typeof value === 'number' ? value : Number(value);
  return `${n.toFixed(digits).replace(/\.?0+$/, '')}%`;
}

/** Mongolian mobile numbers are 8 digits. Display as "9911 2233". */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^976/, '');
  if (digits.length !== 8) return phone;
  return `${digits.slice(0, 4)} ${digits.slice(4)}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').replace(/^976/, '');
  return d.length === 8 ? `${d.slice(0, 2)}** **${d.slice(6)}` : phone;
}

const MN_MONTHS = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value: string | Date, lang: 'mn' | 'en' = 'mn'): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  if (lang === 'mn') return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return `${EN_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatDateTime(value: string | Date, lang: 'mn' | 'en' = 'mn'): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${formatDate(d, lang)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function monthLabel(monthIndex: number, lang: 'mn' | 'en' = 'mn'): string {
  return (lang === 'mn' ? MN_MONTHS : EN_MONTHS)[monthIndex] ?? '';
}

export function daysUntil(value: string | Date, from: Date = new Date()): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 86_400_000);
}
