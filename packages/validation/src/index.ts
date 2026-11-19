import { z } from 'zod';

/**
 * Shared validation rules. Error messages are i18n KEYS (resolved by the client with translate()).
 * The API re-validates everything server-side with class-validator using the same regexes.
 */

export const PHONE_REGEX = /^[6-9]\d{7}$/; // Mongolian mobile numbers: 8 digits, start 6–9
export const OTP_REGEX = /^\d{6}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
/** Mongolian register number: 2 Cyrillic letters + 8 digits (e.g. УБ99112233). */
export const REGISTER_REGEX = /^[А-ЯЁӨҮ]{2}\d{8}$/u;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MONEY_REGEX = /^\d{1,13}(\.\d{1,2})?$/;
export const ACCOUNT_REGEX = /^\d{8,16}$/;

export const normalizePhone = (input: string) => input.replace(/\D/g, '').replace(/^976(?=\d{8}$)/, '');

export const phoneSchema = z.string().transform(normalizePhone).refine((v) => PHONE_REGEX.test(v), 'validation.phone');
export const otpSchema = z.string().regex(OTP_REGEX, 'validation.otp');
export const passwordSchema = z.string().regex(PASSWORD_REGEX, 'validation.password');
export const moneySchema = z.string().regex(MONEY_REGEX, 'validation.amount');
const isoDate = z.string().regex(ISO_DATE_REGEX, 'validation.date').refine((v) => !Number.isNaN(Date.parse(v)), 'validation.date');

export const loginSchema = z.object({ phone: phoneSchema, password: z.string().min(1, 'validation.required') });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'validation.passwordMatch', path: ['confirm'] });

export const personalInfoSchema = z.object({
  lastName: z.string().trim().min(1, 'validation.required').max(60),
  firstName: z.string().trim().min(1, 'validation.required').max(60),
  registerNumber: z.string().trim().toUpperCase().regex(REGISTER_REGEX, 'validation.register'),
  dateOfBirth: isoDate,
  email: z.string().trim().email('validation.email').optional().or(z.literal('')),
  address: z.string().trim().min(3, 'validation.required').max(250),
});
export type PersonalInfoInput = z.infer<typeof personalInfoSchema>;

export const employmentSchema = z.object({
  employerName: z.string().trim().min(1, 'validation.required').max(120),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'SELF_EMPLOYED', 'CONTRACT', 'PENSIONER', 'OTHER']),
  jobTitle: z.string().trim().max(80).optional().or(z.literal('')),
  monthlyIncome: moneySchema,
  monthlyObligations: moneySchema,
  employmentStartDate: isoDate,
});
export type EmploymentInput = z.infer<typeof employmentSchema>;

export const bankAccountSchema = z.object({
  bankCode: z.string().min(1, 'validation.required'),
  accountNumber: z.string().regex(ACCOUNT_REGEX, 'validation.account'),
  accountHolder: z.string().trim().min(2, 'validation.required').max(120),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const loanProductSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]{3,32}$/),
    category: z.enum(['CONSUMER', 'SHORT_TERM', 'BNPL', 'SALARY', 'VEHICLE', 'BUSINESS']),
    nameMn: z.string().min(2).max(80),
    nameEn: z.string().min(2).max(80),
    descriptionMn: z.string().max(500),
    descriptionEn: z.string().max(500),
    minAmount: moneySchema,
    maxAmount: moneySchema,
    amountStep: moneySchema,
    allowedTerms: z.array(z.number().int().min(1).max(120)).min(1),
    monthlyInterestRate: z.string().regex(/^\d{1,2}(\.\d{1,4})?$/),
    serviceFeePercent: z.string().regex(/^\d{1,2}(\.\d{1,4})?$/),
    serviceFeeFixed: moneySchema,
    feeCollection: z.enum(['DEDUCTED_FROM_DISBURSEMENT', 'ADDED_TO_FIRST_INSTALLMENT']),
    repaymentMethod: z.enum(['ANNUITY', 'EQUAL_PRINCIPAL', 'BULLET']),
    penaltyRateDaily: z.string().regex(/^\d{1,2}(\.\d{1,4})?$/),
    status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']),
    isAuthorized: z.boolean(),
  })
  .refine((p) => Number(p.minAmount) <= Number(p.maxAmount), { message: 'minAmount must be ≤ maxAmount', path: ['maxAmount'] });
export type LoanProductInput = z.infer<typeof loanProductSchema>;

export { z };
