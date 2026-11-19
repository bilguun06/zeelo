/** Domain enums shared by API, admin and mobile. Mirror the Prisma enums. */

export const LoanCategory = {
  CONSUMER: 'CONSUMER',
  SHORT_TERM: 'SHORT_TERM',
  BNPL: 'BNPL',
  SALARY: 'SALARY',
  VEHICLE: 'VEHICLE',
  BUSINESS: 'BUSINESS',
} as const;
export type LoanCategory = keyof typeof LoanCategory;

export const ApplicationStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  INFO_REQUESTED: 'INFO_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  DISBURSED: 'DISBURSED',
  COMPLETED: 'COMPLETED',
} as const;
export type ApplicationStatus = keyof typeof ApplicationStatus;

export const LoanStatus = {
  ACTIVE: 'ACTIVE',
  OVERDUE: 'OVERDUE',
  COMPLETED: 'COMPLETED',
  WRITTEN_OFF: 'WRITTEN_OFF',
} as const;
export type LoanStatus = keyof typeof LoanStatus;

export const InstallmentStatus = {
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  WAIVED: 'WAIVED',
} as const;
export type InstallmentStatus = keyof typeof InstallmentStatus;

export const TransactionType = {
  DISBURSEMENT: 'DISBURSEMENT',
  REPAYMENT: 'REPAYMENT',
  FEE: 'FEE',
  PENALTY: 'PENALTY',
  REFUND: 'REFUND',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type TransactionType = keyof typeof TransactionType;

export const NotificationCategory = {
  LOAN_APPROVED: 'LOAN_APPROVED',
  LOAN_REJECTED: 'LOAN_REJECTED',
  INFO_REQUESTED: 'INFO_REQUESTED',
  LOAN_DISBURSED: 'LOAN_DISBURSED',
  REPAYMENT_REMINDER: 'REPAYMENT_REMINDER',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  DUE_SOON: 'DUE_SOON',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationCategory = keyof typeof NotificationCategory;

export const KycStatus = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type KycStatus = keyof typeof KycStatus;

export const PaymentProvider = {
  SANDBOX: 'SANDBOX',
  QPAY: 'QPAY',
  SOCIALPAY: 'SOCIALPAY',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;
export type PaymentProvider = keyof typeof PaymentProvider;

export const PaymentStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = keyof typeof PaymentStatus;

export const RepaymentMethod = {
  ANNUITY: 'ANNUITY',
  EQUAL_PRINCIPAL: 'EQUAL_PRINCIPAL',
  BULLET: 'BULLET',
} as const;
export type RepaymentMethod = keyof typeof RepaymentMethod;

export const FeeCollection = {
  DEDUCTED_FROM_DISBURSEMENT: 'DEDUCTED_FROM_DISBURSEMENT',
  ADDED_TO_FIRST_INSTALLMENT: 'ADDED_TO_FIRST_INSTALLMENT',
} as const;
export type FeeCollection = keyof typeof FeeCollection;

export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  SELF_EMPLOYED: 'SELF_EMPLOYED',
  CONTRACT: 'CONTRACT',
  PENSIONER: 'PENSIONER',
  OTHER: 'OTHER',
} as const;
export type EmploymentType = keyof typeof EmploymentType;

/** Banks used for payout account selection. Codes are illustrative identifiers, not integration IDs. */
export const MONGOLIAN_BANKS = [
  { code: 'KHAN', nameMn: 'Хаан банк', nameEn: 'Khan Bank' },
  { code: 'GOLOMT', nameMn: 'Голомт банк', nameEn: 'Golomt Bank' },
  { code: 'TDB', nameMn: 'Худалдаа хөгжлийн банк', nameEn: 'Trade and Development Bank' },
  { code: 'XAC', nameMn: 'ХасБанк', nameEn: 'XacBank' },
  { code: 'STATE', nameMn: 'Төрийн банк', nameEn: 'State Bank' },
  { code: 'BOGD', nameMn: 'Богд банк', nameEn: 'Bogd Bank' },
  { code: 'CAPITRON', nameMn: 'Капитрон банк', nameEn: 'Capitron Bank' },
  { code: 'ARIG', nameMn: 'Ариг банк', nameEn: 'Arig Bank' },
  { code: 'MBANK', nameMn: 'М банк', nameEn: 'M Bank' },
] as const;
