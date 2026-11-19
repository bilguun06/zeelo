/** Calendar helpers (UTC-based, so schedules are timezone-stable). */

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Adds calendar months, clamping to month end (Jan 31 + 1 month → Feb 28/29). */
export function addMonthsUTC(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDay)));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDayUTC(to).getTime() - startOfDayUTC(from).getTime()) / 86_400_000);
}
