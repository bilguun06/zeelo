import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';
import { IsEnum, IsUUID, Matches } from 'class-validator';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PaymentsService } from './payments.service';

export class CreateIntentDto {
  @ApiProperty() @IsUUID()
  loanId: string;

  @ApiProperty({ example: '200924.17' }) @Matches(/^\d{1,13}(\.\d{1,2})?$/)
  amount: string;

  @ApiProperty({ enum: PaymentProvider }) @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Payment methods and whether each is configured' })
  providers() {
    return this.payments.availableProviders();
  }

  @Post('intents')
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Client-generated unique key (16–80 chars). Retries with the same key return the same intent.' })
  create(@CurrentUser() u: UserPrincipal, @Body() dto: CreateIntentDto, @Headers('idempotency-key') key: string) {
    return this.payments.createIntent(u.userId, dto, key);
  }

  @Get('intents/:id')
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @ApiOperation({ summary: 'Get intent status (verifies with provider while pending)' })
  get(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.getForUser(u.userId, id);
  }

  @Post('intents/:id/sandbox-confirm')
  @ApiBearerAuth()
  @UseGuards(UserAuthGuard)
  @ApiOperation({ summary: 'DEVELOPMENT ONLY — confirm a sandbox invoice (no real money). Disabled in production.' })
  sandboxConfirm(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.sandboxConfirm(u.userId, id);
  }

  @Post('callbacks/:provider')
  @HttpCode(200)
  @SkipThrottle()
  @ApiOperation({ summary: 'Provider webhook. Triggers server-side verification; body is never trusted.' })
  callback(@Param('provider') provider: string, @Query('intent') intent: string, @Query('sig') sig: string, @Body() body: unknown) {
    return this.payments.handleCallback(provider.toUpperCase() as PaymentProvider, intent, sig, body);
  }

  @Get('callbacks/:provider')
  @SkipThrottle()
  @ApiOperation({ summary: 'GET variant for providers that call back with query parameters only' })
  callbackGet(@Param('provider') provider: string, @Query('intent') intent: string, @Query('sig') sig: string) {
    return this.payments.handleCallback(provider.toUpperCase() as PaymentProvider, intent, sig, { method: 'GET' });
  }
}
