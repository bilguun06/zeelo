import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokens } from '@orgil/shared';
import { env } from '../../config/env';
import { AuditService } from '../../common/audit.service';
import { CacheService } from '../../common/cache.service';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { requestContext } from '../../common/request-context';
import { SmsService } from './sms.provider';

type OtpPurpose = 'REGISTER' | 'RESET_PASSWORD';
const OTP_TTL = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN = 60;
const OTP_HOURLY_LIMIT = 5;
const LOGIN_MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly cache: CacheService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
  ) {}

  async requestOtp(phone: string, purpose: OtpPurpose): Promise<{ sent: true; cooldownSeconds: number; devCode?: string }> {
    if (await this.cache.get(`otp:cooldown:${phone}`)) {
      throw new HttpException({ message: 'Please wait before requesting another code', code: 'OTP_COOLDOWN' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if ((await this.cache.incr(`otp:hourly:${phone}`, 3600)) > OTP_HOURLY_LIMIT) {
      throw new HttpException({ message: 'Too many codes requested. Try again later.', code: 'OTP_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const existing = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (purpose === 'REGISTER' && existing) throw new ConflictException({ message: 'Phone already registered', code: 'PHONE_TAKEN' });

    await this.cache.set(`otp:cooldown:${phone}`, true, OTP_COOLDOWN);
    // For password reset on an unknown number, respond identically without sending (prevents enumeration).
    if (purpose === 'RESET_PASSWORD' && !existing) return { sent: true, cooldownSeconds: OTP_COOLDOWN };

    const code = this.crypto.otp();
    await this.cache.set(`otp:${purpose}:${phone}`, { hash: this.crypto.sha256(`${phone}:${code}`), attempts: 0 }, OTP_TTL);
    await this.sms.send(phone, `Orgil: Tany batalgaajuulah kod ${code}. Hen ch bitgii heleerei.`);
    return { sent: true, cooldownSeconds: OTP_COOLDOWN, ...(env().OTP_DEV_ECHO ? { devCode: code } : {}) };
  }

  async verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<{ verificationToken: string }> {
    const key = `otp:${purpose}:${phone}`;
    const entry = await this.cache.get<{ hash: string; attempts: number }>(key);
    if (!entry) throw new BadRequestException({ message: 'Code expired. Request a new one.', code: 'OTP_EXPIRED' });
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      await this.cache.del(key);
      throw new BadRequestException({ message: 'Too many attempts. Request a new code.', code: 'OTP_LOCKED' });
    }
    if (!this.crypto.safeEqual(entry.hash, this.crypto.sha256(`${phone}:${code}`))) {
      await this.cache.set(key, { ...entry, attempts: entry.attempts + 1 }, OTP_TTL);
      throw new BadRequestException({ message: 'Incorrect code', code: 'OTP_INVALID' });
    }
    await this.cache.del(key);
    const verificationToken = this.crypto.token(24);
    await this.cache.set(`otpv:${verificationToken}`, { phone, purpose }, 600);
    return { verificationToken };
  }

  private async consumeVerification(token: string, purpose: OtpPurpose): Promise<string> {
    const v = await this.cache.get<{ phone: string; purpose: OtpPurpose }>(`otpv:${token}`);
    if (!v || v.purpose !== purpose) throw new BadRequestException({ message: 'Verification expired. Start again.', code: 'VERIFICATION_EXPIRED' });
    await this.cache.del(`otpv:${token}`);
    return v.phone;
  }

  async register(verificationToken: string, password: string, deviceName?: string): Promise<AuthTokens> {
    const phone = await this.consumeVerification(verificationToken, 'REGISTER');
    const passwordHash = await this.crypto.hashPassword(password);
    const user = await this.prisma.user.create({
      data: { phone, passwordHash, phoneVerifiedAt: new Date(), profile: { create: {} } },
    });
    await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'user.register', entityType: 'User', entityId: user.id });
    return this.issueTokens(user.id, deviceName);
  }

  async login(phone: string, password: string, deviceName?: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    const generic = new UnauthorizedException({ message: 'Incorrect phone number or password', code: 'BAD_CREDENTIALS' });
    if (!user) {
      await this.crypto.hashPassword(password); // equalise timing
      throw generic;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException({ message: 'Account temporarily locked after failed attempts', code: 'ACCOUNT_LOCKED', lockedUntil: user.lockedUntil }, 423);
    }
    if (user.status !== 'ACTIVE') throw new UnauthorizedException({ message: 'Account is not active', code: 'ACCOUNT_DISABLED' });

    if (!(await this.crypto.verifyPassword(password, user.passwordHash))) {
      const failures = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: failures >= LOGIN_MAX_FAILURES ? 0 : failures, lockedUntil: failures >= LOGIN_MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'auth.login_failed', entityType: 'User', entityId: user.id });
      throw generic;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id });
    return this.issueTokens(user.id, deviceName);
  }

  /** Rotating refresh tokens: each use invalidates the previous token. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const hash = this.crypto.sha256(refreshToken);
    const session = await this.prisma.userSession.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ message: 'Session expired', code: 'SESSION_EXPIRED' });
    }
    const next = this.crypto.token(48);
    await this.prisma.userSession.update({ where: { id: session.id }, data: { refreshTokenHash: this.crypto.sha256(next), lastUsedAt: new Date() } });
    return { accessToken: await this.signAccess(session.userId, session.id), refreshToken: next, accessTokenExpiresIn: env().ACCESS_TOKEN_TTL_SECONDS };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.cache.del(`sess:ok:${sessionId}`);
  }

  async resetPassword(verificationToken: string, password: string): Promise<void> {
    const phone = await this.consumeVerification(verificationToken, 'RESET_PASSWORD');
    const user = await this.prisma.user.update({ where: { phone }, data: { passwordHash: await this.crypto.hashPassword(password), failedLoginCount: 0, lockedUntil: null } });
    await this.revokeAll(user.id);
    await this.audit.log({ actorType: 'USER', actorId: user.id, action: 'auth.password_reset', entityType: 'User', entityId: user.id });
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.crypto.verifyPassword(current, user.passwordHash))) throw new BadRequestException({ message: 'Current password is incorrect', code: 'BAD_CREDENTIALS' });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.crypto.hashPassword(next) } });
    await this.revokeAll(userId, sessionId);
    await this.audit.log({ actorType: 'USER', actorId: userId, action: 'auth.password_changed', entityType: 'User', entityId: userId });
  }

  private async revokeAll(userId: string, exceptSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({ where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });
    await this.prisma.userSession.updateMany({ where: { id: { in: sessions.map((s) => s.id) } }, data: { revokedAt: new Date() } });
    await Promise.all(sessions.map((s) => this.cache.del(`sess:ok:${s.id}`)));
  }

  private async issueTokens(userId: string, deviceName?: string): Promise<AuthTokens> {
    const ctx = requestContext();
    const refreshToken = this.crypto.token(48);
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: this.crypto.sha256(refreshToken),
        deviceName: deviceName?.slice(0, 120),
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
        expiresAt: new Date(Date.now() + env().REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    return { accessToken: await this.signAccess(userId, session.id), refreshToken, accessTokenExpiresIn: env().ACCESS_TOKEN_TTL_SECONDS };
  }

  private signAccess(userId: string, sessionId: string) {
    return this.jwt.signAsync({ sub: userId, sid: sessionId, typ: 'user' }, { secret: env().JWT_ACCESS_SECRET, expiresIn: env().ACCESS_TOKEN_TTL_SECONDS });
  }
}
