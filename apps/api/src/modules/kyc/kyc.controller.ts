import {
  BadRequestException, Body, Controller, Get, HttpCode, Post, UnprocessableEntityException, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { memoryStorage } from 'multer';
import { env } from '../../config/env';
import { AuditService } from '../../common/audit.service';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from './storage.service';

const REQUIRED: DocumentType[] = ['ID_FRONT', 'ID_BACK', 'SELFIE'];

@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService, private readonly audit: AuditService) {}

  @Get('status')
  async status(@CurrentUser() u: UserPrincipal) {
    const [profile, docs] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId: u.userId }, select: { kycStatus: true, kycVerifiedAt: true } }),
      this.prisma.userDocument.findMany({ where: { userId: u.userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const latest = (t: DocumentType) => docs.find((d) => d.type === t);
    return {
      status: profile?.kycStatus ?? 'NOT_STARTED',
      verifiedAt: profile?.kycVerifiedAt ?? null,
      documents: REQUIRED.map((t) => ({ type: t, uploaded: Boolean(latest(t)), status: latest(t)?.status ?? null, reviewNote: latest(t)?.reviewNote ?? null })),
    };
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { type: { type: 'string', enum: Object.values(DocumentType) }, file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload an identity document (JPEG/PNG/PDF, verified by magic bytes, encrypted at rest)' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: env().MAX_UPLOAD_MB * 1024 * 1024, files: 1 } }))
  async upload(@CurrentUser() u: UserPrincipal, @Body('type') type: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException({ message: 'file is required', code: 'FILE_REQUIRED' });
    if (!(type in DocumentType)) throw new BadRequestException({ message: 'Invalid document type', code: 'DOC_TYPE' });
    const profile = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId: u.userId } });
    if (profile.kycStatus === 'VERIFIED' && REQUIRED.includes(type as DocumentType)) {
      throw new UnprocessableEntityException({ message: 'Identity already verified', code: 'KYC_VERIFIED' });
    }
    const stored = await this.storage.put(file.buffer);
    const doc = await this.prisma.userDocument.create({
      data: { userId: u.userId, type: type as DocumentType, storageKey: stored.key, mimeType: stored.mime, sizeBytes: stored.size, sha256: stored.sha256 },
    });
    await this.audit.log({ actorType: 'USER', actorId: u.userId, action: 'kyc.document_uploaded', entityType: 'UserDocument', entityId: doc.id, after: { type, size: stored.size } });
    return { id: doc.id, type: doc.type, status: doc.status, createdAt: doc.createdAt };
  }

  @Post('submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'Submit uploaded documents for manual review. (Integration point: state registry / e-Mongolia verification.)' })
  async submit(@CurrentUser() u: UserPrincipal) {
    const docs = await this.prisma.userDocument.findMany({ where: { userId: u.userId, type: { in: REQUIRED } }, select: { type: true } });
    const missing = REQUIRED.filter((t) => !docs.some((d) => d.type === t));
    if (missing.length) throw new UnprocessableEntityException({ message: `Missing documents: ${missing.join(', ')}`, code: 'KYC_INCOMPLETE', missing });
    const profile = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId: u.userId } });
    if (!profile.registerNumberEnc || !profile.firstName) throw new UnprocessableEntityException({ message: 'Complete personal information first', code: 'PROFILE_INCOMPLETE' });
    if (profile.kycStatus !== 'VERIFIED') await this.prisma.userProfile.update({ where: { userId: u.userId }, data: { kycStatus: 'PENDING' } });
    return { status: profile.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING' };
  }
}
