import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { AdminAuthGuard, UserAuthGuard } from './auth';
import { CacheService } from './cache.service';
import { CryptoService } from './crypto.service';
import { PrismaService } from './prisma.service';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [PrismaService, CryptoService, CacheService, AuditService, SettingsService, UserAuthGuard, AdminAuthGuard],
  exports: [PrismaService, CryptoService, CacheService, AuditService, SettingsService, UserAuthGuard, AdminAuthGuard, JwtModule],
})
export class CommonModule {}
