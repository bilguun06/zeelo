import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { authenticator } from 'otplib';
import { env } from '../../config/env';
import { AuditService } from '../../common/audit.service';
import { AdminAuthGuard, CurrentAdmin, type AdminPrincipal } from '../../common/auth';
import { CacheService } from '../../common/cache.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';

class AdminLoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @Length(1, 128) password: string;
}
class MfaVerifyDto {
  @ApiProperty() @IsString() @Length(20, 100) mfaToken: string;
  @ApiProperty() @Matches(/^\d{6}$/) code: string;
}
class MfaCodeDto {
  @ApiProperty() @Matches(/^\d{6}$/) code: string;
}

authenticator.options = { window: 1 };

@ApiTags('Admin · Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly cache: CacheService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async session(adminId: string) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: adminId }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
    await this.audit.log({ actorType: 'ADMIN', actorId: adminId, action: 'admin.login', entityType: 'AdminUser', entityId: adminId });
    return {
      accessToken: await this.jwt.signAsync({ sub: admin.id, typ: 'admin' }, { secret: env().JWT_ADMIN_SECRET, expiresIn: env().ADMIN_TOKEN_TTL_SECONDS }),
      expiresIn: env().ADMIN_TOKEN_TTL_SECONDS,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role.name, mfaEnabled: admin.mfaEnabled, permissions: admin.role.permissions.map((p) => p.permission.key) },
    };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email.toLowerCase() } });
    const generic = new UnauthorizedException({ message: 'Invalid email or password', code: 'BAD_CREDENTIALS' });
    if (!admin) {
      await this.crypto.hashPassword(dto.password);
      throw generic;
    }
    if (admin.lockedUntil && admin.lockedUntil > new Date()) throw new HttpException({ message: 'Account locked. Try later.', code: 'ACCOUNT_LOCKED' }, 423);
    if (admin.status !== 'ACTIVE') throw generic;
    if (!(await this.crypto.verifyPassword(dto.password, admin.passwordHash))) {
      const n = admin.failedLoginCount + 1;
      await this.prisma.adminUser.update({ where: { id: admin.id }, data: { failedLoginCount: n >= 5 ? 0 : n, lockedUntil: n >= 5 ? new Date(Date.now() + 30 * 60_000) : null } });
      await this.audit.log({ actorType: 'ADMIN', actorId: admin.id, action: 'admin.login_failed', entityType: 'AdminUser', entityId: admin.id });
      throw generic;
    }
    if (admin.mfaEnabled) {
      const mfaToken = this.crypto.token(24);
      await this.cache.set(`admin:mfa:${mfaToken}`, { adminId: admin.id, attempts: 0 }, 300);
      return { mfaRequired: true, mfaToken };
    }
    return { mfaRequired: false, ...(await this.session(admin.id)) };
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: MfaVerifyDto) {
    const key = `admin:mfa:${dto.mfaToken}`;
    const pending = await this.cache.get<{ adminId: string; attempts: number }>(key);
    if (!pending || pending.attempts >= 5) throw new UnauthorizedException({ message: 'MFA session expired', code: 'MFA_EXPIRED' });
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: pending.adminId } });
    if (!admin.mfaSecretEnc || !authenticator.check(dto.code, this.crypto.decrypt(admin.mfaSecretEnc))) {
      await this.cache.set(key, { ...pending, attempts: pending.attempts + 1 }, 300);
      throw new UnauthorizedException({ message: 'Invalid code', code: 'MFA_INVALID' });
    }
    await this.cache.del(key);
    return { mfaRequired: false, ...(await this.session(admin.id)) };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async me(@CurrentAdmin() a: AdminPrincipal) {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({ where: { id: a.adminId } });
    return { id: admin.id, email: admin.email, name: admin.name, role: a.role, permissions: a.permissions, mfaEnabled: admin.mfaEnabled };
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async setup(@CurrentAdmin() a: AdminPrincipal) {
    const secret = authenticator.generateSecret();
    await this.cache.set(`admin:mfa-setup:${a.adminId}`, this.crypto.encrypt(secret), 600);
    return { otpauthUrl: authenticator.keyuri(a.email, 'Orgil Admin', secret), secret };
  }

  @Post('mfa/enable')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async enable(@CurrentAdmin() a: AdminPrincipal, @Body() dto: MfaCodeDto) {
    const enc = await this.cache.get<string>(`admin:mfa-setup:${a.adminId}`);
    if (!enc) throw new BadRequestException({ message: 'Start MFA setup first', code: 'MFA_SETUP' });
    if (!authenticator.check(dto.code, this.crypto.decrypt(enc))) throw new BadRequestException({ message: 'Invalid code', code: 'MFA_INVALID' });
    await this.prisma.adminUser.update({ where: { id: a.adminId }, data: { mfaEnabled: true, mfaSecretEnc: enc } });
    await this.cache.del(`admin:mfa-setup:${a.adminId}`);
    await this.audit.log({ actorType: 'ADMIN', actorId: a.adminId, action: 'admin.mfa_enabled', entityType: 'AdminUser', entityId: a.adminId });
    return { mfaEnabled: true };
  }
}
