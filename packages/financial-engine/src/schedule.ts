import { addMonthsUTC, startOfDayUTC } from './dates';
import { Dec, type Decimal, type DecimalLike, dec, money, pct, sum, toMoneyString, ZERO } from './money';

export type RepaymentMethod = 'ANNUITY' | 'EQUAL_PRINCIPAL' | 'BULLET';
export type FeeCollection = 'DEDUCTED_FROM_DISBURSEMENT' | 'ADDED_TO_FIRST_INSTALLMENT';

/** Product pricing — always loaded from admin configuration, never hardcoded in clients. */
export interface PricingTerms {
  /** Monthly nominal interest rate in percent, e.g. "2.8". */
  monthlyInterestRate: DecimalLike;
  /** One-time service fee as percent of principal. */
  serviceFeePercent: DecimalLike;
  /** One-time fixed service fee in MNT. */
  serviceFeeFixed: DecimalLike;
  repaymentMethod: RepaymentMethod;
  feeCollection: FeeCollection;
}

export interface ScheduleInput extends PricingTerms {
  principal: DecimalLike;
  termMonths: number;
  /** Disbursement date; first installment falls one month later. */
  startDate?: Date;
}

export interface ScheduleLine {
  installmentNo: number;
  dueDate: Date;
  principal: Decimal;
  interest: Decimal;
  fee: Decimal;
  payment: Decimal;
  balanceAfter: Decimal;
}

export interface Quote {
  principal: string;
  termMonths: number;
  monthlyInterestRate: string;
  totalInterest: string;
  serviceFee: string;
  netDisbursement: string;
  totalRepayment: string;
  firstPayment: string;
  lastPayment: string;
  /** Representative monthly payment (regular installment, excluding a first-installment fee). */
  monthlyPayment: string;
  /** (interest + fees) / principal × 100 */
  costOfCreditPercent: string;
  /** Nominal annual rate implied by all cash flows (IRR × 12), percent. */
  apr: string;
  /** Effective annual rate ((1+IRR)^12 − 1), percent. */
  effectiveAnnualRate: string;
  schedule: { installmentNo: number; dueDate: string; principal: string; interest: string; fee: string; payment: string; balanceAfter: string }[];
}

export class LoanInputError extends Error {}

function validate(input: ScheduleInput) {
  const p = dec(input.principal);
  if (!p.isFinite() || p.lte(0)) throw new LoanInputError('Principal must be positive');
  if (!Number.isInteger(input.termMonths) || input.termMonths < 1 || input.termMonths > 360) throw new LoanInputError('Term must be 1–360 months');
  if (dec(input.monthlyInterestRate).lt(0)) throw new LoanInputError('Interest rate cannot be negative');
  if (dec(input.serviceFeePercent).lt(0) || dec(input.serviceFeeFixed).lt(0)) throw new LoanInputError('Fees cannot be negative');
  if (input.repaymentMethod === 'BULLET' && input.termMonths > 12) throw new LoanInputError('Bullet repayment is limited to 12 months');
}

export function calculateServiceFee(principal: DecimalLike, feePercent: DecimalLike, feeFixed: DecimalLike): Decimal {
  return money(dec(principal).mul(pct(feePercent)).plus(dec(feeFixed)));
}

/** Level annuity payment: P·r / (1 − (1+r)^−n). */
export function annuityPayment(principal: DecimalLike, monthlyRatePercent: DecimalLike, termMonths: number): Decimal {
  const P = dec(principal);
  const r = pct(monthlyRatePercent);
  if (r.isZero()) return money(P.div(termMonths));
  const factor = new Dec(1).minus(r.plus(1).pow(-termMonths));
  return money(P.mul(r).div(factor));
}

/**
 * Builds the contractual repayment schedule.
 * Interest accrues monthly on the outstanding balance (30/360 convention); each line is rounded
 * to 2dp and the final installment absorbs rounding so principal always reconciles exactly.
 */
export function buildSchedule(input: ScheduleInput): ScheduleLine[] {
  validate(input);
  const P = money(input.principal);
  const n = input.termMonths;
  const r = pct(input.monthlyInterestRate);
  const start = startOfDayUTC(input.startDate ?? new Date());
  const fee = calculateServiceFee(P, input.serviceFeePercent, input.serviceFeeFixed);
  const feeOnFirst = input.feeCollection === 'ADDED_TO_FIRST_INSTALLMENT' ? fee : ZERO;

  const lines: ScheduleLine[] = [];
  let balance = P;

  if (input.repaymentMethod === 'BULLET') {
    const interest = money(P.mul(r).mul(n));
    lines.push({ installmentNo: 1, dueDate: addMonthsUTC(start, n), principal: P, interest, fee: feeOnFirst, payment: P.plus(interest).plus(feeOnFirst), balanceAfter: ZERO });
    return lines;
  }

  const level = input.repaymentMethod === 'ANNUITY' ? annuityPayment(P, input.monthlyInterestRate, n) : ZERO;
  const equalPrincipal = money(P.div(n));

  for (let i = 1; i <= n; i++) {
    const interest = money(balance.mul(r));
    let principal: Decimal;
    if (i === n) principal = balance;
    else if (input.repaymentMethod === 'ANNUITY') principal = level.minus(interest);
    else principal = equalPrincipal;
    if (principal.gt(balance)) principal = balance;
    if (principal.lt(0)) principal = ZERO;
    balance = balance.minus(principal);
    const lineFee = i === 1 ? feeOnFirst : ZERO;
    lines.push({
      installmentNo: i,
      dueDate: addMonthsUTC(start, i),
      principal,
      interest,
      fee: lineFee,
      payment: principal.plus(interest).plus(lineFee),
      balanceAfter: balance,
    });
  }
  return lines;
}

/** Monthly IRR of the borrower's cash flows via bisection (robust, no floats). */
export function monthlyIrr(netDisbursed: Decimal, payments: Decimal[]): Decimal {
  const total = sum(payments);
  if (netDisbursed.lte(0) || total.lte(netDisbursed)) return ZERO;
  const npv = (rate: Decimal) => {
    let df = new Dec(1);
    const step = new Dec(1).div(rate.plus(1));
    let pv = new Dec(0);
    for (const p of payments) {
      df = df.mul(step);
      pv = pv.plus(p.mul(df));
    }
    return pv.minus(netDisbursed);
  };
  let lo = new Dec(0);
  let hi = new Dec(1);
  for (let k = 0; k < 80; k++) {
    const mid = lo.plus(hi).div(2);
    if (npv(mid).gt(0)) lo = mid;
    else hi = mid;
  }
  return lo.plus(hi).div(2);
}

export function calculateQuote(input: ScheduleInput): Quote {
  const lines = buildSchedule(input);
  const P = money(input.principal);
  const fee = calculateServiceFee(P, input.serviceFeePercent, input.serviceFeeFixed);
  const totalInterest = sum(lines.map((l) => l.interest));
  const deducted = input.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT';
  const netDisbursement = deducted ? P.minus(fee) : P;
  const totalRepayment = sum(lines.map((l) => l.payment));
  const irr = monthlyIrr(netDisbursement, lines.map((l) => l.payment));
  const regular = lines.length > 1 ? lines[1].payment : lines[0].payment;

  return {
    principal: toMoneyString(P),
    termMonths: input.termMonths,
    monthlyInterestRate: dec(input.monthlyInterestRate).toString(),
    totalInterest: toMoneyString(totalInterest),
    serviceFee: toMoneyString(fee),
    netDisbursement: toMoneyString(netDisbursement),
    totalRepayment: toMoneyString(totalRepayment),
    firstPayment: toMoneyString(lines[0].payment),
    lastPayment: toMoneyString(lines[lines.length - 1].payment),
    monthlyPayment: toMoneyString(input.repaymentMethod === 'ANNUITY' ? regular : lines[0].payment),
    costOfCreditPercent: totalInterest.plus(fee).div(P).mul(100).toDecimalPlaces(2).toFixed(2),
    apr: irr.mul(1200).toDecimalPlaces(2).toFixed(2),
    effectiveAnnualRate: irr.plus(1).pow(12).minus(1).mul(100).toDecimalPlaces(2).toFixed(2),
    schedule: lines.map((l) => ({
      installmentNo: l.installmentNo,
      dueDate: l.dueDate.toISOString(),
      principal: toMoneyString(l.principal),
      interest: toMoneyString(l.interest),
      fee: toMoneyString(l.fee),
      payment: toMoneyString(l.payment),
      balanceAfter: toMoneyString(l.balanceAfter),
    })),
  };
}
