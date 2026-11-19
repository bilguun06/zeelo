import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import type { Announcement, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);
  constructor(private readonly prisma: PrismaService) {}

  private audienceWhere(a: Announcement): Prisma.UserWhereInput {
    const base: Prisma.UserWhereInput = { status: 'ACTIVE' };
    if (a.audience === 'ACTIVE_BORROWERS') return { ...base, loans: { some: { status: { in: ['ACTIVE', 'OVERDUE'] } } } };
    if (a.audience === 'OVERDUE_BORROWERS') return { ...base, loans: { some: { status: 'OVERDUE' } } };
    return base;
  }

  /** Fans an announcement out as in-app notifications, in batches. */
  async send(id: string) {
    // Claim the announcement atomically so concurrent schedulers cannot double-send.
    const claimed = await this.prisma.announcement.updateMany({ where: { id, status: { in: ['DRAFT', 'SCHEDULED'] } }, data: { status: 'SENT', sentAt: new Date() } });
    if (!claimed.count) throw new UnprocessableEntityException({ message: 'Announcement already sent or cancelled', code: 'INVALID_STATUS' });
    const a = await this.prisma.announcement.findUniqueOrThrow({ where: { id } });
    let cursor: string | undefined;
    let recipients = 0;
    for (;;) {
      const users = await this.prisma.user.findMany({ where: this.audienceWhere(a), select: { id: true }, take: 500, orderBy: { id: 'asc' }, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
      if (!users.length) break;
      await this.prisma.notification.createMany({
        data: users.map((u) => ({ userId: u.id, category: 'ANNOUNCEMENT' as const, titleMn: a.titleMn, bodyMn: a.bodyMn, titleEn: a.titleEn, bodyEn: a.bodyEn, data: { announcementId: a.id } })),
      });
      recipients += users.length;
      cursor = users[users.length - 1].id;
    }
    await this.prisma.announcement.update({ where: { id }, data: { recipients } });
    this.logger.log(`Announcement ${id} sent to ${recipients} users`);
    return { recipients };
  }

  async sendDue() {
    const due = await this.prisma.announcement.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } } });
    for (const a of due) {
      try {
        await this.send(a.id);
      } catch (e) {
        this.logger.warn(`scheduled announcement ${a.id}: ${(e as Error).message}`);
      }
    }
    return due.length;
  }
}
