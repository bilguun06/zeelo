/**
 * Explainable credit scoring model — orgil-scorecard v1 (rules + weighted scorecard).
 *
 * Design principles:
 *  1. DECISION SUPPORT ONLY. Output is a recommendation; a human credit officer makes every decision.
 *  2. EXPLAINABLE. Every point added or removed is returned as a factor with a plain-language reason.
 *  3. NON-DISCRIMINATORY INPUTS. The model never receives gender, ethnicity, religion, marital status,
 *     region/address, disability or age (beyond the legal minimum-age policy check).
 *  4. Weights are a development baseline and MUST be validated on real portfolio data, back-tested,
 *     and approved by the provider's risk committee before production use.
 */
import { dec, type Decimal } from '@orgil/financial-engine';

export const MODEL_VERSION = 'orgil-scorecard-1.0.0';
export const EXCLUDED_ATTRIBUTES = ['gender', 'ethnicity', 'religion', 'maritalStatus', 'address', 'region', 'disability', 'age'] as const;

export interface ScoringInput {
  monthlyIncome: string | null;
  monthlyObligations: string | null;
  employmentMonths: number | null;
  employmentType: string | null;
  kycVerified: boolean;
  ageYears: number | null;
  requestedAmount: string;
  newMonthlyPayment: string;
  internal: { completedLoans: number; lateInstallments: number; currentlyOverdue: boolean };
  bureau: { monthlyDebtService: string; delinquencies12m: number; inquiries30d: number; source: 'SIMULATED' | 'BUREAU' };
  fraud: { applications24h: number; accountAgeDays: number; duplicateDocumentAcrossUsers: boolean };
  policy: { maxDti: string; minAgeYears: number; minMonthlyIncome?: string; minEmploymentMonths?: number; requiresKyc?: boolean };
}

export interface Factor { key: string; labelMn: string; labelEn: string; impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'; points: number; detail: string }
export interface PolicyCheck { key: string; passed: boolean; detail: string }
export interface FraudFlag { key: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; detail: string }

export interface ScoringResult {
  score: number;
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  probabilityOfDefault: string;
  debtToIncome: string;
  recommendation: 'APPROVE_RECOMMENDED' | 'MANUAL_REVIEW' | 'DECLINE_RECOMMENDED';
  factors: Factor[];
  policyChecks: PolicyCheck[];
  fraudFlags: FraudFlag[];
  modelVersion: string;
  requiresHumanDecision: true;
}

const BASE = 600;
const GRADES: { min: number; grade: ScoringResult['riskGrade']; pd: string }[] = [
  { min: 750, grade: 'A', pd: '0.0200' },
  { min: 680, grade: 'B', pd: '0.0500' },
  { min: 620, grade: 'C', pd: '0.1000' },
  { min: 560, grade: 'D', pd: '0.1800' },
  { min: 0, grade: 'E', pd: '0.3000' },
];

function factor(key: string, labelMn: string, labelEn: string, points: number, detail: string): Factor {
  return { key, labelMn, labelEn, points, detail, impact: points > 0 ? 'POSITIVE' : points < 0 ? 'NEGATIVE' : 'NEUTRAL' };
}

export function scoreApplication(input: ScoringInput): ScoringResult {
  const factors: Factor[] = [];
  const income = dec(input.monthlyIncome ?? 0);
  const obligations = dec(input.monthlyObligations ?? 0).plus(dec(input.bureau.monthlyDebtService));
  const payment = dec(input.newMonthlyPayment);
  const dti: Decimal = income.gt(0) ? obligations.plus(payment).div(income) : dec(9.9999);

  // 1. Affordability (debt-to-income incl. the new loan)
  const dtiPct = dti.mul(100).toDecimalPlaces(1).toString();
  if (dti.lte(0.3)) factors.push(factor('dti', 'Өр/орлогын харьцаа', 'Debt-to-income', 60, `DTI ${dtiPct}% — strong affordability`));
  else if (dti.lte(0.45)) factors.push(factor('dti', 'Өр/орлогын харьцаа', 'Debt-to-income', 20, `DTI ${dtiPct}% — acceptable`));
  else if (dti.lte(0.6)) factors.push(factor('dti', 'Өр/орлогын харьцаа', 'Debt-to-income', -40, `DTI ${dtiPct}% — stretched`));
  else factors.push(factor('dti', 'Өр/орлогын харьцаа', 'Debt-to-income', -120, `DTI ${dtiPct}% — unaffordable`));

  // 2. Employment stability
  const months = input.employmentMonths ?? 0;
  const empPts = months >= 24 ? 50 : months >= 12 ? 25 : months >= 6 ? 0 : -40;
  factors.push(factor('employment_tenure', 'Ажилласан хугацаа', 'Employment tenure', empPts, `${months} months with current employer`));

  // 3. Income type stability (regular vs irregular income — not a proxy for protected traits)
  const stable = ['FULL_TIME', 'PENSIONER'].includes(input.employmentType ?? '');
  const irregular = ['PART_TIME', 'OTHER'].includes(input.employmentType ?? '');
  factors.push(factor('income_stability', 'Орлогын тогтвортой байдал', 'Income regularity', stable ? 20 : irregular ? -10 : 0, `Employment type ${input.employmentType ?? 'unknown'}`));

  // 4. Internal repayment history
  const histPts = Math.min(input.internal.completedLoans * 15, 45) - Math.min(input.internal.lateInstallments * 30, 120) - (input.internal.currentlyOverdue ? 150 : 0);
  factors.push(factor('repayment_history', 'Төлөлтийн түүх', 'Repayment history', histPts,
    `${input.internal.completedLoans} completed loans, ${input.internal.lateInstallments} late installments${input.internal.currentlyOverdue ? ', currently overdue' : ''}`));

  // 5. Credit bureau (simulated until an authorized integration exists)
  const bureauPts = -50 * input.bureau.delinquencies12m - (input.bureau.inquiries30d > 3 ? 30 : 0);
  factors.push(factor('bureau', 'Зээлийн мэдээллийн сан', 'Credit bureau', bureauPts,
    `${input.bureau.delinquencies12m} delinquencies (12m), ${input.bureau.inquiries30d} inquiries (30d) [${input.bureau.source}]`));

  // 6. Loan size relative to annual income
  const sizeRatio = income.gt(0) ? dec(input.requestedAmount).div(income.mul(12)) : dec(99);
  factors.push(factor('loan_size', 'Зээлийн хэмжээ / орлого', 'Loan size vs income', sizeRatio.gt(1) ? -40 : sizeRatio.lte(0.3) ? 15 : 0,
    `Requested amount is ${sizeRatio.mul(100).toDecimalPlaces(0)}% of annual income`));

  const score = Math.max(300, Math.min(850, BASE + factors.reduce((s, f) => s + f.points, 0)));
  const band = GRADES.find((g) => score >= g.min)!;

  // Hard policy rules (configurable; failing any → decline recommendation)
  const p = input.policy;
  const policyChecks: PolicyCheck[] = [
    { key: 'max_dti', passed: dti.lte(dec(p.maxDti)), detail: `DTI ${dtiPct}% vs max ${dec(p.maxDti).mul(100)}%` },
    { key: 'min_age', passed: (input.ageYears ?? 0) >= p.minAgeYears, detail: `Legal minimum age ${p.minAgeYears}` },
    { key: 'income_present', passed: income.gt(0), detail: 'Monthly income provided' },
  ];
  if (p.requiresKyc) policyChecks.push({ key: 'kyc', passed: input.kycVerified, detail: 'Identity documents verified' });
  if (p.minMonthlyIncome) policyChecks.push({ key: 'min_income', passed: income.gte(dec(p.minMonthlyIncome)), detail: `Income ≥ ${p.minMonthlyIncome}` });
  if (p.minEmploymentMonths) policyChecks.push({ key: 'min_employment', passed: months >= p.minEmploymentMonths, detail: `Employment ≥ ${p.minEmploymentMonths} months` });

  // Fraud indicators (flag for review — never auto-decline on fraud signals alone)
  const fraudFlags: FraudFlag[] = [];
  if (input.fraud.duplicateDocumentAcrossUsers) fraudFlags.push({ key: 'duplicate_document', severity: 'HIGH', detail: 'Identity document image also used by another account' });
  if (input.fraud.applications24h >= 3) fraudFlags.push({ key: 'velocity', severity: 'MEDIUM', detail: `${input.fraud.applications24h} applications in 24h` });
  if (input.fraud.accountAgeDays < 1) fraudFlags.push({ key: 'new_account', severity: 'LOW', detail: 'Account created less than 24h ago' });
  if (income.gt(30_000_000)) fraudFlags.push({ key: 'income_outlier', severity: 'MEDIUM', detail: 'Declared income is unusually high — verify documents' });
  if (input.bureau.inquiries30d > 5) fraudFlags.push({ key: 'credit_shopping', severity: 'LOW', detail: 'Many recent credit inquiries' });

  let recommendation: ScoringResult['recommendation'];
  if (policyChecks.some((c) => !c.passed)) recommendation = 'DECLINE_RECOMMENDED';
  else if (fraudFlags.some((f) => f.severity !== 'LOW')) recommendation = 'MANUAL_REVIEW';
  else if (band.grade === 'A' || band.grade === 'B') recommendation = 'APPROVE_RECOMMENDED';
  else if (band.grade === 'E') recommendation = 'DECLINE_RECOMMENDED';
  else recommendation = 'MANUAL_REVIEW';

  return {
    score,
    riskGrade: band.grade,
    probabilityOfDefault: band.pd,
    debtToIncome: dti.toDecimalPlaces(4).toFixed(4),
    recommendation,
    factors,
    policyChecks,
    fraudFlags,
    modelVersion: MODEL_VERSION,
    requiresHumanDecision: true,
  };
}
