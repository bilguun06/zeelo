import {
  CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { env } from '../config/env';
import { CacheService } from './cache.service';
import { PrismaService } from './prisma.service';

export interface UserPrincipal { userId: string; sessionId: string }
export interface AdminPrincipal { adminId: string; email: string; role: string; permissions: string[] }

type AuthedRequest = Request & { user?: UserPrincipal; admin?: AdminPrincipal };

function bearer(req: Request): string {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new UnauthorizedException({ message: 'Missing bearer token', code: 'AUTH_REQUIRED' });
  return token;
}

/** Customer (mobile) access tokens. Short-lived JWT bound to a revocable session. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly cache: CacheService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    let payload: { sub: string; sid: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(bearer(req), { secret: env().JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    }
    if (payload.typ !== 'user') throw new UnauthorizedException({ message: 'Wrong token type', code: 'TOKEN_INVALID' });

    // Session revocation check (cached briefly to avoid a DB hit per request).
    const key = `sess:ok:${payload.sid}`;
    if (!(await this.cache.get<boolean>(key))) {
      const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid }, include: { user: { select: { status: true } } } });
      if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') {
        throw new UnauthorizedException({ message: 'Session expired', code: 'SESSION_EXPIRED' });
      }
      await this.cache.set(key, true, 60);
    }
    req.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}

export const PERMISSIONS_KEY = 'permissions';
/** Requires ALL listed permissions. */
export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

/** Admin dashboard tokens with role-based permission checks (re-read from DB, cached 60s). */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    let payload: { sub: string; typ: string };
    try {
      payload = await this.jwt.verifyAsync(bearer(req), { secret: env().JWT_ADMIN_SECRET });
    } catch {
      throw new UnauthorizedException({ message: 'Invalid or expired token', code: 'TOKEN_INVALID' });
    }
    if (payload.typ !== 'admin') throw new UnauthorizedException({ message: 'Wrong token type', code: 'TOKEN_INVALID' });

    const cacheKey = `admin:principal:${payload.sub}`;
    let principal = await this.cache.get<AdminPrincipal>(cacheKey);
    if (!principal) {
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!admin || admin.status !== 'ACTIVE') throw new UnauthorizedException({ message: 'Account disabled', code: 'ACCOUNT_DISABLED' });
      principal = { adminId: admin.id, email: admin.email, role: admin.role.name, permissions: admin.role.permissions.map((p) => p.permission.key) };
      await this.cache.set(cacheKey, principal, 60);
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const missing = required.filter((p) => !principal!.permissions.includes(p));
    if (missing.length) throw new ForbiddenException({ message: `Missing permission: ${missing.join(', ')}`, code: 'FORBIDDEN' });
    req.admin = principal;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserPrincipal => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminPrincipal => {
  const admin = ctx.switchToHttp().getRequest<AuthedRequest>().admin;
  if (!admin) throw new UnauthorizedException();
  return admin;
});

export const ALL_PERMISSIONS: Record<string, string> = {
  'users.read': 'View customers',
  'users.write': 'Change customer status',
  'kyc.review': 'Review identity documents',
  'applications.read': 'View loan applications',
  'applications.decide': 'Approve / reject / request info',
  'loans.read': 'View loans and schedules',
  'loans.disburse': 'Disburse approved loans',
  'products.read': 'View loan products',
  'products.write': 'Configure loan products & pricing',
  'reports.read': 'View financial reports',
  'reports.export': 'Export reports (Excel/PDF)',
  'notifications.write': 'Send announcements, edit templates',
  'admins.manage': 'Manage admin accounts and roles',
  'settings.write': 'Change system configuration',
  'audit.read': 'View audit logs',
};
