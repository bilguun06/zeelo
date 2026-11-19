import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService, private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() u: UserPrincipal, @Query() q: { page?: string; pageSize?: string; unread?: string }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.userId }, select: { language: true } });
    return this.notifications.list(u.userId, user.language === 'en' ? 'en' : 'mn', q);
  }

  @Post('read-all')
  @HttpCode(204)
  readAll(@CurrentUser() u: UserPrincipal) {
    return this.notifications.markAllRead(u.userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  read(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(u.userId, id);
  }
}
