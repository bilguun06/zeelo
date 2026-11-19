import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDERS } from './providers/payment-provider';
import { QPayProvider } from './providers/qpay.provider';
import { SandboxPaymentProvider } from './providers/sandbox.provider';
import { UnconfiguredProvider } from './providers/unconfigured.provider';

@Module({
  imports: [LoansModule],
  controllers: [PaymentsController],
  providers: [
    SandboxPaymentProvider,
    QPayProvider,
    {
      provide: PAYMENT_PROVIDERS,
      inject: [SandboxPaymentProvider, QPayProvider],
      useFactory: (sandbox: SandboxPaymentProvider, qpay: QPayProvider) => [
        qpay,
        new UnconfiguredProvider('SOCIALPAY'),
        new UnconfiguredProvider('BANK_TRANSFER'),
        sandbox,
      ],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
