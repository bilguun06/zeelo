/* eslint-disable no-console */
/**
 * End-to-end smoke test against a running API with seeded data.
 *   API_URL=http://localhost:4000 node test/e2e-smoke.mjs
 * Exercises the full lifecycle: register → profile → KYC → apply → human approval →
 * disbursement (four-eyes) → sandbox repayment (idempotent) → payoff → reports → ledger balance.
 */
const API = (process.env.API_URL ?? 'http://localhost:4000') + '/api/v1';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!2026';
let failures = 0;

async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function step(name, fn) {
  try {
    const out = await fn();
    console.log(`  ✔ ${name}${out ? ` — ${out}` : ''}`);
  } catch (e) {
    failures++;
    console.log(`  ✖ ${name}\n      ${e.message}`);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const phone = `9${String(Date.now()).slice(-7)}`;
const reg = `УБ${String(Date.now()).slice(-8)}`;
const ctx = {};

console.log(`Smoke test against ${API} (phone ${phone})`);

await step('health', async () => (await fetch(API.replace('/api/v1', '') + '/health').then((r) => r.json())).status);

await step('register via OTP', async () => {
  const otp = await call('POST', '/auth/otp/request', { body: { phone, purpose: 'REGISTER' } });
  assert(otp.devCode, 'OTP_DEV_ECHO must be on for the smoke test');
  await call('POST', '/auth/otp/verify', { body: { phone, purpose: 'REGISTER', code: otp.devCode === '000000' ? '111111' : '000000' } }).then(() => { throw new Error('wrong OTP accepted'); }, () => {});
  const { verificationToken } = await call('POST', '/auth/otp/verify', { body: { phone, purpose: 'REGISTER', code: otp.devCode } });
  const t = await call('POST', '/auth/register', { body: { verificationToken, password: 'Passw0rd1', deviceName: 'smoke' } });
  ctx.token = t.accessToken;
  ctx.refresh = t.refreshToken;
});

await step('refresh token rotation', async () => {
  const t = await call('POST', '/auth/refresh', { body: { refreshToken: ctx.refresh } });
  await call('POST', '/auth/refresh', { body: { refreshToken: ctx.refresh } }).then(() => { throw new Error('old refresh token reused'); }, () => {});
  ctx.token = t.accessToken;
});

await step('indicative credit limit before income', async () => {
  const me = await call('GET', '/me', { token: ctx.token });
  return `${me.creditLimit.limit}₮ (indicative=${me.creditLimit.isIndicative})`;
});

await step('products list hides unauthorized products', async () => {
  const products = await call('GET', '/products');
  assert(!products.some((p) => p.code === 'AUTO_STD'), 'unauthorized product visible');
  ctx.product = products.find((p) => p.code === 'CONSUMER_STD');
  assert(ctx.product, 'CONSUMER_STD missing');
  return `${products.length} visible`;
});

await step('quote 2,000,000₮ × 12', async () => {
  const q = await call('POST', `/products/${ctx.product.id}/quote`, { body: { amount: '2000000.00', termMonths: 12 } });
  assert(q.isDemonstration === true, 'quote must be flagged as demonstration');
  return `monthly ${q.monthlyPayment}, total ${q.totalRepayment}, APR ${q.apr}%`;
});

await step('profile: personal + employment + bank account', async () => {
  await call('PUT', '/me/profile/personal', { token: ctx.token, body: { lastName: 'Тест', firstName: 'Хэрэглэгч', registerNumber: reg, dateOfBirth: '1996-01-15', email: 'smoke@example.mn', address: 'Улаанбаатар, ХУД' } });
  await call('PUT', '/me/profile/employment', { token: ctx.token, body: { employerName: 'Smoke LLC', employmentType: 'FULL_TIME', jobTitle: 'QA', monthlyIncome: '3500000.00', monthlyObligations: '100000.00', employmentStartDate: '2020-02-01' } });
  const b = await call('POST', '/me/bank-accounts', { token: ctx.token, body: { bankCode: 'KHAN', accountNumber: '5001234567', accountHolder: 'Тест Хэрэглэгч' } });
  ctx.bankId = b.id;
  return `account ${b.accountNumberMasked}`;
});

await step('KYC upload (magic-byte check) + submit', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, ...Array(64).fill(7), 0xff, 0xd9]);
  const fake = new FormData();
  fake.append('type', 'ID_FRONT');
  fake.append('file', new Blob([new TextEncoder().encode('<script>not an image</script>')], { type: 'image/jpeg' }), 'x.jpg');
  const bad = await call('POST', '/kyc/documents', { token: ctx.token, body: fake, raw: true });
  assert(bad.status === 400, `spoofed file accepted (${bad.status})`);
  for (const type of ['ID_FRONT', 'ID_BACK', 'SELFIE']) {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', new Blob([jpeg.map((b, i) => (i === 20 ? type.length + Date.now() % 200 : b))], { type: 'image/jpeg' }), `${type}.jpg`);
    await call('POST', '/kyc/documents', { token: ctx.token, body: fd });
  }
  return (await call('POST', '/kyc/submit', { token: ctx.token })).status;
});

await step('application preview + submit (contract hash pinned)', async () => {
  const terms = { productId: ctx.product.id, amount: '2000000.00', termMonths: 12, bankAccountId: ctx.bankId, purpose: 'Smoke test' };
  const pv = await call('POST', '/applications/preview', { token: ctx.token, body: terms });
  await call('POST', '/applications', { token: ctx.token, body: { ...terms, contractHash: 'a'.repeat(64), acceptTerms: true, consentDataProcessing: true } }).then(() => { throw new Error('stale contract hash accepted'); }, () => {});
  const app = await call('POST', '/applications', { token: ctx.token, body: { ...terms, contractHash: pv.contract.contentHash, acceptTerms: true, consentDataProcessing: true } });
  ctx.appId = app.id;
  assert(app.status === 'UNDER_REVIEW', `expected UNDER_REVIEW, got ${app.status}`);
  return `${app.applicationNo} → ${app.status}`;
});

await step('admin logins (officer, finance)', async () => {
  ctx.officer = (await call('POST', '/admin/auth/login', { body: { email: 'officer@orgil.local', password: ADMIN_PASSWORD } })).accessToken;
  ctx.finance = (await call('POST', '/admin/auth/login', { body: { email: 'finance@orgil.local', password: ADMIN_PASSWORD } })).accessToken;
  assert(ctx.officer && ctx.finance, 'missing admin tokens');
});

await step('approval blocked until KYC verified', async () => {
  const r = await call('POST', `/admin/applications/${ctx.appId}/decision`, { token: ctx.officer, body: { action: 'APPROVE', reason: 'too early' }, raw: true });
  assert(r.status === 422, `expected 422 KYC gate, got ${r.status}`);
  const d = await call('GET', `/admin/applications/${ctx.appId}`, { token: ctx.officer });
  await call('POST', `/admin/users/${d.applicant.userId}/kyc`, { token: ctx.officer, body: { decision: 'VERIFIED', note: 'Documents match (smoke)' } });
});

await step('AI assessment is advisory, human approves', async () => {
  await call('POST', `/admin/applications/${ctx.appId}/rescore`, { token: ctx.officer });
  const d = await call('GET', `/admin/applications/${ctx.appId}`, { token: ctx.officer });
  const a = d.assessments[0];
  assert(a && a.requiresHumanDecision && a.dataSource === 'SIMULATED', 'assessment missing or not flagged');
  await call('POST', `/admin/applications/${ctx.appId}/decision`, { token: ctx.officer, body: { action: 'APPROVE', reason: 'Төлбөрийн чадвар хангалттай (smoke)' } });
  return `score ${a.score} grade ${a.riskGrade} → ${a.recommendation}`;
});

await step('RBAC: credit officer cannot disburse', async () => {
  const r = await call('POST', `/admin/applications/${ctx.appId}/disburse`, { token: ctx.officer, body: { payoutReference: 'TEST-0001' }, raw: true });
  assert(r.status === 403, `expected 403, got ${r.status}`);
});

await step('finance books disbursement', async () => {
  const r = await call('POST', `/admin/applications/${ctx.appId}/disburse`, { token: ctx.finance, body: { payoutReference: 'KHAN-TRX-778899' } });
  ctx.loanId = r.loanId;
  return r.loanNo;
});

await step('customer sees active loan + schedule', async () => {
  const l = await call('GET', `/loans/${ctx.loanId}`, { token: ctx.token });
  ctx.loan = l;
  assert(l.schedule.length === 12 && l.status === 'ACTIVE', 'bad loan state');
  return `next due ${l.nextDue.amount} on ${l.nextDue.date.slice(0, 10)}, payoff ${l.payoffAmount}`;
});

await step('sandbox repayment is idempotent', async () => {
  const key = `smoke-${Date.now()}-installment`;
  const body = { loanId: ctx.loanId, amount: ctx.loan.nextDue.amount, provider: 'SANDBOX' };
  const i1 = await call('POST', '/payments/intents', { token: ctx.token, body, headers: { 'Idempotency-Key': key } });
  const i2 = await call('POST', '/payments/intents', { token: ctx.token, body, headers: { 'Idempotency-Key': key } });
  assert(i1.id === i2.id && i1.sandbox, 'idempotency broken');
  const paid = await call('POST', `/payments/intents/${i1.id}/sandbox-confirm`, { token: ctx.token });
  const again = await call('POST', `/payments/intents/${i1.id}/sandbox-confirm`, { token: ctx.token });
  assert(paid.status === 'PAID' && paid.repaymentId && again.repaymentId === paid.repaymentId, 'double settlement');
  ctx.repaymentId = paid.repaymentId;
  return `receipt ${paid.repaymentId.slice(0, 8)}…`;
});

await step('overpayment rejected', async () => {
  const r = await call('POST', '/payments/intents', { token: ctx.token, body: { loanId: ctx.loanId, amount: '99999999.00', provider: 'SANDBOX' }, headers: { 'Idempotency-Key': `smoke-over-${Date.now()}` }, raw: true });
  assert(r.status === 422, `expected 422, got ${r.status}`);
});

await step('receipt PDF', async () => {
  const r = await call('GET', `/documents/receipts/${ctx.repaymentId}`, { token: ctx.token, raw: true });
  const buf = Buffer.from(await r.arrayBuffer());
  assert(r.ok && buf.subarray(0, 4).toString() === '%PDF', 'not a PDF');
  return `${buf.length} bytes`;
});

await step('early payoff closes loan and waives future interest', async () => {
  const l = await call('GET', `/loans/${ctx.loanId}`, { token: ctx.token });
  const i = await call('POST', '/payments/intents', { token: ctx.token, body: { loanId: ctx.loanId, amount: l.payoffAmount, provider: 'SANDBOX' }, headers: { 'Idempotency-Key': `smoke-payoff-${Date.now()}` } });
  await call('POST', `/payments/intents/${i.id}/sandbox-confirm`, { token: ctx.token });
  const after = await call('GET', `/loans/${ctx.loanId}`, { token: ctx.token });
  assert(after.status === 'COMPLETED' && after.outstandingPrincipal === '0.00', `loan not closed: ${after.status} ${after.outstandingPrincipal}`);
  return `paid ${l.payoffAmount} (contractual outstanding was ${l.totalOutstanding})`;
});

await step('ledger journals balance for the loan', async () => {
  const d = await call('GET', `/admin/loans/${ctx.loanId}`, { token: ctx.finance });
  const dr = d.ledger.reduce((s, x) => s + Math.round(Number(x.debit) * 100), 0);
  const cr = d.ledger.reduce((s, x) => s + Math.round(Number(x.credit) * 100), 0);
  assert(dr === cr && dr > 0, `unbalanced Dr ${dr} Cr ${cr}`);
  const recv = d.ledger.filter((x) => x.account === 'LOANS_RECEIVABLE').reduce((s, x) => s + Math.round(Number(x.debit) * 100) - Math.round(Number(x.credit) * 100), 0);
  assert(recv === 0, `loans receivable not cleared: ${recv}`);
  return `${d.ledger.length} lines, Dr = Cr = ${(dr / 100).toFixed(2)}`;
});

await step('transactions + notifications for customer', async () => {
  const t = await call('GET', '/transactions?type=REPAYMENT', { token: ctx.token });
  const n = await call('GET', '/notifications', { token: ctx.token });
  assert(t.total === 2, `expected 2 repayments, got ${t.total}`);
  return `${t.total} repayments, ${n.total} notifications (${n.unread} unread)`;
});

await step('overdue job + reports (json/xlsx/pdf)', async () => {
  const admin = (await call('POST', '/admin/auth/login', { body: { email: 'admin@orgil.local', password: ADMIN_PASSWORD } })).accessToken;
  const job = await call('POST', '/admin/loans/jobs/refresh-overdue', { token: admin });
  const ov = await call('GET', '/admin/overview', { token: admin });
  const summary = await call('GET', '/admin/reports/summary?granularity=month', { token: admin });
  for (const format of ['xlsx', 'pdf']) {
    const r = await call('GET', `/admin/reports/repayments?format=${format}`, { token: admin, raw: true });
    assert(r.ok && (await r.arrayBuffer()).byteLength > 500, `${format} export failed`);
  }
  const audit = await call('GET', '/admin/audit-logs?pageSize=5', { token: admin });
  return `overdue: ${job.loans} loans; users ${ov.totalUsers}, outstanding ${ov.totalOutstanding}; ${summary.rows.length} summary rows; ${audit.total} audit entries`;
});

console.log(failures ? `\n${failures} step(s) FAILED` : '\nAll smoke steps passed');
process.exit(failures ? 1 : 0);
