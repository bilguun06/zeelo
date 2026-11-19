import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMonthsUTC, annuityPayment, applyPayment, buildSchedule, calculatePenalty, calculateQuote, computePayoff, dec, sum, type InstallmentState } from './index';

const terms = { monthlyInterestRate: '3', serviceFeePercent: '1', serviceFeeFixed: '0', repaymentMethod: 'ANNUITY' as const, feeCollection: 'DEDUCTED_FROM_DISBURSEMENT' as const };
const start = new Date(Date.UTC(2026, 0, 31));

test('annuity payment matches closed form', () => {
  // 2,000,000 @ 3%/mo × 12 → 200,924.17 (P·r/(1−(1+r)^−n))
  assert.equal(annuityPayment('2000000', '3', 12).toFixed(2), '200924.17');
});

test('schedule principal reconciles exactly to the loan amount', () => {
  for (const method of ['ANNUITY', 'EQUAL_PRINCIPAL', 'BULLET'] as const) {
    const lines = buildSchedule({ ...terms, repaymentMethod: method, principal: '1234567.89', termMonths: method === 'BULLET' ? 3 : 7, startDate: start });
    assert.equal(sum(lines.map((l) => l.principal)).toFixed(2), '1234567.89', method);
    assert.equal(lines[lines.length - 1].balanceAfter.toFixed(2), '0.00');
  }
});

test('month-end dates clamp correctly', () => {
  assert.equal(addMonthsUTC(start, 1).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(addMonthsUTC(start, 2).toISOString().slice(0, 10), '2026-03-31');
});

test('quote: fee deducted, totals consistent, APR above nominal', () => {
  const q = calculateQuote({ ...terms, principal: '2000000', termMonths: 12, startDate: start });
  assert.equal(q.serviceFee, '20000.00');
  assert.equal(q.netDisbursement, '1980000.00');
  assert.equal(dec(q.totalRepayment).toFixed(2), dec(q.principal).plus(q.totalInterest).toFixed(2));
  assert.ok(dec(q.apr).gt(36), `APR ${q.apr} should exceed nominal 36% because of the fee`);
});

test('zero-interest loan has no interest and zero APR', () => {
  const q = calculateQuote({ ...terms, monthlyInterestRate: '0', serviceFeePercent: '0', principal: '600000', termMonths: 6, startDate: start });
  assert.equal(q.totalInterest, '0.00');
  assert.equal(q.monthlyPayment, '100000.00');
  assert.equal(q.apr, '0.00');
});

function toState(principal: string, months: number): InstallmentState[] {
  return buildSchedule({ ...terms, principal, termMonths: months, startDate: start }).map((l) => ({
    installmentNo: l.installmentNo, dueDate: l.dueDate, principalDue: l.principal, interestDue: l.interest, feeDue: l.fee,
    penaltyDue: 0, principalPaid: 0, interestPaid: 0, feePaid: 0, penaltyPaid: 0,
  }));
}

test('partial payment allocates interest before principal', () => {
  const st = toState('1000000', 6);
  const r = applyPayment(st, '10000', start);
  assert.equal(r.totals.interest.toFixed(2), '10000.00');
  assert.equal(r.totals.principal.toFixed(2), '0.00');
  assert.equal(r.closesLoan, false);
});

test('payoff on disbursement day waives all future interest', () => {
  const st = toState('1000000', 6);
  const { payoff } = computePayoff(st, start, start);
  assert.equal(payoff.toFixed(2), '1000000.00');
  const r = applyPayment(st, payoff, start, start);
  assert.equal(r.closesLoan, true);
  assert.ok(r.totalInterestWaived.gt(0));
});

test('overpayment is rejected', () => {
  assert.throws(() => applyPayment(toState('500000', 3), '9999999', start));
});

test('penalty is idempotent and capped', () => {
  const [first] = toState('1000000', 6);
  const asOf = new Date(first.dueDate.getTime() + 10 * 86_400_000);
  const p1 = calculatePenalty(first, '0.5', asOf);
  const p2 = calculatePenalty({ ...first, penaltyDue: p1 }, '0.5', asOf);
  assert.equal(p1.toFixed(2), p2.toFixed(2));
  const capped = calculatePenalty(first, '0.5', new Date(first.dueDate.getTime() + 400 * 86_400_000), '20');
  const base = dec(first.principalDue).plus(first.interestDue);
  assert.equal(capped.toFixed(2), base.mul(0.2).toFixed(2));
});
