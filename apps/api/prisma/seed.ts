/* eslint-disable no-console */
import '../src/load-env';
import { Prisma, PrismaClient } from '@prisma/client';
import { addMonthsUTC, applyPayment, buildSchedule, calculateQuote, calculateServiceFee, dec, toMoneyString, type PricingTerms } from '@orgil/financial-engine';
import { ALL_PERMISSIONS } from '../src/common/auth';
import { CryptoService } from '../src/common/crypto.service';
import { SETTING_DEFAULTS } from '../src/common/settings.service';
import { scoreApplication } from '../src/modules/credit/credit-scoring';

/**
 * Development seed. All people, numbers and rates are FICTIONAL demo data.
 * Product pricing below is placeholder configuration to exercise the system — it is not a
 * real offer and must be replaced by the provider's approved tariffs.
 */
const prisma = new PrismaClient();
const crypto = new CryptoService();

const ROLES: Record<string, { description: string; permissions: string[] }> = {
  SUPER_ADMIN: { description: 'Full access', permissions: Object.keys(ALL_PERMISSIONS) },
  CREDIT_OFFICER: { description: 'Reviews and decides applications', permissions: ['users.read', 'kyc.review', 'applications.read', 'applications.decide', 'loans.read', 'products.read'] },
  FINANCE: { description: 'Disbursement, payments, reports', permissions: ['users.read', 'applications.read', 'loans.read', 'loans.disburse', 'reports.read', 'reports.export', 'products.read'] },
  SUPPORT: { description: 'Customer support', permissions: ['users.read', 'applications.read', 'loans.read', 'notifications.write'] },
  AUDITOR: { description: 'Read-only compliance', permissions: ['users.read', 'applications.read', 'loans.read', 'products.read', 'reports.read', 'audit.read'] },
};

const PRODUCTS = [
  { code: 'CONSUMER_STD', category: 'CONSUMER', nameMn: 'Хэрэглээний зээл', nameEn: 'Consumer loan', descriptionMn: 'Өдөр тутмын хэрэгцээ, худалдан авалтад зориулсан уян хатан зээл.', descriptionEn: 'Flexible loan for everyday needs and purchases.', minAmount: '300000', maxAmount: '5000000', amountStep: '50000', allowedTerms: [3, 6, 9, 12, 18, 24], monthlyInterestRate: '2.8', serviceFeePercent: '1', serviceFeeFixed: '0', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'ANNUITY', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '800000.00', minAgeYears: 18, minEmploymentMonths: 6, requiresKyc: true }, status: 'ACTIVE', isAuthorized: true, sortOrder: 1 },
  { code: 'SHORT_30', category: 'SHORT_TERM', nameMn: 'Богино хугацаат зээл', nameEn: 'Short-term loan', descriptionMn: 'Яаралтай хэрэгцээнд 1–3 сарын хугацаатай, хугацааны эцэст төлөх зээл.', descriptionEn: '1–3 month loan repaid in one payment at maturity.', minAmount: '100000', maxAmount: '1000000', amountStep: '10000', allowedTerms: [1, 2, 3], monthlyInterestRate: '3.2', serviceFeePercent: '0', serviceFeeFixed: '5000', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'BULLET', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '500000.00', minAgeYears: 18, requiresKyc: true }, status: 'ACTIVE', isAuthorized: true, sortOrder: 2 },
  { code: 'BNPL_4', category: 'BNPL', nameMn: 'Хуваан төлөх үйлчилгээ', nameEn: 'Buy now, pay later', descriptionMn: 'Хамтрагч дэлгүүрүүдийн худалдан авалтаа 3–6 хувааж төлөөрэй.', descriptionEn: 'Split partner-store purchases into 3–6 payments.', minAmount: '50000', maxAmount: '3000000', amountStep: '10000', allowedTerms: [3, 4, 6], monthlyInterestRate: '0', serviceFeePercent: '2.5', serviceFeeFixed: '0', feeCollection: 'ADDED_TO_FIRST_INSTALLMENT', repaymentMethod: 'EQUAL_PRINCIPAL', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '500000.00', minAgeYears: 18, requiresKyc: true }, status: 'ACTIVE', isAuthorized: true, sortOrder: 3 },
  { code: 'SALARY_ADV', category: 'SALARY', nameMn: 'Цалингийн зээл', nameEn: 'Salary loan', descriptionMn: 'Цалингийн орлоготой иргэдэд зориулсан, бага хүүтэй зээл.', descriptionEn: 'Lower-rate loan for salaried employees.', minAmount: '500000', maxAmount: '8000000', amountStep: '100000', allowedTerms: [6, 12, 18, 24, 36], monthlyInterestRate: '2.2', serviceFeePercent: '0.5', serviceFeeFixed: '0', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'ANNUITY', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '1200000.00', minAgeYears: 18, minEmploymentMonths: 12, requiresKyc: true }, status: 'ACTIVE', isAuthorized: true, sortOrder: 4 },
  { code: 'AUTO_STD', category: 'VEHICLE', nameMn: 'Автомашины зээл', nameEn: 'Vehicle loan', descriptionMn: 'Автомашин худалдан авахад (барьцаатай). Хууль эрх зүйн зөвшөөрөл хүлээгдэж буй.', descriptionEn: 'Secured vehicle purchase loan. Pending authorization.', minAmount: '5000000', maxAmount: '60000000', amountStep: '500000', allowedTerms: [12, 24, 36, 48], monthlyInterestRate: '1.9', serviceFeePercent: '1', serviceFeeFixed: '0', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'ANNUITY', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '2000000.00', minAgeYears: 21, minEmploymentMonths: 12, requiresKyc: true }, status: 'DRAFT', isAuthorized: false, sortOrder: 5 },
  { code: 'BIZ_SME', category: 'BUSINESS', nameMn: 'Бизнесийн зээл', nameEn: 'Business loan', descriptionMn: 'Жижиг, дунд бизнесийн эргэлтийн хөрөнгөд. Тун удахгүй.', descriptionEn: 'SME working-capital loan. Coming soon.', minAmount: '3000000', maxAmount: '50000000', amountStep: '500000', allowedTerms: [6, 12, 24], monthlyInterestRate: '2.0', serviceFeePercent: '1', serviceFeeFixed: '0', feeCollection: 'DEDUCTED_FROM_DISBURSEMENT', repaymentMethod: 'ANNUITY', penaltyRateDaily: '0.1', eligibility: { minMonthlyIncome: '3000000.00', minAgeYears: 18, requiresKyc: true }, status: 'PAUSED', isAuthorized: false, sortOrder: 6 },
] as const;

const CUSTOMERS = [
  { phone: '99112233', first: 'Тэмүүлэн', last: 'Батболд', reg: 'УБ95041212', dob: '1995-04-12', employer: 'Номин Холдинг ХХК', type: 'FULL_TIME', title: 'Борлуулалтын менежер', income: '3200000', obligations: '250000', since: '2021-03-01', kyc: 'VERIFIED' },
  { phone: '88223344', first: 'Сарангэрэл', last: 'Дорж', reg: 'ЧД92110505', dob: '1992-11-05', employer: 'Хаан Даатгал ХК', type: 'FULL_TIME', title: 'Нягтлан бодогч', income: '2600000', obligations: '0', since: '2019-08-15', kyc: 'VERIFIED' },
  { phone: '95334455', first: 'Ганбаатар', last: 'Очир', reg: 'БЗ88070707', dob: '1988-07-07', employer: 'Хувиараа', type: 'SELF_EMPLOYED', title: 'Такси жолооч', income: '1800000', obligations: '600000', since: '2023-01-10', kyc: 'PENDING' },
  { phone: '80445566', first: 'Номин', last: 'Эрдэнэ', reg: 'СХ99030303', dob: '1999-03-03', employer: 'Юнител ХХК', type: 'CONTRACT', title: 'Дизайнер', income: '2100000', obligations: '150000', since: '2024-06-01', kyc: 'VERIFIED' },
  { phone: '99887766', first: 'Болд', last: 'Сүхбаатар', reg: 'УБ85121212', dob: '1985-12-12', employer: 'МИАТ ХК', type: 'FULL_TIME', title: 'Инженер', income: '4500000', obligations: '900000', since: '2015-02-01', kyc: 'VERIFIED' },
] as const;

const termsOf = (p: (typeof PRODUCTS)[number]): PricingTerms & { penaltyRateDaily: string } => ({
  monthlyInterestRate: p.monthlyInterestRate, serviceFeePercent: p.serviceFeePercent, serviceFeeFixed: p.serviceFeeFixed,
  repaymentMethod: p.repaymentMethod, feeCollection: p.feeCollection, penaltyRateDaily: p.penaltyRateDaily,
});

async function main() {
  console.log('Seeding permissions, roles, admins…');
  for (const [key, description] of Object.entries(ALL_PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });
  }
  const perms = await prisma.permission.findMany();
  const roleIds: Record<string, string> = {};
  for (const [name, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({ where: { name }, create: { name, description: def.description, isSystem: true }, update: { description: def.description } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: perms.filter((p) => def.permissions.includes(p.key)).map((p) => ({ roleId: role.id, permissionId: p.id })) });
    roleIds[name] = role.id;
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
  const staff = [
    { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@orgil.local', name: 'Систем Админ', role: 'SUPER_ADMIN' },
    { email: 'officer@orgil.local', name: 'Зээлийн ажилтан Б.Анужин', role: 'CREDIT_OFFICER' },
    { email: 'finance@orgil.local', name: 'Санхүүч Д.Мөнх', role: 'FINANCE' },
    { email: 'support@orgil.local', name: 'Харилцагчийн үйлчилгээ Г.Солонго', role: 'SUPPORT' },
    { email: 'auditor@orgil.local', name: 'Аудитор Ц.Батзаяа', role: 'AUDITOR' },
  ];
  const adminIds: Record<string, string> = {};
  for (const s of staff) {
    const a = await prisma.adminUser.upsert({
      where: { email: s.email },
      create: { email: s.email, name: s.name, roleId: roleIds[s.role], passwordHash: await crypto.hashPassword(adminPassword) },
      update: { roleId: roleIds[s.role] },
    });
    adminIds[s.role] = a.id;
  }

  for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: def.value as Prisma.InputJsonValue, description: def.description }, update: {} });
  }

  console.log('Seeding loan products…');
  const productIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const data = { ...p, allowedTerms: [...p.allowedTerms], eligibility: { ...p.eligibility } };
    const row = await prisma.loanProduct.upsert({ where: { code: p.code }, create: data, update: {} });
    productIds[p.code] = row.id;
  }

  if (await prisma.user.count()) {
    console.log('Customers already exist — skipping demo customers.');
    return;
  }

  console.log('Seeding demo customers and loan history…');
  const password = await crypto.hashPassword('Demo1234');
  const users: { id: string; bankId: string; c: (typeof CUSTOMERS)[number] }[] = [];
  for (const [i, c] of CUSTOMERS.entries()) {
    const createdAt = new Date(Date.now() - (200 - i * 30) * 86_400_000);
    const user = await prisma.user.create({
      data: {
        phone: c.phone, passwordHash: password, phoneVerifiedAt: createdAt, createdAt, lastLoginAt: new Date(),
        profile: {
          create: {
            firstName: c.first, lastName: c.last, registerNumberEnc: crypto.encrypt(c.reg), registerNumberHash: crypto.blindIndex(c.reg), registerNumberLast4: c.reg.slice(-4),
            dateOfBirth: new Date(c.dob), email: `${c.phone}@example.mn`, address: 'Улаанбаатар хот, Сүхбаатар дүүрэг', employerName: c.employer, employmentType: c.type,
            jobTitle: c.title, monthlyIncome: c.income, monthlyObligations: c.obligations, employmentStartDate: new Date(c.since), kycStatus: c.kyc,
            kycVerifiedAt: c.kyc === 'VERIFIED' ? createdAt : null,
          },
        },
      },
    });
    const acct = `50${String(10000000 + i * 1234567).slice(0, 8)}`;
    const bank = await prisma.bankAccount.create({
      data: { userId: user.id, bankCode: i % 2 ? 'GOLOMT' : 'KHAN', bankName: i % 2 ? 'Голомт банк' : 'Хаан банк', accountNumberEnc: crypto.encrypt(acct), accountNumberHash: crypto.blindIndex(acct), accountLast4: acct.slice(-4), accountHolder: `${c.last} ${c.first}`, isPrimary: true },
    });
    for (const t of ['ID_FRONT', 'ID_BACK', 'SELFIE'] as const) {
      await prisma.userDocument.create({ data: { userId: user.id, type: t, storageKey: `seed/${user.id}-${t}.bin`, mimeType: 'image/jpeg', sizeBytes: 0, sha256: crypto.sha256(`${user.id}${t}`), status: c.kyc === 'VERIFIED' ? 'ACCEPTED' : 'UPLOADED' } });
    }
    users.push({ id: user.id, bankId: bank.id, c });
  }

  /** Creates an application → approval → loan with backdated schedule, then applies sandbox repayments. */
  async function seedLoan(u: (typeof users)[number], code: (typeof PRODUCTS)[number]['code'], amount: string, term: number, monthsAgo: number, paidInstallments: number | 'all') {
    const product = PRODUCTS.find((p) => p.code === code)!;
    const terms = termsOf(product);
    const start = addMonthsUTC(new Date(), -monthsAgo);
    const quote = calculateQuote({ ...terms, principal: amount, termMonths: term, startDate: start });
    const app = await prisma.loanApplication.create({
      data: {
        applicationNo: crypto.reference('APP'), userId: u.id, productId: productIds[code], bankAccountId: u.bankId, amount, termMonths: term, status: 'DISBURSED',
        submittedAt: start, decidedAt: start, createdAt: start, decisionReason: 'Орлого, төлбөрийн чадвар хангалттай', applicantSnapshot: { firstName: u.c.first, lastName: u.c.last, monthlyIncome: u.c.income },
        termsSnapshot: terms as unknown as Prisma.InputJsonValue, quote: { ...quote, isDemonstration: false } as unknown as Prisma.InputJsonValue,
        history: { create: [{ toStatus: 'PENDING', actorType: 'USER', createdAt: start }, { fromStatus: 'PENDING', toStatus: 'UNDER_REVIEW', actorType: 'SYSTEM', createdAt: start }, { fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED', actorType: 'ADMIN', actorId: adminIds.CREDIT_OFFICER, createdAt: start }, { fromStatus: 'APPROVED', toStatus: 'DISBURSED', actorType: 'ADMIN', actorId: adminIds.FINANCE, createdAt: start }] },
        approvals: { create: { adminId: adminIds.CREDIT_OFFICER, decision: 'APPROVED', approvedAmount: amount, approvedTermMonths: term, reason: 'Орлого, төлбөрийн чадвар хангалттай', createdAt: start } },
      },
    });
    const lines = buildSchedule({ ...terms, principal: amount, termMonths: term, startDate: start });
    const fee = calculateServiceFee(amount, terms.serviceFeePercent, terms.serviceFeeFixed);
    const deducted = terms.feeCollection === 'DEDUCTED_FROM_DISBURSEMENT';
    const net = deducted ? dec(amount).minus(fee) : dec(amount);
    const loan = await prisma.loan.create({
      data: {
        loanNo: crypto.reference('LN'), userId: u.id, applicationId: app.id, productId: productIds[code], principal: amount, monthlyInterestRate: terms.monthlyInterestRate as string,
        serviceFee: toMoneyString(fee), feeCollection: terms.feeCollection, penaltyRateDaily: terms.penaltyRateDaily, termMonths: term, repaymentMethod: terms.repaymentMethod,
        outstandingPrincipal: amount, disbursedAt: start, maturityDate: lines[lines.length - 1].dueDate,
        schedule: { create: lines.map((l) => ({ installmentNo: l.installmentNo, dueDate: l.dueDate, principalDue: toMoneyString(l.principal), interestDue: toMoneyString(l.interest), feeDue: toMoneyString(l.fee) })) },
      },
      include: { schedule: true },
    });
    const j = await prisma.journalEntry.create({
      data: {
        reference: `DISB:${loan.loanNo}:SEED`, description: `Disbursement ${loan.loanNo}`, createdAt: start,
        lines: { create: [{ account: 'LOANS_RECEIVABLE', debit: amount, loanId: loan.id }, { account: 'CASH_CLEARING', credit: toMoneyString(net), loanId: loan.id }, ...(deducted && fee.gt(0) ? [{ account: 'FEE_INCOME' as const, credit: toMoneyString(fee), loanId: loan.id }] : [])] },
      },
    });
    await prisma.transaction.create({ data: { txnNo: crypto.reference('TXN'), userId: u.id, loanId: loan.id, type: 'DISBURSEMENT', direction: 'CREDIT', amount: toMoneyString(net), description: `Зээл олголт ${loan.loanNo}`, journalId: j.id, createdAt: start } });
    if (deducted && fee.gt(0)) await prisma.transaction.create({ data: { txnNo: crypto.reference('TXN'), userId: u.id, loanId: loan.id, type: 'FEE', direction: 'DEBIT', amount: toMoneyString(fee), description: `Үйлчилгээний шимтгэл ${loan.loanNo}`, journalId: j.id, createdAt: start } });
    await prisma.digitalContract.create({ data: { applicationId: app.id, userId: u.id, templateVersion: '2026.1', body: 'Seed contract (demo data)', contentHash: crypto.sha256(`seed-${app.id}`), acceptedAt: start } });

    // Apply on-time sandbox payments installment by installment.
    let schedule = loan.schedule.sort((a, b) => a.installmentNo - b.installmentNo);
    const count = paidInstallments === 'all' ? schedule.length : paidInstallments;
    let outstanding = dec(amount);
    for (let k = 0; k < count; k++) {
      const inst = schedule[k];
      const paidAt = new Date(inst.dueDate.getTime() - 2 * 86_400_000);
      const states = schedule.map((s) => ({ installmentNo: s.installmentNo, dueDate: s.dueDate, principalDue: s.principalDue.toString(), interestDue: s.interestDue.toString(), feeDue: s.feeDue.toString(), penaltyDue: '0', principalPaid: s.principalPaid.toString(), interestPaid: s.interestPaid.toString(), feePaid: s.feePaid.toString(), penaltyPaid: '0' }));
      const due = dec(inst.principalDue.toString()).plus(inst.interestDue.toString()).plus(inst.feeDue.toString());
      const r = applyPayment(states, due, inst.dueDate, start);
      outstanding = outstanding.minus(r.totals.principal);
      await prisma.loanSchedule.update({ where: { id: inst.id }, data: { principalPaid: inst.principalDue, interestPaid: inst.interestDue, feePaid: inst.feeDue, status: 'PAID', paidAt } });
      const rep = await prisma.loanRepayment.create({
        data: {
          receiptNo: crypto.reference('RC'), loanId: loan.id, userId: u.id, provider: 'SANDBOX', sandbox: true, amount: toMoneyString(due), principalPart: toMoneyString(r.totals.principal),
          interestPart: toMoneyString(r.totals.interest), feePart: toMoneyString(r.totals.fee), penaltyPart: '0', allocation: [], paidAt,
        },
      });
      const jr = await prisma.journalEntry.create({
        data: {
          reference: `RPMT:${rep.receiptNo}`, description: `Repayment ${loan.loanNo} [SANDBOX]`, createdAt: paidAt,
          lines: { create: [{ account: 'CASH_CLEARING', debit: toMoneyString(due), loanId: loan.id }, { account: 'LOANS_RECEIVABLE', credit: toMoneyString(r.totals.principal), loanId: loan.id }, { account: 'INTEREST_INCOME', credit: toMoneyString(r.totals.interest), loanId: loan.id }, ...(r.totals.fee.gt(0) ? [{ account: 'FEE_INCOME' as const, credit: toMoneyString(r.totals.fee), loanId: loan.id }] : [])] },
        },
      });
      await prisma.transaction.create({ data: { txnNo: crypto.reference('TXN'), userId: u.id, loanId: loan.id, type: 'REPAYMENT', direction: 'DEBIT', amount: toMoneyString(due), description: `Зээлийн төлөлт ${loan.loanNo} (туршилт)`, journalId: jr.id, createdAt: paidAt } });
      schedule = await prisma.loanSchedule.findMany({ where: { loanId: loan.id }, orderBy: { installmentNo: 'asc' } });
    }
    const done = count === schedule.length;
    await prisma.loan.update({ where: { id: loan.id }, data: { outstandingPrincipal: toMoneyString(outstanding), status: done ? 'COMPLETED' : 'ACTIVE', closedAt: done ? new Date() : null } });
    if (done) await prisma.loanApplication.update({ where: { id: app.id }, data: { status: 'COMPLETED' } });
    return loan;
  }

  const [temuulen, sarangerel, ganbaatar, nomin, bold] = users;
  await seedLoan(temuulen, 'CONSUMER_STD', '2000000', 12, 3, 3);
  await seedLoan(temuulen, 'SHORT_30', '500000', 1, 7, 'all');
  await seedLoan(sarangerel, 'SALARY_ADV', '4000000', 24, 5, 5);
  await seedLoan(bold, 'CONSUMER_STD', '3000000', 6, 4, 2); // one installment now overdue → exercised by the overdue job
  await seedLoan(nomin, 'BNPL_4', '900000', 3, 2, 2);

  // Open applications waiting in the credit officer queue (scored by the real model).
  for (const [u, code, amount, term] of [[ganbaatar, 'CONSUMER_STD', '1500000', 12], [nomin, 'SALARY_ADV', '3000000', 18]] as const) {
    const product = PRODUCTS.find((p) => p.code === code)!;
    const quote = calculateQuote({ ...termsOf(product), principal: amount, termMonths: term });
    const app = await prisma.loanApplication.create({
      data: {
        applicationNo: crypto.reference('APP'), userId: u.id, productId: productIds[code], bankAccountId: u.bankId, amount, termMonths: term, status: 'UNDER_REVIEW', submittedAt: new Date(),
        applicantSnapshot: { firstName: u.c.first, lastName: u.c.last, monthlyIncome: u.c.income, employerName: u.c.employer }, termsSnapshot: termsOf(product) as unknown as Prisma.InputJsonValue,
        quote: { ...quote, isDemonstration: false } as unknown as Prisma.InputJsonValue,
        history: { create: [{ toStatus: 'PENDING', actorType: 'USER', actorId: u.id }, { fromStatus: 'PENDING', toStatus: 'UNDER_REVIEW', actorType: 'SYSTEM', note: 'Queued for credit officer review' }] },
      },
    });
    await prisma.digitalContract.create({ data: { applicationId: app.id, userId: u.id, templateVersion: '2026.1', body: 'Seed contract (demo data)', contentHash: crypto.sha256(`seed-${app.id}`), acceptedAt: new Date() } });
    const months = Math.floor((Date.now() - new Date(u.c.since).getTime()) / (30.44 * 86_400_000));
    const r = scoreApplication({
      monthlyIncome: u.c.income, monthlyObligations: u.c.obligations, employmentMonths: months, employmentType: u.c.type, kycVerified: u.c.kyc === 'VERIFIED', ageYears: 30,
      requestedAmount: amount, newMonthlyPayment: quote.firstPayment, internal: { completedLoans: 0, lateInstallments: 0, currentlyOverdue: false },
      bureau: { monthlyDebtService: '0.00', delinquencies12m: 0, inquiries30d: 1, source: 'SIMULATED' }, fraud: { applications24h: 1, accountAgeDays: 90, duplicateDocumentAcrossUsers: false },
      policy: { maxDti: '0.55', minAgeYears: 18, minMonthlyIncome: product.eligibility.minMonthlyIncome, requiresKyc: product.eligibility.requiresKyc },
    });
    await prisma.creditScore.create({
      data: {
        userId: u.id, applicationId: app.id, score: r.score, riskGrade: r.riskGrade, probabilityOfDefault: r.probabilityOfDefault, debtToIncome: r.debtToIncome, recommendation: r.recommendation,
        factors: r.factors as unknown as Prisma.InputJsonValue, policyChecks: r.policyChecks as unknown as Prisma.InputJsonValue, fraudFlags: r.fraudFlags as unknown as Prisma.InputJsonValue, modelVersion: r.modelVersion,
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: temuulen.id, category: 'PAYMENT_SUCCESS', titleMn: 'Төлөлт амжилттай', bodyMn: 'Хэрэглээний зээлийн 3 дахь төлөлт амжилттай хийгдлээ.', titleEn: 'Payment received', bodyEn: 'Your 3rd consumer loan payment was received.' },
      { userId: temuulen.id, category: 'ANNOUNCEMENT', titleMn: 'Шинэ үйлчилгээ', bodyMn: 'Хуваан төлөх үйлчилгээ одоо хамтрагч дэлгүүрүүдэд нээлттэй боллоо.', titleEn: 'New service', bodyEn: 'Buy now, pay later is now available at partner stores.' },
    ],
  });

  console.log('\nDone. Demo logins:');
  console.log('  Mobile  : 99112233 / Demo1234  (also 88223344, 95334455, 80445566, 99887766)');
  console.log(`  Admin   : ${staff[0].email} / ${adminPassword}  (officer@, finance@, support@, auditor@orgil.local — same password)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
