import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { LoanProduct } from '@prisma/client';
import { calculateQuote, dec, type PricingTerms } from '@orgil/financial-engine';
import type { QuoteDto } from '@orgil/shared';
import { PrismaService } from '../../common/prisma.service';
import { pricingOf, toProductDto } from './products.mapper';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Customers only ever see products that are ACTIVE and authorized by the provider. */
  async listPublic() {
    const rows = await this.prisma.loanProduct.findMany({ where: { status: 'ACTIVE', isAuthorized: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toProductDto);
  }

  async getPublic(id: string): Promise<LoanProduct> {
    const p = await this.prisma.loanProduct.findFirst({ where: { id, status: 'ACTIVE', isAuthorized: true } });
    if (!p) throw new NotFoundException({ message: 'Product not available', code: 'PRODUCT_UNAVAILABLE' });
    return p;
  }

  assertWithinLimits(p: LoanProduct, amount: string, termMonths: number) {
    const a = dec(amount);
    if (a.lt(p.minAmount.toString()) || a.gt(p.maxAmount.toString())) {
      throw new UnprocessableEntityException({ message: `Amount must be between ${p.minAmount} and ${p.maxAmount}`, code: 'AMOUNT_OUT_OF_RANGE' });
    }
    if (!a.minus(p.minAmount.toString()).mod(p.amountStep.toString()).isZero() && !a.eq(p.maxAmount.toString())) {
      throw new UnprocessableEntityException({ message: `Amount must be in steps of ${p.amountStep}`, code: 'AMOUNT_STEP' });
    }
    if (!p.allowedTerms.includes(termMonths)) {
      throw new UnprocessableEntityException({ message: `Term must be one of ${p.allowedTerms.join(', ')}`, code: 'TERM_NOT_ALLOWED' });
    }
  }

  quoteFor(pricing: PricingTerms, amount: string, termMonths: number, isDemonstration: boolean, startDate?: Date): QuoteDto {
    return { ...calculateQuote({ ...pricing, principal: amount, termMonths, startDate }), isDemonstration };
  }

  /** Quote against a live product's configured pricing. Still an estimate until a contract is signed. */
  async quote(productId: string, amount: string, termMonths: number): Promise<QuoteDto> {
    const p = await this.getPublic(productId);
    this.assertWithinLimits(p, amount, termMonths);
    return this.quoteFor(pricingOf(p), amount, termMonths, true);
  }
}
