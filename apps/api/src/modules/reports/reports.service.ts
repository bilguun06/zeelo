import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { remainingOf, sum, toMoneyString, totalOf } from '@orgil/financial-engine';
import { formatDate, formatMNT } from '@orgil/shared';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../common/prisma.service';
import { m } from '../../common/serialize';
import { PdfService } from '../documents/pdf.service';
import { toInstallmentState } from '../loans/loans.mapper';

export type ReportType = 'summary' | 'disbursements' | 'repayments' | 'overdue';
export type Granularity = 'day' | 'month' | 'year';

export interface ReportResult {
  type: ReportType;
  title: string;
  from: string;
  to: string;
  columns: { key: string; label: string; money?: boolean }[];
  rows: Record<string, string | number | boolean | null>[];
  totals: Record<string, string>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly pdf: PdfService) {}

  async overview() {
    const open = { status: { in: ['ACTIVE', 'OVERDUE'] as ('ACTIVE' | 'OVERDUE')[] } };
    const [users, activeLoans, overdueLoans, outstanding, disbursed, repaid, byStatus, grades, monthly, byProduct] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.loan.count({ where: open }),
      this.prisma.loan.count({ where: { status: 'OVERDUE' } }),
      this.prisma.loan.aggregate({ where: open, _sum: { outstandingPrincipal: true } }),
      this.prisma.loan.aggregate({ _sum: { principal: true } }),
      this.prisma.loanRepayment.aggregate({ _sum: { amount: true }, where: { sandbox: false } }),
      this.prisma.loanApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.creditScore.groupBy({ by: ['riskGrade'], _count: { _all: true } }),
      this.prisma.$queryRaw<{ month: Date; disbursed: Prisma.Decimal | null; repaid: Prisma.Decimal | null; users: bigint }[]>`
        WITH months AS (SELECT generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') AS month)
        SELECT m.month,
          (SELECT COALESCE(SUM(principal), 0) FROM loans l WHERE date_trunc('month', l."disbursedAt") = m.month) AS disbursed,
          (SELECT COALESCE(SUM(amount), 0) FROM loan_repayments r WHERE date_trunc('month', r."paidAt") = m.month) AS repaid,
          (SELECT COUNT(*) FROM users u WHERE date_trunc('month', u."createdAt") = m.month) AS users
        FROM months m ORDER BY m.month`,
      this.prisma.loan.groupBy({ by: ['productId'], where: open, _sum: { outstandingPrincipal: true }, _count: { _all: true } }),
    ]);
    const products = await this.prisma.loanProduct.findMany({ where: { id: { in: byProduct.map((b) => b.productId) } }, select: { id: true, nameMn: true } });
    const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
    const overdueSchedules = await this.prisma.loanSchedule.findMany({ where: { status: 'OVERDUE' } });
    const overdueAmount = sum(overdueSchedules.map((s) => totalOf(remainingOf(toInstallmentState(s)))));

    return {
      totalUsers: users,
      activeLoans,
      overdueLoans,
      totalOutstanding: m(outstanding._sum.outstandingPrincipal),
      totalDisbursed: m(disbursed._sum.principal),
      totalRepayments: m(repaid._sum.amount),
      overdueAmount: toMoneyString(overdueAmount),
      applications: {
        pending: count('PENDING') + count('UNDER_REVIEW') + count('INFO_REQUESTED'),
        approved: count('APPROVED') + count('DISBURSED') + count('COMPLETED'),
        rejected: count('REJECTED'),
        byStatus: byStatus.map((b) => ({ status: b.status, count: b._count._all })),
      },
      riskGrades: grades.map((g) => ({ grade: g.riskGrade, count: g._count._all })).sort((a, b) => a.grade.localeCompare(b.grade)),
      monthly: monthly.map((r) => ({ month: r.month.toISOString().slice(0, 7), disbursed: m(r.disbursed), repaid: m(r.repaid), newUsers: Number(r.users) })),
      portfolioByProduct: byProduct.map((b) => ({ product: products.find((p) => p.id === b.productId)?.nameMn ?? '—', outstanding: m(b._sum.outstandingPrincipal), loans: b._count._all })),
    };
  }

  private range(fromS?: string, toS?: string) {
    const to = toS && !Number.isNaN(Date.parse(toS)) ? new Date(toS) : new Date();
    const from = fromS && !Number.isNaN(Date.parse(fromS)) ? new Date(fromS) : new Date(to.getTime() - 30 * 86_400_000);
    to.setHours(23, 59, 59, 999);
    if (from > to) throw new BadRequestException('from must be before to');
    if (to.getTime() - from.getTime() > 5 * 366 * 86_400_000) throw new BadRequestException('Range too large (max 5 years)');
    return { from, to };
  }

  async build(type: ReportType, q: { from?: string; to?: string; granularity?: Granularity }): Promise<ReportResult> {
    const { from, to } = this.range(q.from, q.to);
    const base = { from: from.toISOString(), to: to.toISOString() };

    if (type === 'disbursements') {
      const loans = await this.prisma.loan.findMany({ where: { disbursedAt: { gte: from, lte: to } }, include: { product: true, user: { select: { phone: true } } }, orderBy: { disbursedAt: 'asc' } });
      const rows = loans.map((l) => ({
        date: formatDate(l.disbursedAt), loanNo: l.loanNo, phone: l.user.phone, product: l.product.nameMn, term: l.termMonths,
        principal: m(l.principal), fee: m(l.serviceFee), net: toMoneyString(l.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT' ? l.principal.minus(l.serviceFee).toString() : l.principal.toString()),
      }));
      return {
        ...base, type, title: 'Зээл олголтын тайлан',
        columns: [{ key: 'date', label: 'Огноо' }, { key: 'loanNo', label: 'Зээлийн №' }, { key: 'phone', label: 'Утас' }, { key: 'product', label: 'Бүтээгдэхүүн' }, { key: 'term', label: 'Хугацаа' }, { key: 'principal', label: 'Үндсэн', money: true }, { key: 'fee', label: 'Шимтгэл', money: true }, { key: 'net', label: 'Олгосон', money: true }],
        rows, totals: { principal: toMoneyString(sum(rows.map((r) => r.principal))), fee: toMoneyString(sum(rows.map((r) => r.fee))), net: toMoneyString(sum(rows.map((r) => r.net))) },
      };
    }

    if (type === 'repayments') {
      const reps = await this.prisma.loanRepayment.findMany({ where: { paidAt: { gte: from, lte: to } }, include: { loan: { select: { loanNo: true } } }, orderBy: { paidAt: 'asc' } });
      const rows = reps.map((r) => ({
        date: formatDate(r.paidAt), receiptNo: r.receiptNo, loanNo: r.loan.loanNo, provider: r.sandbox ? `${r.provider} (SANDBOX)` : r.provider,
        amount: m(r.amount), principal: m(r.principalPart), interest: m(r.interestPart), fee: m(r.feePart), penalty: m(r.penaltyPart),
      }));
      const t = (k: keyof (typeof rows)[number]) => toMoneyString(sum(rows.map((r) => r[k] as string)));
      return {
        ...base, type, title: 'Эргэн төлөлтийн тайлан',
        columns: [{ key: 'date', label: 'Огноо' }, { key: 'receiptNo', label: 'Баримт' }, { key: 'loanNo', label: 'Зээлийн №' }, { key: 'provider', label: 'Суваг' }, { key: 'amount', label: 'Дүн', money: true }, { key: 'principal', label: 'Үндсэн', money: true }, { key: 'interest', label: 'Хүү', money: true }, { key: 'fee', label: 'Шимтгэл', money: true }, { key: 'penalty', label: 'Алданги', money: true }],
        rows, totals: { amount: t('amount'), principal: t('principal'), interest: t('interest'), fee: t('fee'), penalty: t('penalty') },
      };
    }

    if (type === 'overdue') {
      const loans = await this.prisma.loan.findMany({ where: { status: 'OVERDUE' }, include: { schedule: true, product: true, user: { select: { phone: true } } } });
      const now = Date.now();
      const rows = loans.map((l) => {
        const od = l.schedule.filter((s) => s.status === 'OVERDUE');
        const oldest = od.reduce((min, s) => (s.dueDate < min ? s.dueDate : min), od[0]?.dueDate ?? new Date());
        const days = Math.floor((now - oldest.getTime()) / 86_400_000);
        return {
          loanNo: l.loanNo, phone: l.user.phone, product: l.product.nameMn, daysOverdue: days,
          bucket: days <= 30 ? '1–30' : days <= 60 ? '31–60' : days <= 90 ? '61–90' : '90+',
          overdueAmount: toMoneyString(sum(od.map((s) => totalOf(remainingOf(toInstallmentState(s)))))),
          penalty: toMoneyString(sum(od.map((s) => remainingOf(toInstallmentState(s)).penalty))),
          outstandingPrincipal: m(l.outstandingPrincipal),
        };
      }).sort((a, b) => b.daysOverdue - a.daysOverdue);
      return {
        ...base, type, title: 'Хугацаа хэтэрсэн зээлийн тайлан',
        columns: [{ key: 'loanNo', label: 'Зээлийн №' }, { key: 'phone', label: 'Утас' }, { key: 'product', label: 'Бүтээгдэхүүн' }, { key: 'daysOverdue', label: 'Хоног' }, { key: 'bucket', label: 'Ангилал' }, { key: 'overdueAmount', label: 'Хэтэрсэн дүн', money: true }, { key: 'penalty', label: 'Алданги', money: true }, { key: 'outstandingPrincipal', label: 'Үлдэгдэл', money: true }],
        rows, totals: { overdueAmount: toMoneyString(sum(rows.map((r) => r.overdueAmount))), outstandingPrincipal: toMoneyString(sum(rows.map((r) => r.outstandingPrincipal))) },
      };
    }

    // summary by day / month / year
    const g = q.granularity ?? 'day';
    if (!['day', 'month', 'year'].includes(g)) throw new BadRequestException('granularity must be day|month|year');
    const series = await this.prisma.$queryRaw<{ period: Date; disbursed: Prisma.Decimal; loans: bigint; repaid: Prisma.Decimal; interest: Prisma.Decimal; fees: Prisma.Decimal }[]>`
      WITH periods AS (SELECT generate_series(date_trunc(${g}, ${from}::timestamp), date_trunc(${g}, ${to}::timestamp), ('1 ' || ${g})::interval) AS period)
      SELECT p.period,
        (SELECT COALESCE(SUM(principal),0) FROM loans l WHERE date_trunc(${g}, l."disbursedAt") = p.period) AS disbursed,
        (SELECT COUNT(*) FROM loans l WHERE date_trunc(${g}, l."disbursedAt") = p.period) AS loans,
        (SELECT COALESCE(SUM(amount),0) FROM loan_repayments r WHERE date_trunc(${g}, r."paidAt") = p.period) AS repaid,
        (SELECT COALESCE(SUM("interestPart"),0) FROM loan_repayments r WHERE date_trunc(${g}, r."paidAt") = p.period) AS interest,
        (SELECT COALESCE(SUM("feePart"),0) FROM loan_repayments r WHERE date_trunc(${g}, r."paidAt") = p.period) AS fees
      FROM periods p ORDER BY p.period`;
    const fmt = (d: Date) => (g === 'year' ? String(d.getUTCFullYear()) : g === 'month' ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10));
    const rows = series.map((s) => ({ period: fmt(s.period), loans: Number(s.loans), disbursed: m(s.disbursed), repaid: m(s.repaid), interest: m(s.interest), fees: m(s.fees) }));
    const t = (k: 'disbursed' | 'repaid' | 'interest' | 'fees') => toMoneyString(sum(rows.map((r) => r[k])));
    return {
      ...base, type, title: { day: 'Өдрийн тайлан', month: 'Сарын тайлан', year: 'Жилийн тайлан' }[g],
      columns: [{ key: 'period', label: 'Хугацаа' }, { key: 'loans', label: 'Олгосон зээл' }, { key: 'disbursed', label: 'Олголт', money: true }, { key: 'repaid', label: 'Эргэн төлөлт', money: true }, { key: 'interest', label: 'Хүүгийн орлого', money: true }, { key: 'fees', label: 'Шимтгэл', money: true }],
      rows, totals: { disbursed: t('disbursed'), repaid: t('repaid'), interest: t('interest'), fees: t('fees') },
    };
  }

  async toXlsx(r: ReportResult): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Orgil';
    const ws = wb.addWorksheet(r.title.slice(0, 31));
    ws.addRow([r.title]).font = { bold: true, size: 14, color: { argb: 'FF101C35' } };
    ws.addRow([`${formatDate(r.from)} — ${formatDate(r.to)}`]).font = { color: { argb: 'FF8993A7' } };
    ws.addRow([]);
    const header = ws.addRow(r.columns.map((c) => c.label));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101C35' } };
    });
    for (const row of r.rows) {
      // Money is written as a numeric cell from its exact decimal string (2dp) for spreadsheet maths.
      ws.addRow(r.columns.map((c) => (c.money ? Number(row[c.key]) : row[c.key])));
    }
    const totals = ws.addRow(r.columns.map((c, i) => (i === 0 ? 'Нийт' : r.totals[c.key] !== undefined ? Number(r.totals[c.key]) : '')));
    totals.font = { bold: true };
    r.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.money ? 18 : 16;
      if (c.money) col.numFmt = '#,##0.00';
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  toPdf(r: ReportResult): Promise<Buffer> {
    return this.pdf.render((_doc, h) => {
      h.header(r.title, `${formatDate(r.from)} — ${formatDate(r.to)}`);
      h.table({
        headers: r.columns.map((c) => c.label),
        rows: [
          ...r.rows.map((row) => r.columns.map((c) => (c.money ? formatMNT(String(row[c.key])) : String(row[c.key] ?? '')))),
          r.columns.map((c, i) => (i === 0 ? 'Нийт' : r.totals[c.key] ? formatMNT(r.totals[c.key]) : '')),
        ],
        align: r.columns.map((c) => (c.money ? 'right' : 'left')),
      });
      h.footer(`Үүсгэсэн: ${new Date().toISOString()} · Оргил`);
    }, { landscape: true });
  }
}
