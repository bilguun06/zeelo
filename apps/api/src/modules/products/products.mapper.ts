import type { LoanProduct } from '@prisma/client';
import type { PricingTerms } from '@orgil/financial-engine';
import type { Eligibility, LoanProductDto } from '@orgil/shared';
import { m, rate } from '../../common/serialize';

export function toProductDto(p: LoanProduct): LoanProductDto {
  return {
    id: p.id,
    code: p.code,
    category: p.category,
    nameMn: p.nameMn,
    nameEn: p.nameEn,
    descriptionMn: p.descriptionMn,
    descriptionEn: p.descriptionEn,
    minAmount: m(p.minAmount),
    maxAmount: m(p.maxAmount),
    amountStep: m(p.amountStep),
    allowedTerms: [...p.allowedTerms].sort((a, b) => a - b),
    monthlyInterestRate: rate(p.monthlyInterestRate),
    serviceFeePercent: rate(p.serviceFeePercent),
    serviceFeeFixed: m(p.serviceFeeFixed),
    feeCollection: p.feeCollection,
    repaymentMethod: p.repaymentMethod,
    penaltyRateDaily: rate(p.penaltyRateDaily),
    eligibility: (p.eligibility ?? {}) as Eligibility,
    status: p.status,
    isAuthorized: p.isAuthorized,
  };
}

export function pricingOf(p: Pick<LoanProduct, 'monthlyInterestRate' | 'serviceFeePercent' | 'serviceFeeFixed' | 'repaymentMethod' | 'feeCollection'>): PricingTerms {
  return {
    monthlyInterestRate: p.monthlyInterestRate.toString(),
    serviceFeePercent: p.serviceFeePercent.toString(),
    serviceFeeFixed: p.serviceFeeFixed.toString(),
    repaymentMethod: p.repaymentMethod,
    feeCollection: p.feeCollection,
  };
}
