import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AdminStatus, Prisma } from '@prisma/client';
import { IsArray, IsDefined, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { AuditService } from '../../common/audit.service';
import { ALL_PERMISSIONS, AdminAuthGuard, CurrentAdmin, RequirePermissions, type AdminPrincipal } from '../../common/auth';
import { CacheService } from '../../common/cache.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { iso, paginate } from '../../common/serialize';
import { SETTING_DEFAULTS, SettingsService, type SettingKey } from '../../common/settings.service';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

class CreateAdminDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiProperty({ description: '12+ chars, upper, lower, digit, symbol' }) @Matches(STRONG_PASSWORD, { message: 'Password must be 12+ chars with upper, lower, digit and symbol' }) password: string;
  @ApiProperty() @IsUUID() roleId: string;
}
class UpdateAdminDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() roleId?: string;
  @ApiPropertyOptional({ enum: AdminStatus }) @IsOptional() @IsEnum(AdminStatus) status?: AdminStatus;
  @ApiPropertyOptional() @IsOptional() @Matches(STRONG_PASSWORD) password?: string;
}
class RoleDto {
  @ApiProperty() @Matches(/^[A-Z_]{3,60}$/) name: string;
  @ApiProperty() @IsString() @MaxLength(255) description: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) permissions: string[];
}
class SettingDto {
  @ApiProperty() @IsDefined() value: unknown;
}

@ApiTags('Admin · Settings')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  // ── Admin accounts ──
  @Get('admins')
  @RequirePermissions('admins.manage')
  async admins() {
    const rows = await this.prisma.adminUser.findMany({ include: { role: true }, orderBy: { createdAt: 'asc' } });
    return rows.map((a) => ({ id: a.id, email: a.email, name: a.name, role: a.role.name, roleId: a.roleId, status: a.status, mfaEnabled: a.mfaEnabled, lastLoginAt: iso(a.lastLoginAt), createdAt: a.createdAt.toISOString() }));
  }

  @Post('admins')
  @RequirePermissions('admins.manage')
  async createAdmin(@Body() dto: CreateAdminDto, @CurrentAdmin() me: AdminPrincipal) {
    const a = await this.prisma.adminUser.create({ data: { email: dto.email.toLowerCase(), name: dto.name, roleId: dto.roleId, passwordHash: await this.crypto.hashPassword(dto.password) } });
    await this.audit.log({ actorType: 'ADMIN', actorId: me.adminId, action: 'admin.created', entityType: 'AdminUser', entityId: a.id, after: { email: a.email, roleId: a.roleId } });
    return { id: a.id };
  }

  @Patch('admins/:id')
  @RequirePermissions('admins.manage')
  async updateAdmin(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminDto, @CurrentAdmin() me: AdminPrincipal) {
    if (id === me.adminId && (dto.status === 'DISABLED' || dto.roleId)) throw new UnprocessableEntityException({ message: 'You cannot change your own role or disable yourself', code: 'SELF_CHANGE' });
    const before = await this.prisma.adminUser.findUniqueOrThrow({ where: { id }, select: { roleId: true, status: true } });
    await this.prisma.adminUser.update({
      where: { id },
      data: { roleId: dto.roleId, status: dto.status, ...(dto.password ? { passwordHash: await this.crypto.hashPassword(dto.password) } : {}) },
    });
    await this.cache.del(`admin:principal:${id}`);
    await this.audit.log({ actorType: 'ADMIN', actorId: me.adminId, action: 'admin.updated', entityType: 'AdminUser', entityId: id, before, after: { roleId: dto.roleId, status: dto.status, passwordChanged: Boolean(dto.password) } });
    return { ok: true };
  }

  // ── Roles & permissions ──
  @Get('roles')
  @RequirePermissions('admins.manage')
  async roles() {
    const rows = await this.prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { admins: true } } }, orderBy: { name: 'asc' } });
    return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, admins: r._count.admins, permissions: r.permissions.map((p) => p.permission.key) }));
  }

  @Get('permissions')
  @RequirePermissions('admins.manage')
  permissions() {
    return Object.entries(ALL_PERMISSIONS).map(([key, description]) => ({ key, description }));
  }

  @Post('roles')
  @RequirePermissions('admins.manage')
  async createRole(@Body() dto: RoleDto, @CurrentAdmin() me: AdminPrincipal) {
    const perms = await this.prisma.permission.findMany({ where: { key: { in: dto.permissions } } });
    const r = await this.prisma.role.create({ data: { name: dto.name, description: dto.description, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } } });
    await this.audit.log({ actorType: 'ADMIN', actorId: me.adminId, action: 'role.created', entityType: 'Role', entityId: r.id, after: dto });
    return { id: r.id };
  }

  @Put('roles/:id')
  @RequirePermissions('admins.manage')
  async updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleDto, @CurrentAdmin() me: AdminPrincipal) {
    const role = await this.prisma.role.findUnique({ where: { id }, include: { permissions: { include: { permission: true } }, admins: { select: { id: true } } } });
    if (!role) throw new NotFoundException();
    if (role.isSystem && role.name === 'SUPER_ADMIN') throw new UnprocessableEntityException({ message: 'SUPER_ADMIN role is immutable', code: 'SYSTEM_ROLE' });
    const perms = await this.prisma.permission.findMany({ where: { key: { in: dto.permissions } } });
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.role.update({ where: { id }, data: { name: role.isSystem ? role.name : dto.name, description: dto.description, permissions: { create: perms.map((p) => ({ permissionId: p.id })) } } }),
    ]);
    await Promise.all(role.admins.map((a) => this.cache.del(`admin:principal:${a.id}`)));
    await this.audit.log({ actorType: 'ADMIN', actorId: me.adminId, action: 'role.updated', entityType: 'Role', entityId: id, before: { permissions: role.permissions.map((p) => p.permission.key) }, after: { permissions: dto.permissions } });
    return { ok: true };
  }

  // ── System settings ──
  @Get('settings')
  @RequirePermissions('settings.write')
  allSettings() {
    return this.settings.all();
  }

  @Put('settings/:key')
  @RequirePermissions('settings.write')
  async setSetting(@Param('key') key: string, @Body() dto: SettingDto, @CurrentAdmin() me: AdminPrincipal) {
    if (!(key in SETTING_DEFAULTS)) throw new NotFoundException('Unknown setting');
    const k = key as SettingKey;
    const expected = typeof SETTING_DEFAULTS[k].value;
    if (typeof dto.value !== expected) throw new UnprocessableEntityException({ message: `Setting ${key} expects a ${expected}`, code: 'SETTING_TYPE' });
    if (expected === 'string' && /^(credit|loans)\./.test(key) && !/^\d+(\.\d+)?$/.test(dto.value as string)) {
      throw new UnprocessableEntityException({ message: 'Expected a decimal number string', code: 'SETTING_TYPE' });
    }
    const before = await this.settings.get(k);
    await this.settings.set(k, dto.value, me.adminId);
    await this.audit.log({ actorType: 'ADMIN', actorId: me.adminId, action: 'setting.updated', entityType: 'SystemSetting', entityId: key, before: { value: before }, after: { value: dto.value } });
    return { key, value: dto.value };
  }

  // ── Audit log ──
  @Get('audit-logs')
  @RequirePermissions('audit.read')
  async auditLogs(@Query() q: { action?: string; entityType?: string; entityId?: string; actorId?: string; from?: string; to?: string; page?: string; pageSize?: string }) {
    const { skip, take, page, pageSize } = paginate(q);
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from && !Number.isNaN(Date.parse(q.from))) createdAt.gte = new Date(q.from);
    if (q.to && !Number.isNaN(Date.parse(q.to))) createdAt.lte = new Date(q.to);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action ? { action: { contains: q.action } } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
    const [rows, total] = await Promise.all([this.prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }), this.prisma.auditLog.count({ where })]);
    const adminIds = [...new Set(rows.filter((r) => r.actorType === 'ADMIN' && r.actorId).map((r) => r.actorId!))];
    const admins = await this.prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } });
    return {
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), actorName: r.actorType === 'ADMIN' ? admins.find((a) => a.id === r.actorId)?.name ?? null : r.actorType })),
      total, page, pageSize,
    };
  }
}
