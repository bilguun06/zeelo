import { z } from 'zod';

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be ≥32 chars'),
  JWT_ADMIN_SECRET: z.string().min(32, 'JWT_ADMIN_SECRET must be ≥32 chars'),
  ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 bytes base64'),
  HMAC_KEY: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),
  ADMIN_TOKEN_TTL_SECONDS: z.coerce.number().int().default(1800),
  OTP_DEV_ECHO: bool,
  SMS_PROVIDER: z.string().default('mock'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(8),
  PAYMENT_SANDBOX_ENABLED: bool,
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  QPAY_BASE_URL: z.string().optional(),
  QPAY_USERNAME: z.string().optional(),
  QPAY_PASSWORD: z.string().optional(),
  QPAY_INVOICE_CODE: z.string().optional(),
  SOCIALPAY_BASE_URL: z.string().optional(),
  SOCIALPAY_TERMINAL: z.string().optional(),
  SOCIALPAY_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validates process.env once at boot. Fails fast with a readable message. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const value = parsed.data;
  if (value.NODE_ENV === 'production') {
    // Safety rails: development conveniences can never be active in production.
    value.OTP_DEV_ECHO = false;
    value.PAYMENT_SANDBOX_ENABLED = false;
  }
  cached = value;
  return value;
}
