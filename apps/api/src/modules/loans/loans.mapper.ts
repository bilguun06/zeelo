import type { LoanProduct, LoanRepayment, LoanSchedule, Prisma } from '@prisma/client';
import { computePayoff, type InstallmentState, nextDueInstallment, remainingOf, sum, toMoneyString, totalOf, totalOutstanding } from '@orgil/financial-engine';
import type { LoanDetailDto, LoanDto, RepaymentDto, ScheduleItemDto } from '@orgil/shared';
import { m, rate, toDec } from '../../common/serialize';

export type LoanWithRelations = Prisma.LoanGetPayload<{ include: { schedule: true; product: true } }>;

export function toInstallmentState(s: LoanSchedule): InstallmentState {
  return {
    installmentNo: s.installmentNo,
    dueDate: s.dueDate,
    principalDue: s.principalDue.toString(),
    // Waived interest is no longer owed.
    interestDue: toDec(s.interestDue).minus(toDec(s.interestWaived)).toString(),
    feeDue: s.feeDue.toString(),
    penaltyDue: s.penaltyDue.toString(),
    principalPaid: s.principalPaid.toString(),
    interestPaid: s.interestPaid.toString(),
    feePaid: s.feePaid.toString(),
    penaltyPaid: s.penaltyPaid.toString(),
  };
}

export function toScheduleItem(s: LoanSchedule): ScheduleItemDto {
  const st = toInstallmentState(s);
  const rem = remainingOf(st);
  const due = toDec(st.principalDue).plus(toDec(st.interestDue)).plus(toDec(st.feeDue)).plus(toDec(st.penaltyDue));
  const paid = toDec(s.principalPaid).plus(toDec(s.interestPaid)).plus(toDec(s.feePaid)).plus(toDec(s.penaltyPaid));
  return {
    id: s.id,
    installmentNo: s.installmentNo,
    dueDate: s.dueDate.toISOString(),
    principalDue: m(s.principalDue),
    interestDue: toMoneyString(st.interestDue),
    feeDue: m(s.feeDue),
    penaltyDue: m(s.penaltyDue),
    totalDue: toMoneyString(due),
    totalPaid: toMoneyString(paid),
    remaining: toMoneyString(totalOf(rem)),
    status: s.status,
    paidAt: s.paidAt?.toISOString() ?? null,
  };
}

export function toRepaymentDto(r: LoanRepayment): RepaymentDto {
  return {
    id: r.id, receiptNo: r.receiptNo, amount: m(r.amount), principalPart: m(r.principalPart), interestPart: m(r.interestPart),
    feePart: m(r.feePart), penaltyPart: m(r.penaltyPart), paidAt: r.paidAt.toISOString(), provider: r.provider, sandbox: r.sandbox,
  };
}

export function toLoanDto(loan: LoanWithRelations, asOf = new Date()): LoanDto {
  const states = loan.schedule.map(toInstallmentState);
  const next = nextDueInstallment(states);
  const paidCount = loan.schedule.filter((s) => s.status === 'PAID' || s.status === 'WAIVED').length;
  const open = loan.status === 'ACTIVE' || loan.status === 'OVERDUE';
  const product = loan.product as LoanProduct;
  return {
    id: loan.id,
    loanNo: loan.loanNo,
    status: loan.status,
    product: { id: product.id, nameMn: product.nameMn, nameEn: product.nameEn, category: product.category },
    principal: m(loan.principal),
    outstandingPrincipal: m(loan.outstandingPrincipal),
    totalOutstanding: toMoneyString(totalOutstanding(states)),
    payoffAmount: open ? toMoneyString(computePayoff(states, asOf, loan.disbursedAt).payoff) : '0.00',
    interestPaid: toMoneyString(sum(loan.schedule.map((s) => s.interestPaid.toString()))),
    monthlyInterestRate: rate(loan.monthlyInterestRate),
    termMonths: loan.termMonths,
    disbursedAt: loan.disbursedAt.toISOString(),
    maturityDate: loan.maturityDate.toISOString(),
    nextDue: open && next ? { date: next.dueDate.toISOString(), amount: toMoneyString(totalOf(remainingOf(next))), installmentNo: next.installmentNo } : null,
    paidInstallments: paidCount,
    progress: loan.schedule.length ? Math.round((paidCount / loan.schedule.length) * 100) / 100 : 0,
  };
}

export function toLoanDetail(loan: LoanWithRelations & { repayments: LoanRepayment[] }): LoanDetailDto {
  return {
    ...toLoanDto(loan),
    schedule: [...loan.schedule].sort((a, b) => a.installmentNo - b.installmentNo).map(toScheduleItem),
    repayments: [...loan.repayments].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime()).map(toRepaymentDto),
  };
}
