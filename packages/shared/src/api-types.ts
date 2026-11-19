/**
 * Wire types returned by the Orgil API. Monetary values are ALWAYS decimal strings
 * (e.g. "2000000.00") — never JS numbers — so no precision is lost in transit.
 */
import type {
  ApplicationStatus, EmploymentType, FeeCollection, InstallmentStatus, KycStatus, LoanCategory, LoanStatus,
  NotificationCategory, PaymentProvider, PaymentStatus, RepaymentMethod, TransactionType,
} from './enums';

export type Money = string;
export type ISODate = string;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  code?: string;
  requestId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export interface Eligibility {
  minMonthlyIncome?: Money;
  minAgeYears?: number;
  minEmploymentMonths?: number;
  requiresKyc?: boolean;
  notesMn?: string;
  notesEn?: string;
}

export interface LoanProductDto {
  id: string;
  code: string;
  category: LoanCategory;
  nameMn: string;
  nameEn: string;
  descriptionMn: string;
  descriptionEn: string;
  minAmount: Money;
  maxAmount: Money;
  amountStep: Money;
  allowedTerms: number[];
  monthlyInterestRate: string;
  serviceFeePercent: string;
  serviceFeeFixed: Money;
  feeCollection: FeeCollection;
  repaymentMethod: RepaymentMethod;
  penaltyRateDaily: string;
  eligibility: Eligibility;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  isAuthorized: boolean;
}

export interface ScheduleLineDto {
  installmentNo: number;
  dueDate: ISODate;
  principal: Money;
  interest: Money;
  fee: Money;
  payment: Money;
  balanceAfter: Money;
}

export interface QuoteDto {
  principal: Money;
  termMonths: number;
  monthlyInterestRate: string;
  totalInterest: Money;
  serviceFee: Money;
  netDisbursement: Money;
  totalRepayment: Money;
  firstPayment: Money;
  lastPayment: Money;
  monthlyPayment: Money;
  costOfCreditPercent: string;
  apr: string;
  effectiveAnnualRate: string;
  schedule: ScheduleLineDto[];
  isDemonstration: boolean;
}

export interface UserProfileDto {
  firstName: string | null;
  lastName: string | null;
  registerNumberMasked: string | null;
  dateOfBirth: ISODate | null;
  email: string | null;
  address: string | null;
  employerName: string | null;
  employmentType: EmploymentType | null;
  jobTitle: string | null;
  monthlyIncome: Money | null;
  monthlyObligations: Money | null;
  employmentStartDate: ISODate | null;
  kycStatus: KycStatus;
}

export interface NotificationPrefs {
  push: boolean;
  sms: boolean;
  email: boolean;
  repaymentReminders: boolean;
  marketing: boolean;
}

export interface MeDto {
  id: string;
  phone: string;
  language: 'mn' | 'en';
  biometricEnabled: boolean;
  createdAt: ISODate;
  profile: UserProfileDto;
  notificationPrefs: NotificationPrefs;
  creditLimit: { limit: Money; available: Money; used: Money; isIndicative: boolean };
}

export interface BankAccountDto {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumberMasked: string;
  accountHolder: string;
  isPrimary: boolean;
}

export interface ApplicationDto {
  id: string;
  applicationNo: string;
  status: ApplicationStatus;
  amount: Money;
  termMonths: number;
  purpose: string | null;
  product: Pick<LoanProductDto, 'id' | 'code' | 'nameMn' | 'nameEn' | 'category'>;
  quote: QuoteDto;
  submittedAt: ISODate | null;
  decidedAt: ISODate | null;
  decisionReason: string | null;
  infoRequest: string | null;
  loanId: string | null;
  history: { status: ApplicationStatus; at: ISODate; note: string | null }[];
  createdAt: ISODate;
}

export interface ScheduleItemDto {
  id: string;
  installmentNo: number;
  dueDate: ISODate;
  principalDue: Money;
  interestDue: Money;
  feeDue: Money;
  penaltyDue: Money;
  totalDue: Money;
  totalPaid: Money;
  remaining: Money;
  status: InstallmentStatus;
  paidAt: ISODate | null;
}

export interface RepaymentDto {
  id: string;
  receiptNo: string;
  amount: Money;
  principalPart: Money;
  interestPart: Money;
  feePart: Money;
  penaltyPart: Money;
  paidAt: ISODate;
  provider: PaymentProvider;
  sandbox: boolean;
}

export interface LoanDto {
  id: string;
  loanNo: string;
  status: LoanStatus;
  product: Pick<LoanProductDto, 'id' | 'nameMn' | 'nameEn' | 'category'>;
  principal: Money;
  outstandingPrincipal: Money;
  totalOutstanding: Money;
  payoffAmount: Money;
  interestPaid: Money;
  monthlyInterestRate: string;
  termMonths: number;
  disbursedAt: ISODate;
  maturityDate: ISODate;
  nextDue: { date: ISODate; amount: Money; installmentNo: number } | null;
  paidInstallments: number;
  progress: number;
}

export interface LoanDetailDto extends LoanDto {
  schedule: ScheduleItemDto[];
  repayments: RepaymentDto[];
}

export interface PaymentIntentDto {
  id: string;
  loanId: string;
  amount: Money;
  provider: PaymentProvider;
  status: PaymentStatus;
  qrText: string | null;
  deeplinks: { name: string; link: string }[];
  expiresAt: ISODate;
  sandbox: boolean;
  repaymentId: string | null;
}

export interface TransactionDto {
  id: string;
  txnNo: string;
  type: TransactionType;
  direction: 'DEBIT' | 'CREDIT';
  amount: Money;
  description: string;
  loanNo: string | null;
  createdAt: ISODate;
}

export interface NotificationDto {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface DashboardDto {
  creditLimit: MeDto['creditLimit'];
  activeLoans: LoanDto[];
  nextRepayment: { loanId: string; loanNo: string; date: ISODate; amount: Money } | null;
  totalOutstanding: Money;
  recentTransactions: TransactionDto[];
  openApplications: ApplicationDto[];
  unreadNotifications: number;
  overview: { month: string; repaid: Money; borrowed: Money }[];
}

export interface CreditFactorDto {
  key: string;
  labelMn: string;
  labelEn: string;
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  points: number;
  detail: string;
}

export interface CreditAssessmentDto {
  id: string;
  score: number;
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'E';
  probabilityOfDefault: string;
  recommendation: 'APPROVE_RECOMMENDED' | 'MANUAL_REVIEW' | 'DECLINE_RECOMMENDED';
  debtToIncome: string;
  factors: CreditFactorDto[];
  policyChecks: { key: string; passed: boolean; detail: string }[];
  fraudFlags: { key: string; severity: 'LOW' | 'MEDIUM' | 'HIGH'; detail: string }[];
  modelVersion: string;
  dataSource: 'SIMULATED' | 'BUREAU';
  requiresHumanDecision: true;
  createdAt: ISODate;
}
