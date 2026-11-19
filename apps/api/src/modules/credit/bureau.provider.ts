import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

export interface BureauReport {
  monthlyDebtService: string;
  delinquencies12m: number;
  inquiries30d: number;
  source: 'SIMULATED' | 'BUREAU';
}

/**
 * SIMULATED credit bureau. Orgil has NO access to the Mongolbank Credit Information Bureau (ЗМС)
 * or any private bureau. This returns deterministic synthetic data derived from a hash so the same
 * customer always gets the same report during development. Every assessment stores
 * dataSource="SIMULATED" and the admin UI labels it clearly.
 *
 * Integration point: implement a BureauClient against the authorized bureau API once a data-sharing
 * agreement and customer consent flow are in place.
 */
@Injectable()
export class SimulatedBureauProvider {
  async report(subjectKey: string): Promise<BureauReport> {
    const h = createHash('sha256').update(`bureau:${subjectKey}`).digest();
    const delinquencies = h[0] % 10 === 0 ? 1 + (h[1] % 2) : 0; // ~10% have delinquencies
    const debt = (h[2] % 4) * 150_000; // 0–450k monthly debt service
    return { monthlyDebtService: `${debt}.00`, delinquencies12m: delinquencies, inquiries30d: h[3] % 5, source: 'SIMULATED' };
  }
}
