import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { formatDateTime, formatMNT } from '@orgil/shared';
import type { Response } from 'express';
import { CurrentUser, UserAuthGuard, type UserPrincipal } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { PdfService } from './pdf.service';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(UserAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}

  @Get('receipts/:id')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Payment receipt (PDF)' })
  async receipt(@CurrentUser() u: UserPrincipal, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const r = await this.prisma.loanRepayment.findFirst({ where: { id, userId: u.userId }, include: { loan: true, user: { include: { profile: true } } } });
    if (!r) throw new NotFoundException();
    const buf = await this.pdf.render((doc, h) => {
      h.header('ТӨЛБӨРИЙН БАРИМТ', r.receiptNo);
      if (r.sandbox) h.banner('ТУРШИЛТЫН ОРЧИН — бодит мөнгөн гүйлгээ биш / SANDBOX — not a real-money payment');
      h.kv([
        ['Баримтын дугаар', r.receiptNo],
        ['Огноо', formatDateTime(r.paidAt)],
        ['Зээлдэгч', `${r.user.profile?.lastName ?? ''} ${r.user.profile?.firstName ?? ''}`.trim() || r.user.phone],
        ['Зээлийн дугаар', r.loan.loanNo],
        ['Төлбөрийн хэрэгсэл', r.provider],
        ['Төлсөн дүн', formatMNT(r.amount.toFixed(2), { decimals: 2 })],
      ]);
      h.section('Хуваарилалт');
      h.kv([
        ['Үндсэн зээл', formatMNT(r.principalPart.toFixed(2), { decimals: 2 })],
        ['Хүү', formatMNT(r.interestPart.toFixed(2), { decimals: 2 })],
        ['Шимтгэл', formatMNT(r.feePart.toFixed(2), { decimals: 2 })],
        ['Алданги', formatMNT(r.penaltyPart.toFixed(2), { decimals: 2 })],
        ...(r.interestWaived.gt(0) ? [['Чөлөөлсөн хүү', formatMNT(r.interestWaived.toFixed(2), { decimals: 2 })] as [string, string]] : []),
        ['Үндсэн зээлийн үлдэгдэл', formatMNT(r.loan.outstandingPrincipal.toFixed(2), { decimals: 2 })],
      ]);
      h.footer('Энэхүү баримт нь Оргил системээс автоматаар үүссэн болно.');
      void doc;
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${r.receiptNo}.pdf"`);
    res.send(buf);
  }

  @Get('contracts/:applicationId')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Accepted loan agreement (PDF) with acceptance evidence' })
  async contract(@CurrentUser() u: UserPrincipal, @Param('applicationId', ParseUUIDPipe) applicationId: string, @Res() res: Response) {
    const c = await this.prisma.digitalContract.findFirst({ where: { applicationId, userId: u.userId }, include: { application: true } });
    if (!c) throw new NotFoundException();
    const buf = await this.pdf.render((_doc, h) => {
      h.header('ЗЭЭЛИЙН ГЭРЭЭ', c.application.applicationNo);
      h.paragraph(c.body);
      h.section('Зөвшөөрлийн нотолгоо');
      h.kv([
        ['Зөвшөөрсөн огноо', c.acceptedAt ? formatDateTime(c.acceptedAt) : '—'],
        ['Арга', c.signatureMethod],
        ['IP хаяг', c.acceptedIp ?? '—'],
        ['SHA-256', c.contentHash],
      ]);
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="contract-${c.application.applicationNo}.pdf"`);
    res.send(buf);
  }
}
