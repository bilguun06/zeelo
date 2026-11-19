import { ServiceUnavailableException } from '@nestjs/common';
import type { PaymentProvider } from '@prisma/client';
import type { PaymentProviderAdapter, VerificationResult } from './payment-provider';

/**
 * Placeholder adapter for providers that require a commercial agreement before integration
 * (SocialPay, direct bank transfer APIs). It is always disabled and refuses every call, so the
 * app can list the method as "coming soon" without pretending it works.
 */
export class UnconfiguredProvider implements PaymentProviderAdapter {
  readonly sandbox = false;
  constructor(readonly code: PaymentProvider) {}
  isEnabled() {
    return false;
  }
  private fail(): never {
    throw new ServiceUnavailableException({ message: `${this.code} integration is not configured`, code: 'PROVIDER_UNAVAILABLE' });
  }
  async createInvoice(): Promise<never> {
    this.fail();
  }
  async verify(): Promise<VerificationResult> {
    this.fail();
  }
  async refund(): Promise<never> {
    this.fail();
  }
}
