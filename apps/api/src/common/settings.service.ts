import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Typed runtime configuration editable from the admin dashboard (system_settings table).
 * Defaults below are DEVELOPMENT PLACEHOLDERS and must be reviewed against the provider's
 * credit policy and applicable Mongolbank / FRC regulations before production use.
 */
export const SETTING_DEFAULTS = {
  'credit.max_dti': { value: '0.55', description: 'Max debt-to-income ratio (policy hard rule). Confirm against current regulation.' },
  'credit.min_age_years': { value: 18, description: 'Legal minimum borrower age' },
  'credit.default_indicative_limit': { value: '5000000.00', description: 'Indicative limit shown before income data is available' },
  'credit.limit_cap': { value: '5000000.00', description: 'Upper cap for indicative credit limit' },
  'credit.limit_income_multiple': { value: '3', description: 'Indicative limit = disposable income × multiple' },
  'loans.penalty_cap_percent': { value: '20', description: 'Penalty cap as % of overdue amount. Requires legal review.' },
  'loans.reminder_days_before': { value: 3, description: 'Days before due date to send reminder' },
  'payments.intent_ttl_minutes': { value: 30, description: 'Payment invoice validity' },
  'support.phone': { value: '7700-0000', description: 'Customer support phone shown in app' },
  'contract.template_version': { value: '2026.1', description: 'Active loan agreement template version' },
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: unknown; at: number }>();
  constructor(private readonly prisma: PrismaService) {}

  async get<T = unknown>(key: SettingKey): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.value as T;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    const value = (row?.value ?? SETTING_DEFAULTS[key].value) as T;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async all() {
    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r]));
    return (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => ({
      key,
      value: map.get(key)?.value ?? SETTING_DEFAULTS[key].value,
      description: SETTING_DEFAULTS[key].description,
      updatedAt: map.get(key)?.updatedAt ?? null,
    }));
  }

  async set(key: SettingKey, value: unknown, adminId: string) {
    this.cache.delete(key);
    return this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as never, description: SETTING_DEFAULTS[key].description, updatedBy: adminId },
      update: { value: value as never, updatedBy: adminId },
    });
  }
}
