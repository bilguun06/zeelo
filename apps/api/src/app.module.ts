import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { requestContextMiddleware } from './common/request-context';
import { HealthController } from './health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { CreditModule } from './modules/credit/credit.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { KycModule } from './modules/kyc/kyc.module';
import { LoansModule } from './modules/loans/loans.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    CommonModule,
    NotificationsModule,
    TransactionsModule,
    CreditModule,
    DocumentsModule,
    KycModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    ApplicationsModule,
    LoansModule,
    PaymentsModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestContextMiddleware).forRoutes('*');
  }
}
