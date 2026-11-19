import { Injectable } from '@nestjs/common';
import type { LoanProduct, UserProfile } from '@prisma/client';
import { formatDate, formatMNT, formatPercent, type QuoteDto } from '@orgil/shared';
import { CryptoService } from '../../common/crypto.service';
import { SettingsService } from '../../common/settings.service';

/**
 * Generates the loan agreement text shown to (and accepted by) the customer.
 * The template is a DRAFT STRUCTURE for development — the provider's legal counsel must supply
 * the binding wording in line with the Civil Code, the Law on Non-Bank Financial Activities,
 * consumer-protection and electronic-signature/transaction requirements.
 */
@Injectable()
export class ContractService {
  constructor(private readonly crypto: CryptoService, private readonly settings: SettingsService) {}

  async render(input: { profile: UserProfile; phone: string; product: LoanProduct; quote: QuoteDto; bankLabel: string }) {
    const { profile, product, quote } = input;
    const templateVersion = String(await this.settings.get<string>('contract.template_version'));
    const today = formatDate(new Date());
    const methodMn = { ANNUITY: 'тэнцүү төлөлттэй', EQUAL_PRINCIPAL: 'үндсэн зээл тэнцүү', BULLET: 'хугацааны эцэст нэг удаа' }[product.repaymentMethod];
    const feeMn = product.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT' ? 'зээл олгох үед олгох дүнгээс суутгана' : 'эхний төлөлтөд нэмж төлнө';

    const body = [
      `ЗЭЭЛИЙН ГЭРЭЭ (НӨХЦӨЛИЙН ТОВЧ) — загвар ${templateVersion}`,
      `[ХӨГЖҮҮЛЭЛТИЙН ЗАГВАР — хуулийн зөвлөхөөр баталгаажуулаагүй]`,
      ``,
      `Огноо: ${today}`,
      `Зээлдэгч: ${profile.lastName ?? ''} ${profile.firstName ?? ''}, РД ••••••${profile.registerNumberLast4 ?? ''}, утас ${input.phone}`,
      `Зээлийн бүтээгдэхүүн: ${product.nameMn} (${product.code})`,
      ``,
      `1. Зээлийн хэмжээ: ${formatMNT(quote.principal)}`,
      `2. Хугацаа: ${quote.termMonths} сар, ${methodMn} хуваарийн дагуу`,
      `3. Хүү: сарын ${formatPercent(quote.monthlyInterestRate)} (жилийн бодит өртөг APR ${formatPercent(quote.apr)})`,
      `4. Үйлчилгээний шимтгэл: ${formatMNT(quote.serviceFee)} — ${feeMn}`,
      `5. Зээлдэгчид олгох дүн: ${formatMNT(quote.netDisbursement)} → ${input.bankLabel}`,
      `6. Нийт төлөх дүн: ${formatMNT(quote.totalRepayment)} (хүү ${formatMNT(quote.totalInterest)})`,
      `7. Сарын төлөлт: ${formatMNT(quote.monthlyPayment)}; эхний төлөлт ${formatDate(quote.schedule[0].dueDate)}`,
      `8. Хугацаа хэтэрсэн тохиолдолд: хэтэрсэн дүнд өдрийн ${formatPercent(product.penaltyRateDaily.toString(), 4)} алданги, тогтоосон дээд хязгаарын хүрээнд`,
      `9. Хугацаанаас өмнө төлөх: зээлдэгч хүссэн үедээ торгуульгүйгээр бүрэн төлж болно; ирээдүйн хүүг тооцохгүй.`,
      `10. Мэдээлэл боловсруулах: зээлдэгч өөрийн мэдээллийг зээлийн шийдвэр гаргах, эрсдэлийн үнэлгээ хийх зорилгоор боловсруулахыг зөвшөөрнө.`,
      `11. Шийдвэр: зээлийн эцсийн шийдвэрийг зээлийн ажилтан гаргана. Татгалзсан тохиолдолд шалтгааныг мэдэгдэнэ.`,
      `12. Гомдол: ${await this.settings.get<string>('support.phone')} утсаар эсвэл апп-аар дамжуулан гаргана.`,
      ``,
      `Төлөлтийн хуваарь (огноо нь зээл олгосон өдрөөс эхэлж тооцогдоно):`,
      ...quote.schedule.map((s) => `  ${s.installmentNo}. ${formatDate(s.dueDate)} — ${formatMNT(s.payment)} (үндсэн ${formatMNT(s.principal)}, хүү ${formatMNT(s.interest)})`),
    ].join('\n');

    return { templateVersion, body, contentHash: this.crypto.sha256(body) };
  }
}
