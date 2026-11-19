import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReportsService } from '../reports/reports.service';
import { AdminApplicationsController } from './admin-applications.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminLoansController } from './admin-loans.controller';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminUsersController } from './admin-users.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [LoansModule, PaymentsModule],
  controllers: [
    AdminAuthController,
    AdminUsersController,
    AdminApplicationsController,
    AdminProductsController,
    AdminLoansController,
    AdminNotificationsController,
    AdminSettingsController,
  ],
  providers: [ReportsService, AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AdminModule {}
