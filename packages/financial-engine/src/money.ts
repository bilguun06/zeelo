import DecimalBase from 'decimal.js';

/**
 * Isolated Decimal constructor: 40 significant digits, banker-safe HALF_UP rounding.
 * NEVER use JS numbers for money. Inputs may be strings, integers, or Decimals.
 */
export const Dec = DecimalBase.clone({ precision: 40, rounding: DecimalBase.ROUND_HALF_UP });
export type Decimal = InstanceType<typeof Dec>;
export type DecimalLike = string | number | Decimal;

export const MONEY_SCALE = 2;
export const ZERO = new Dec(0);

export function dec(v: DecimalLike | null | undefined): Decimal {
  if (v === null || v === undefined || v === '') return new Dec(0);
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Invalid numeric input');
  return new Dec(v as DecimalBase.Value);
}

/** Rounds to money precision (2dp, HALF_UP). */
export function money(v: DecimalLike): Decimal {
  return dec(v).toDecimalPlaces(MONEY_SCALE, DecimalBase.ROUND_HALF_UP);
}

/** Percent ("3.2") → fraction (0.032). */
export function pct(v: DecimalLike): Decimal {
  return dec(v).div(100);
}

export function sum(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Dec(0));
}

export function minDec(a: Decimal, b: Decimal): Decimal {
  return a.lessThan(b) ? a : b;
}

export function maxDec(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}

/** Serialises to a fixed 2dp string for the wire / database. */
export function toMoneyString(v: DecimalLike): string {
  return money(v).toFixed(MONEY_SCALE);
}
