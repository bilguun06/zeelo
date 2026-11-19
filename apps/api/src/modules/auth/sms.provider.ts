import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

export interface SmsProvider {
  send(phone: string, text: string): Promise<void>;
}

/**
 * Development SMS provider: logs instead of sending. Replace with a contracted Mongolian
 * SMS gateway (e.g. operator API) by implementing SmsProvider — no real gateway is wired here.
 */
@Injectable()
export class SmsService implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string): Promise<void> {
    if (env().SMS_PROVIDER !== 'mock') {
      throw new Error(`SMS provider "${env().SMS_PROVIDER}" is not implemented. Configure a contracted gateway.`);
    }
    // Never log OTPs in production.
    if (env().NODE_ENV !== 'production') this.logger.log(`[mock] → ${phone}: ${text}`);
  }
}
