-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'SELF_EMPLOYED', 'CONTRACT', 'PENSIONER', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_FRONT', 'ID_BACK', 'SELFIE', 'INCOME_PROOF', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LoanCategory" AS ENUM ('CONSUMER', 'SHORT_TERM', 'BNPL', 'SALARY', 'VEHICLE', 'BUSINESS');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RepaymentMethod" AS ENUM ('ANNUITY', 'EQUAL_PRINCIPAL', 'BULLET');

-- CreateEnum
CREATE TYPE "FeeCollection" AS ENUM ('DEDUCTED_FROM_DISBURSEMENT', 'ADDED_TO_FIRST_INSTALLMENT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'DISBURSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'INFO_REQUESTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'COMPLETED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('SANDBOX', 'QPAY', 'SOCIALPAY', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DISBURSEMENT', 'REPAYMENT', 'FEE', 'PENALTY', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TxnDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('LOANS_RECEIVABLE', 'INTEREST_RECEIVABLE', 'CASH_CLEARING', 'INTEREST_INCOME', 'FEE_INCOME', 'PENALTY_INCOME', 'CUSTOMER_PAYABLE');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('LOAN_APPROVED', 'LOAN_REJECTED', 'INFO_REQUESTED', 'LOAN_DISBURSED', 'REPAYMENT_REMINDER', 'PAYMENT_SUCCESS', 'DUE_SOON', 'ANNOUNCEMENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'ACTIVE_BORROWERS', 'OVERDUE_BORROWERS');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "RiskGrade" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "CreditRecommendation" AS ENUM ('APPROVE_RECOMMENDED', 'MANUAL_REVIEW', 'DECLINE_RECOMMENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(16) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "language" VARCHAR(5) NOT NULL DEFAULT 'mn',
    "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notificationPrefs" JSONB NOT NULL DEFAULT '{"push":true,"sms":true,"email":false,"repaymentReminders":true,"marketing":false}',
    "phoneVerifiedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" VARCHAR(60),
    "lastName" VARCHAR(60),
    "registerNumberEnc" TEXT,
    "registerNumberHash" TEXT,
    "registerNumberLast4" VARCHAR(4),
    "dateOfBirth" DATE,
    "email" VARCHAR(160),
    "address" VARCHAR(250),
    "employerName" VARCHAR(120),
    "employmentType" "EmploymentType",
    "jobTitle" VARCHAR(80),
    "monthlyIncome" DECIMAL(18,2),
    "monthlyObligations" DECIMAL(18,2),
    "employmentStartDate" DATE,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "kycVerifiedAt" TIMESTAMP(3),
    "kycReviewedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_documents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "reviewNote" TEXT,
    "reviewedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "accountNumberEnc" TEXT NOT NULL,
    "accountNumberHash" TEXT NOT NULL,
    "accountLast4" VARCHAR(4) NOT NULL,
    "accountHolder" VARCHAR(120) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceName" VARCHAR(120),
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(255),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "category" "LoanCategory" NOT NULL,
    "nameMn" VARCHAR(80) NOT NULL,
    "nameEn" VARCHAR(80) NOT NULL,
    "descriptionMn" VARCHAR(500) NOT NULL DEFAULT '',
    "descriptionEn" VARCHAR(500) NOT NULL DEFAULT '',
    "minAmount" DECIMAL(18,2) NOT NULL,
    "maxAmount" DECIMAL(18,2) NOT NULL,
    "amountStep" DECIMAL(18,2) NOT NULL DEFAULT 10000,
    "allowedTerms" INTEGER[],
    "monthlyInterestRate" DECIMAL(9,4) NOT NULL,
    "serviceFeePercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "serviceFeeFixed" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feeCollection" "FeeCollection" NOT NULL DEFAULT 'DEDUCTED_FROM_DISBURSEMENT',
    "repaymentMethod" "RepaymentMethod" NOT NULL DEFAULT 'ANNUITY',
    "penaltyRateDaily" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "isAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "applicationNo" VARCHAR(20) NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "bankAccountId" UUID,
    "amount" DECIMAL(18,2) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "purpose" VARCHAR(200),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "applicantSnapshot" JSONB NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "quote" JSONB NOT NULL,
    "decisionReason" TEXT,
    "infoRequest" TEXT,
    "assignedAdminId" UUID,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_approvals" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "approvedAmount" DECIMAL(18,2),
    "approvedTermMonths" INTEGER,
    "reason" TEXT NOT NULL,
    "creditScoreId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_notes" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_history" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "applicationId" UUID,
    "score" INTEGER NOT NULL,
    "riskGrade" "RiskGrade" NOT NULL,
    "probabilityOfDefault" DECIMAL(7,4) NOT NULL,
    "debtToIncome" DECIMAL(7,4) NOT NULL,
    "recommendation" "CreditRecommendation" NOT NULL,
    "factors" JSONB NOT NULL,
    "policyChecks" JSONB NOT NULL,
    "fraudFlags" JSONB NOT NULL,
    "modelVersion" VARCHAR(40) NOT NULL,
    "dataSource" VARCHAR(20) NOT NULL DEFAULT 'SIMULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_contracts" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "templateVersion" VARCHAR(20) NOT NULL,
    "body" TEXT NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedIp" VARCHAR(64),
    "acceptedUserAgent" VARCHAR(255),
    "signatureMethod" VARCHAR(30) NOT NULL DEFAULT 'IN_APP_CONSENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "loanNo" VARCHAR(20) NOT NULL,
    "userId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "monthlyInterestRate" DECIMAL(9,4) NOT NULL,
    "serviceFee" DECIMAL(18,2) NOT NULL,
    "feeCollection" "FeeCollection" NOT NULL,
    "penaltyRateDaily" DECIMAL(9,4) NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "repaymentMethod" "RepaymentMethod" NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "outstandingPrincipal" DECIMAL(18,2) NOT NULL,
    "disbursedAt" TIMESTAMP(3) NOT NULL,
    "maturityDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedules" (
    "id" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalDue" DECIMAL(18,2) NOT NULL,
    "interestDue" DECIMAL(18,2) NOT NULL,
    "feeDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penaltyDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "feePaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penaltyPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestWaived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" UUID NOT NULL,
    "receiptNo" VARCHAR(24) NOT NULL,
    "loanId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "paymentIntentId" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(18,2) NOT NULL,
    "principalPart" DECIMAL(18,2) NOT NULL,
    "interestPart" DECIMAL(18,2) NOT NULL,
    "feePart" DECIMAL(18,2) NOT NULL,
    "penaltyPart" DECIMAL(18,2) NOT NULL,
    "interestWaived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "allocation" JSONB NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_intents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "providerRef" VARCHAR(120),
    "qrText" TEXT,
    "deeplinks" JSONB,
    "callbackCount" INTEGER NOT NULL DEFAULT 0,
    "lastCallback" JSONB,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "txnNo" VARCHAR(24) NOT NULL,
    "userId" UUID NOT NULL,
    "loanId" UUID,
    "type" "TransactionType" NOT NULL,
    "direction" "TxnDirection" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "referenceType" VARCHAR(40),
    "referenceId" UUID,
    "journalId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_lines" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "titleMn" VARCHAR(120) NOT NULL,
    "bodyMn" VARCHAR(1000) NOT NULL,
    "titleEn" VARCHAR(120) NOT NULL,
    "bodyEn" VARCHAR(1000) NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "titleMn" VARCHAR(120) NOT NULL,
    "bodyMn" VARCHAR(1000) NOT NULL,
    "titleEn" VARCHAR(120) NOT NULL,
    "bodyEn" VARCHAR(1000) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "titleMn" VARCHAR(120) NOT NULL,
    "bodyMn" VARCHAR(1000) NOT NULL,
    "titleEn" VARCHAR(120) NOT NULL,
    "bodyEn" VARCHAR(1000) NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" TEXT,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(255),
    "requestId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "description" VARCHAR(255) NOT NULL DEFAULT '',
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_registerNumberHash_key" ON "user_profiles"("registerNumberHash");

-- CreateIndex
CREATE INDEX "user_profiles_kycStatus_idx" ON "user_profiles"("kycStatus");

-- CreateIndex
CREATE INDEX "user_documents_userId_type_idx" ON "user_documents"("userId", "type");

-- CreateIndex
CREATE INDEX "user_documents_sha256_idx" ON "user_documents"("sha256");

-- CreateIndex
CREATE INDEX "bank_accounts_userId_idx" ON "bank_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_userId_accountNumberHash_key" ON "bank_accounts"("userId", "accountNumberHash");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key" ON "user_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE INDEX "loan_products_status_isAuthorized_idx" ON "loan_products"("status", "isAuthorized");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_applicationNo_key" ON "loan_applications"("applicationNo");

-- CreateIndex
CREATE INDEX "loan_applications_userId_status_idx" ON "loan_applications"("userId", "status");

-- CreateIndex
CREATE INDEX "loan_applications_status_createdAt_idx" ON "loan_applications"("status", "createdAt");

-- CreateIndex
CREATE INDEX "loan_approvals_applicationId_idx" ON "loan_approvals"("applicationId");

-- CreateIndex
CREATE INDEX "application_notes_applicationId_idx" ON "application_notes"("applicationId");

-- CreateIndex
CREATE INDEX "application_history_applicationId_createdAt_idx" ON "application_history"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_scores_userId_createdAt_idx" ON "credit_scores"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_scores_applicationId_idx" ON "credit_scores"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_contracts_applicationId_key" ON "digital_contracts"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "loans_loanNo_key" ON "loans"("loanNo");

-- CreateIndex
CREATE UNIQUE INDEX "loans_applicationId_key" ON "loans"("applicationId");

-- CreateIndex
CREATE INDEX "loans_userId_status_idx" ON "loans"("userId", "status");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loan_schedules_dueDate_status_idx" ON "loan_schedules"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "loan_schedules_loanId_installmentNo_key" ON "loan_schedules"("loanId", "installmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_receiptNo_key" ON "loan_repayments"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_paymentIntentId_key" ON "loan_repayments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "loan_repayments_loanId_paidAt_idx" ON "loan_repayments"("loanId", "paidAt");

-- CreateIndex
CREATE INDEX "loan_repayments_paidAt_idx" ON "loan_repayments"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotencyKey_key" ON "payment_intents"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_intents_status_expiresAt_idx" ON "payment_intents"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_provider_providerRef_key" ON "payment_intents"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txnNo_key" ON "transactions"("txnNo");

-- CreateIndex
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_type_createdAt_idx" ON "transactions"("type", "createdAt");

-- CreateIndex
CREATE INDEX "journal_entries_reference_idx" ON "journal_entries"("reference");

-- CreateIndex
CREATE INDEX "ledger_lines_account_createdAt_idx" ON "ledger_lines"("account", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_lines_loanId_idx" ON "ledger_lines"("loanId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "announcements_status_scheduledAt_idx" ON "announcements"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorType_actorId_idx" ON "audit_logs"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_history" ADD CONSTRAINT "application_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_contracts" ADD CONSTRAINT "digital_contracts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_contracts" ADD CONSTRAINT "digital_contracts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "payment_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
