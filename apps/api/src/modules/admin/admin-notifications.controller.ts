import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AnnouncementAudience, NotificationCategory } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { DEFAULT_TEMPLATES } from '../notifications/notifications.service';
import { AnnouncementsService } from './announcements.service';

class TemplateDto {
  @ApiProperty({ enum: NotificationCategory }) @IsEnum(NotificationCategory) category: NotificationCategory;
  @ApiProperty() @IsString() @Length(2, 120) titleMn: string;
  @ApiProperty() @IsString() @Length(2, 1000) bodyMn: string;
  @ApiProperty() @IsString() @Length(2, 120) titleEn: string;
  @ApiProperty() @IsString() @Length(2, 1000) bodyEn: string;
}

class AnnouncementDto {
  @ApiProperty() @IsString() @Length(2, 120) titleMn: string;
  @ApiProperty() @IsString() @Length(2, 1000) bodyMn: string;
  @ApiProperty() @IsString() @Length(2, 120) titleEn: string;
  @ApiProperty() @IsString() @Length(2, 1000) bodyEn: string;
  @ApiProperty({ enum: AnnouncementAudience }) @IsEnum(AnnouncementAudience) audience: AnnouncementAudience;
  @ApiPropertyOptional({ description: 'ISO datetime. Omit to keep as draft.' }) @IsOptional() @IsISO8601() scheduledAt?: string;
}

@ApiTags('Admin · Notifications')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly prisma: PrismaService, private readonly announcements: AnnouncementsService, private readonly audit: AuditService) {}

  @Get('templates')
  @RequirePermissions('notifications.write')
  async templates() {
    const custom = await this.prisma.notificationTemplate.findMany();
    return Object.entries(DEFAULT_TEMPLATES).map(([code, def]) => {
      const c = custom.find((t) => t.code === code);
      return { code, isCustom: Boolean(c), category: c?.category ?? def.category, titleMn: c?.titleMn ?? def.titleMn, bodyMn: c?.bodyMn ?? def.bodyMn, titleEn: c?.titleEn ?? def.titleEn, bodyEn: c?.bodyEn ?? def.bodyEn, variables: [...new Set((def.bodyMn + def.titleMn).match(/\{\{\w+\}\}/g) ?? [])] };
    });
  }

  @Put('templates/:code')
  @RequirePermissions('notifications.write')
  async upsertTemplate(@Param('code') code: string, @Body() dto: TemplateDto, @CurrentAdmin() a: AdminPrincipal) {
    if (!(code in DEFAULT_TEMPLATES) || !/^[A-Z_]{3,40}$/.test(code)) throw new UnprocessableEntityException({ message: 'Unknown template code', code: 'TEMPLATE_UNKNOWN' });
    const t = await this.prisma.notificationTemplate.upsert({ where: { code }, create: { code, ...dto }, update: dto });
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'notification_template.updated', entityType: 'NotificationTemplate', entityId: t.id, after: dto });
    return t;
  }

  @Get('announcements')
  @RequirePermissions('notifications.write')
  list() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { createdBy: { select: { name: true } } } });
  }

  @Post('announcements')
  @RequirePermissions('notifications.write')
  async create(@Body() dto: AnnouncementDto, @CurrentAdmin() a: AdminPrincipal) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt < new Date(Date.now() - 60_000)) throw new UnprocessableEntityException({ message: 'Schedule time is in the past', code: 'SCHEDULE_PAST' });
    const row = await this.prisma.announcement.create({ data: { ...dto, scheduledAt, status: scheduledAt ? 'SCHEDULED' : 'DRAFT', createdById: a.adminId } });
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'announcement.created', entityType: 'Announcement', entityId: row.id, after: dto });
    return row;
  }

  @Post('announcements/:id/send')
  @HttpCode(200)
  @RequirePermissions('notifications.write')
  async send(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() a: AdminPrincipal) {
    const r = await this.announcements.send(id);
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'announcement.sent', entityType: 'Announcement', entityId: id, after: r });
    return r;
  }

  @Post('announcements/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('notifications.write')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() a: AdminPrincipal) {
    const r = await this.prisma.announcement.updateMany({ where: { id, status: { in: ['DRAFT', 'SCHEDULED'] } }, data: { status: 'CANCELLED' } });
    if (!r.count) throw new UnprocessableEntityException({ message: 'Cannot cancel', code: 'INVALID_STATUS' });
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'announcement.cancelled', entityType: 'Announcement', entityId: id });
    return { ok: true };
  }
}
