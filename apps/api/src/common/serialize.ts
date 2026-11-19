import { Prisma } from '@prisma/client';
import { dec, type Decimal } from '@orgil/financial-engine';

type DecimalInput = Prisma.Decimal | string | number | null | undefined;

/** Prisma Decimal → engine Decimal (distinct decimal.js instances, so convert via string). */
export const toDec = (v: DecimalInput): Decimal => dec(v === null || v === undefined ? '0' : v.toString());

/** Prisma Decimal → 2dp wire string. */
export const m = (v: DecimalInput): string => toDec(v).toFixed(2);

/** Rate → plain string without trailing zeros ("2.8000" → "2.8"). */
export const rate = (v: DecimalInput): string => toDec(v).toString();

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function maskTail(last4: string | null | undefined, prefix = '•••• '): string | null {
  return last4 ? `${prefix}${last4}` : null;
}

export function paginate(query: { page?: string | number; pageSize?: string | number }, maxSize = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(maxSize, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
