import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationCategory, Prisma } from '@prisma/client';
import type { NotificationDto } from '@orgil/shared';
import { PrismaService, type Tx } from '../../common/prisma.service';
import { paginate } from '../../common/serialize';

/** Built-in fallbacks; admins override these via notification_templates (same codes). */
export const DEFAULT_TEMPLATES: Record<string, { category: NotificationCategory; titleMn: string; bodyMn: string; titleEn: string; bodyEn: string }> = {
  APPLICATION_RECEIVED: { category: 'SYSTEM', titleMn: 'Хүсэлт хүлээн авлаа', bodyMn: '{{applicationNo}} дугаартай {{amount}} зээлийн хүсэлтийг хянаж байна.', titleEn: 'Application received', bodyEn: 'We are reviewing application {{applicationNo}} for {{amount}}.' },
  LOAN_APPROVED: { category: 'LOAN_APPROVED', titleMn: 'Зээл зөвшөөрөгдлөө', bodyMn: '{{amount}} зээлийн хүсэлт зөвшөөрөгдлөө. Удахгүй таны дансанд шилжинэ.', titleEn: 'Loan approved', bodyEn: 'Your {{amount}} loan was approved and will be disbursed shortly.' },
  LOAN_REJECTED: { category: 'LOAN_REJECTED', titleMn: 'Зээлийн хүсэлтийн хариу', bodyMn: 'Уучлаарай, {{applicationNo}} хүсэлтийг энэ удаад зөвшөөрөх боломжгүй байна. Шалтгаан: {{reason}}', titleEn: 'Application decision', bodyEn: 'Sorry, application {{applicationNo}} could not be approved. Reason: {{reason}}' },
  INFO_REQUESTED: { category: 'INFO_REQUESTED', titleMn: 'Нэмэлт мэдээлэл шаардлагатай', bodyMn: '{{applicationNo}}: {{message}}', titleEn: 'More information needed', bodyEn: '{{applicationNo}}: {{message}}' },
  LOAN_DISBURSED: { category: 'LOAN_DISBURSED', titleMn: 'Зээл олгогдлоо', bodyMn: '{{amount}} таны {{account}} дансанд шилжүүлэх хүсэлт илгээгдлээ. Эхний төлөлт {{firstDue}}.', titleEn: 'Loan disbursed', bodyEn: '{{amount}} was sent to account {{account}}. First payment due {{firstDue}}.' },
  PAYMENT_SUCCESS: { category: 'PAYMENT_SUCCESS', titleMn: 'Төлөлт амжилттай', bodyMn: '{{loanNo}} зээлд {{amount}} төлөгдлөө. Баримт: {{receiptNo}}', titleEn: 'Payment received', bodyEn: '{{amount}} paid toward {{loanNo}}. Receipt: {{receiptNo}}' },
  DUE_SOON: { category: 'DUE_SOON', titleMn: 'Төлөлтийн хугацаа ойртлоо', bodyMn: '{{loanNo}} зээлийн {{amount}} төлөлт {{dueDate}}-нд хийгдэнэ.', titleEn: 'Payment due soon', bodyEn: '{{amount}} for {{loanNo}} is due on {{dueDate}}.' },
  REPAYMENT_REMINDER: { category: 'REPAYMENT_REMINDER', titleMn: 'Төлөлт хугацаа хэтэрсэн', bodyMn: '{{loanNo}} зээлийн төлөлт {{days}} хоног хэтэрсэн байна. Алданги нэмэгдэхээс сэргийлж төлнө үү.', titleEn: 'Payment overdue', bodyEn: 'Your {{loanNo}} payment is {{days}} days overdue. Please pay to avoid penalties.' },
};

const render = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, code: keyof typeof DEFAULT_TEMPLATES | string, vars: Record<string, string | number>, data?: Record<string, unknown>, tx?: Tx) {
    const client = tx ?? this.prisma;
    const custom = await client.notificationTemplate.findUnique({ where: { code } });
    const tpl = custom ?? DEFAULT_TEMPLATES[code];
    if (!tpl) throw new Error(`Unknown notification template ${code}`);
    const n = await client.notification.create({
      data: {
        userId,
        category: tpl.category,
        titleMn: render(tpl.titleMn, vars),
        bodyMn: render(tpl.bodyMn, vars),
        titleEn: render(tpl.titleEn, vars),
        bodyEn: render(tpl.bodyEn, vars),
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    // Integration point: push delivery (Expo Push / FCM / APNs) and SMS fallback per user prefs.
    this.logger.debug(`notification ${code} → ${userId}`);
    return n;
  }

  async list(userId: string, lang: 'mn' | 'en', q: { page?: string; pageSize?: string; unread?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const where: Prisma.NotificationWhereInput = { userId, ...(q.unread === 'true' ? { readAt: null } : {}) };
    const [rows, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const items: NotificationDto[] = rows.map((n) => ({
      id: n.id,
      category: n.category,
      title: lang === 'en' ? n.titleEn : n.titleMn,
      body: lang === 'en' ? n.bodyEn : n.bodyMn,
      data: (n.data as Record<string, unknown>) ?? null,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
    return { items, total, page, pageSize, unread };
  }

  async markRead(userId: string, id: string) {
    const r = await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (!r.count) throw new NotFoundException();
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}
