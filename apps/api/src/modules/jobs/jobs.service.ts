import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../common/cache.service';
import { AnnouncementsService } from '../admin/announcements.service';
import { LoansService } from '../loans/loans.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * Background jobs. Each job takes a short distributed lock (Redis) so that running several API
 * replicas never executes the same job concurrently. All jobs are idempotent.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');

  constructor(
    private readonly cache: CacheService,
    private readonly loans: LoansService,
    private readonly payments: PaymentsService,
    private readonly announcements: AnnouncementsService,
  ) {}

  private async locked(name: string, ttl: number, fn: () => Promise<unknown>) {
    const key = `lock:job:${name}`;
    if ((await this.cache.incr(key, ttl)) > 1) return;
    try {
      const r = await fn();
      this.logger.log(`${name} done ${JSON.stringify(r)}`);
    } catch (e) {
      this.logger.error(`${name} failed: ${(e as Error).message}`);
    } finally {
      await this.cache.del(key);
    }
  }

  @Cron('0 5 0 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  overdue() {
    return this.locked('overdue', 3600, () => this.loans.refreshOverdue());
  }

  @Cron('0 0 10 * * *', { timeZone: 'Asia/Ulaanbaatar' })
  reminders() {
    return this.locked('reminders', 3600, () => this.loans.sendReminders());
  }

  @Cron(CronExpression.EVERY_MINUTE)
  scheduledAnnouncements() {
    return this.locked('announcements', 55, () => this.announcements.sendDue());
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  paymentSweep() {
    return this.locked('payment-sweep', 280, () => this.payments.sweep());
  }
}
