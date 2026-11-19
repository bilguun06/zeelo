import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXCLUDED_ATTRIBUTES, scoreApplication, type ScoringInput } from '../src/modules/credit/credit-scoring';

const base: ScoringInput = {
  monthlyIncome: '3000000', monthlyObligations: '200000', employmentMonths: 30, employmentType: 'FULL_TIME', kycVerified: true, ageYears: 30,
  requestedAmount: '2000000', newMonthlyPayment: '195000',
  internal: { completedLoans: 1, lateInstallments: 0, currentlyOverdue: false },
  bureau: { monthlyDebtService: '0.00', delinquencies12m: 0, inquiries30d: 1, source: 'SIMULATED' },
  fraud: { applications24h: 1, accountAgeDays: 120, duplicateDocumentAcrossUsers: false },
  policy: { maxDti: '0.55', minAgeYears: 18, requiresKyc: true },
};

test('strong applicant gets approve recommendation but still requires a human', () => {
  const r = scoreApplication(base);
  assert.equal(r.recommendation, 'APPROVE_RECOMMENDED');
  assert.equal(r.requiresHumanDecision, true);
  assert.ok(['A', 'B'].includes(r.riskGrade));
});

test('DTI above policy → decline recommendation with explanation', () => {
  const r = scoreApplication({ ...base, monthlyObligations: '1800000' });
  assert.equal(r.recommendation, 'DECLINE_RECOMMENDED');
  assert.equal(r.policyChecks.find((c) => c.key === 'max_dti')?.passed, false);
});

test('high-severity fraud signal forces manual review, never auto-approve', () => {
  const r = scoreApplication({ ...base, fraud: { ...base.fraud, duplicateDocumentAcrossUsers: true } });
  assert.equal(r.recommendation, 'MANUAL_REVIEW');
});

test('every point is explained by a factor', () => {
  const r = scoreApplication(base);
  const sum = r.factors.reduce((s, f) => s + f.points, 600);
  assert.equal(r.score, Math.max(300, Math.min(850, sum)));
});

test('protected attributes are not model inputs', () => {
  const keys = Object.keys(base);
  for (const attr of EXCLUDED_ATTRIBUTES.filter((a) => a !== 'age')) assert.ok(!keys.includes(attr));
});
