import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MONGOLIAN_BANKS } from '@orgil/shared';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { CreateBankAccountDto, UpdateEmploymentDto, UpdatePersonalDto, UpdateSettingsDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('Me')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() u: UserPrincipal) {
    return this.users.me(u.userId);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Home screen aggregate: limit, active loans, next payment, recent activity, 6-month overview' })
  dashboard(@CurrentUser() u: UserPrincipal) {
    return this.users.dashboard(u.userId);
  }

  @Put('profile/personal')
  personal(@CurrentUser() u: UserPrincipal, @Body() dto: UpdatePersonalDto) {
    return this.users.updatePersonal(u.userId, dto);
  }

  @Put('profile/employment')
  employment(@CurrentUser() u: UserPrincipal, @Body() dto: UpdateEmploymentDto) {
    return this.users.updateEmployment(u.userId, dto);
  }

  @Patch('settings')
  settings(@CurrentUser() u: UserPrincipal, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(u.userId, dto);
  }

  @Get('banks')
  @ApiOperation({ summary: 'Supported banks for payout accounts' })
  banks() {
    return MONGOLIAN_BANKS;
  }

  @Get('bank-accounts')
  bankAccounts(@CurrentUser() u: UserPrincipal) {
    return this.users.bankAccounts(u.userId);
  }

  @Post('bank-accounts')
  addBankAccount(@CurrentUser() u: UserPrincipal, @Body() dto: CreateBankAccountDto) {
    return this.users.addBankAccount(u.userId, dto);
  }

  @Post('bank-accounts/:id/primary')
  @HttpCode(200)
  primary(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.setPrimaryBankAccount(u.userId, id);
  }

  @Delete('bank-accounts/:id')
  @HttpCode(204)
  removeBankAccount(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.removeBankAccount(u.userId, id);
  }

  @Get('sessions')
  sessions(@CurrentUser() u: UserPrincipal) {
    return this.users.sessions(u.userId, u.sessionId);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revoke(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.revokeSession(u.userId, id);
  }
}
