import type { Prisma } from '@prisma/client';
import type { ApplicationDto, QuoteDto } from '@orgil/shared';
import { m } from '../../common/serialize';

export type ApplicationWithRelations = Prisma.LoanApplicationGetPayload<{ include: { product: true; history: true } }> & { loan?: { id: string } | null };

export function toApplicationDto(a: ApplicationWithRelations): ApplicationDto {
  return {
    id: a.id,
    applicationNo: a.applicationNo,
    status: a.status,
    amount: m(a.amount),
    termMonths: a.termMonths,
    purpose: a.purpose,
    product: { id: a.product.id, code: a.product.code, nameMn: a.product.nameMn, nameEn: a.product.nameEn, category: a.product.category },
    quote: a.quote as unknown as QuoteDto,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    decidedAt: a.decidedAt?.toISOString() ?? null,
    decisionReason: a.status === 'REJECTED' ? a.decisionReason : null,
    infoRequest: a.status === 'INFO_REQUESTED' ? a.infoRequest : null,
    loanId: a.loan?.id ?? null,
    history: [...a.history].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()).map((h) => ({ status: h.toStatus, at: h.createdAt.toISOString(), note: h.actorType === 'USER' ? h.note : null })),
    createdAt: a.createdAt.toISOString(),
  };
}
