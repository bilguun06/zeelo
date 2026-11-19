import { addMonthsUTC, daysBetween, startOfDayUTC } from './dates';
import { type Decimal, type DecimalLike, dec, maxDec, minDec, money, pct, sum, ZERO } from './money';

/** Persisted state of one installment (amounts due and paid so far). */
export interface InstallmentState {
  installmentNo: number;
  dueDate: Date;
  principalDue: DecimalLike;
  interestDue: DecimalLike;
  feeDue: DecimalLike;
  penaltyDue: DecimalLike;
  principalPaid: DecimalLike;
  interestPaid: DecimalLike;
  feePaid: DecimalLike;
  penaltyPaid: DecimalLike;
}

export interface Components {
  principal: Decimal;
  interest: Decimal;
  fee: Decimal;
  penalty: Decimal;
}

export interface InstallmentAllocation extends Components {
  installmentNo: number;
  /** Future interest forgiven on early payoff (consumer-friendly: no unearned interest charged). */
  interestWaived: Decimal;
  fullySettled: boolean;
}

export interface PaymentResult {
  amount: Decimal;
  totals: Components;
  allocations: InstallmentAllocation[];
  closesLoan: boolean;
  totalInterestWaived: Decimal;
}

export class PaymentError extends Error {}

export function remainingOf(i: InstallmentState): Components {
  return {
    principal: maxDec(dec(i.principalDue).minus(dec(i.principalPaid)), ZERO),
    interest: maxDec(dec(i.interestDue).minus(dec(i.interestPaid)), ZERO),
    fee: maxDec(dec(i.feeDue).minus(dec(i.feePaid)), ZERO),
    penalty: maxDec(dec(i.penaltyDue).minus(dec(i.penaltyPaid)), ZERO),
  };
}

export function totalOf(c: Components): Decimal {
  return c.principal.plus(c.interest).plus(c.fee).plus(c.penalty);
}

/** Sum of everything still owed under the contractual schedule (including future interest). */
export function totalOutstanding(installments: InstallmentState[]): Decimal {
  return sum(installments.map((i) => totalOf(remainingOf(i))));
}

export function outstandingPrincipal(installments: InstallmentState[]): Decimal {
  return sum(installments.map((i) => remainingOf(i).principal));
}

/**
 * Early payoff: past-due installments in full; the current period's interest pro-rated by days elapsed;
 * all later interest waived. Returns the per-installment interest that would be charged.
 */
export function computePayoff(installments: InstallmentState[], asOf: Date = new Date(), loanStartDate?: Date): { payoff: Decimal; chargeableInterest: Map<number, Decimal> } {
  const today = startOfDayUTC(asOf);
  const sorted = [...installments].sort((a, b) => a.installmentNo - b.installmentNo);
  const chargeable = new Map<number, Decimal>();
  let payoff = ZERO;
  let currentPeriodSeen = false;

  for (let idx = 0; idx < sorted.length; idx++) {
    const inst = sorted[idx];
    const rem = remainingOf(inst);
    const due = startOfDayUTC(inst.dueDate);
    let interest: Decimal;
    if (due.getTime() <= today.getTime()) {
      interest = rem.interest;
    } else if (!currentPeriodSeen) {
      currentPeriodSeen = true;
      const periodStart = idx > 0 ? startOfDayUTC(sorted[idx - 1].dueDate) : startOfDayUTC(loanStartDate ?? addMonthsUTC(due, -1));
      const periodDays = Math.max(daysBetween(periodStart, due), 1);
      const elapsed = Math.min(Math.max(daysBetween(periodStart, today), 0), periodDays);
      const accrued = money(dec(inst.interestDue).mul(elapsed).div(periodDays));
      interest = maxDec(accrued.minus(dec(inst.interestPaid)), ZERO);
    } else {
      interest = ZERO;
    }
    chargeable.set(inst.installmentNo, interest);
    payoff = payoff.plus(rem.principal).plus(rem.fee).plus(rem.penalty).plus(interest);
  }
  return { payoff: money(payoff), chargeableInterest: chargeable };
}

/**
 * Allocates a payment. Order: oldest installment first; within an installment
 * penalty → fee → interest → principal. If the amount equals the payoff amount the loan is
 * closed and unearned interest is waived. Overpayment is rejected (no silent credit balances).
 */
export function applyPayment(installments: InstallmentState[], amountLike: DecimalLike, asOf: Date = new Date(), loanStartDate?: Date): PaymentResult {
  const amount = money(amountLike);
  if (amount.lte(0)) throw new PaymentError('Payment amount must be positive');
  const sorted = [...installments].sort((a, b) => a.installmentNo - b.installmentNo);
  const { payoff, chargeableInterest } = computePayoff(sorted, asOf, loanStartDate);
  if (amount.gt(payoff)) throw new PaymentError(`Payment exceeds payoff amount ${payoff.toFixed(2)}`);

  const allocations: InstallmentAllocation[] = [];
  const totals: Components = { principal: ZERO, interest: ZERO, fee: ZERO, penalty: ZERO };
  let totalWaived = ZERO;

  if (amount.eq(payoff)) {
    for (const inst of sorted) {
      const rem = remainingOf(inst);
      const interest = chargeableInterest.get(inst.installmentNo) ?? ZERO;
      const waived = maxDec(rem.interest.minus(interest), ZERO);
      if (totalOf(rem).isZero()) continue;
      allocations.push({ installmentNo: inst.installmentNo, principal: rem.principal, interest, fee: rem.fee, penalty: rem.penalty, interestWaived: waived, fullySettled: true });
      totals.principal = totals.principal.plus(rem.principal);
      totals.interest = totals.interest.plus(interest);
      totals.fee = totals.fee.plus(rem.fee);
      totals.penalty = totals.penalty.plus(rem.penalty);
      totalWaived = totalWaived.plus(waived);
    }
    return { amount, totals, allocations, closesLoan: true, totalInterestWaived: totalWaived };
  }

  let left = amount;
  for (const inst of sorted) {
    if (left.isZero()) break;
    const rem = remainingOf(inst);
    if (totalOf(rem).isZero()) continue;
    const take = (owed: Decimal) => {
      const v = minDec(owed, left);
      left = left.minus(v);
      return v;
    };
    const penalty = take(rem.penalty);
    const fee = take(rem.fee);
    const interest = take(rem.interest);
    const principal = take(rem.principal);
    const fullySettled = penalty.eq(rem.penalty) && fee.eq(rem.fee) && interest.eq(rem.interest) && principal.eq(rem.principal);
    allocations.push({ installmentNo: inst.installmentNo, principal, interest, fee, penalty, interestWaived: ZERO, fullySettled });
    totals.principal = totals.principal.plus(principal);
    totals.interest = totals.interest.plus(interest);
    totals.fee = totals.fee.plus(fee);
    totals.penalty = totals.penalty.plus(penalty);
  }
  const closesLoan = totalOutstanding(sorted).eq(amount);
  return { amount, totals, allocations, closesLoan, totalInterestWaived: ZERO };
}

/**
 * Late-payment penalty (алданги) on an installment: unpaid principal × daily rate × days overdue,
 * optionally capped at a percentage of the overdue amount. Recomputed from scratch (idempotent),
 * so running the daily job twice never double-charges. Caps must be set per legal review.
 */
export function calculatePenalty(inst: InstallmentState, dailyRatePercent: DecimalLike, asOf: Date, capPercentOfOverdue?: DecimalLike): Decimal {
  const days = daysBetween(inst.dueDate, asOf);
  if (days <= 0) return ZERO;
  const rem = remainingOf(inst);
  const base = rem.principal.plus(rem.interest);
  if (base.isZero()) return dec(inst.penaltyDue);
  let penalty = money(base.mul(pct(dailyRatePercent)).mul(days));
  if (capPercentOfOverdue !== undefined) penalty = minDec(penalty, money(base.mul(pct(capPercentOfOverdue))));
  // Never reduce a penalty already accrued/paid.
  return maxDec(penalty, dec(inst.penaltyDue));
}

export function nextDueInstallment(installments: InstallmentState[]): InstallmentState | null {
  return [...installments].sort((a, b) => a.installmentNo - b.installmentNo).find((i) => totalOf(remainingOf(i)).gt(0)) ?? null;
}
