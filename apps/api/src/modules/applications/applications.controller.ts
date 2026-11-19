import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Equals, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { ApplicationsService } from './applications.service';

export class ApplicationTermsDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty({ example: '2000000.00' }) @Matches(/^\d{1,13}(\.\d{1,2})?$/) amount: string;
  @ApiProperty({ example: 12 }) @IsInt() @Min(1) @Max(120) termMonths: number;
  @ApiProperty() @IsUUID() bankAccountId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) purpose?: string;
}

export class SubmitApplicationDto extends ApplicationTermsDto {
  @ApiProperty({ description: 'contentHash returned by /applications/preview — proves which terms were accepted' }) @Matches(/^[a-f0-9]{64}$/) contractHash: string;
  @ApiProperty() @Equals(true) acceptTerms: boolean;
  @ApiProperty() @Equals(true) consentDataProcessing: boolean;
}

export class RespondDto {
  @ApiProperty() @IsString() @Length(2, 1000) message: string;
}

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Final terms, schedule and agreement text to review before submitting' })
  preview(@CurrentUser() u: UserPrincipal, @Body() dto: ApplicationTermsDto) {
    return this.apps.preview(u.userId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Submit application with accepted agreement. Scored automatically, decided by a human.' })
  submit(@CurrentUser() u: UserPrincipal, @Body() dto: SubmitApplicationDto) {
    return this.apps.submit(u.userId, dto);
  }

  @Get()
  list(@CurrentUser() u: UserPrincipal) {
    return this.apps.listForUser(u.userId);
  }

  @Get(':id')
  get(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.getForUser(u.userId, id);
  }

  @Get(':id/contract')
  contract(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.contractForUser(u.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.cancel(u.userId, id);
  }

  @Post(':id/respond')
  @HttpCode(200)
  respond(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondDto) {
    return this.apps.respond(u.userId, id, dto.message);
  }
}
