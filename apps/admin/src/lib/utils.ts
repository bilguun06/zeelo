import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Хүлээгдэж буй', UNDER_REVIEW: 'Хянагдаж буй', INFO_REQUESTED: 'Мэдээлэл хүссэн', APPROVED: 'Зөвшөөрсөн', REJECTED: 'Татгалзсан',
  CANCELLED: 'Цуцлагдсан', DISBURSED: 'Олгосон', COMPLETED: 'Хаагдсан', ACTIVE: 'Идэвхтэй', OVERDUE: 'Хугацаа хэтэрсэн', PAID: 'Төлөгдсөн',
  PARTIAL: 'Хэсэгчлэн', WAIVED: 'Чөлөөлсөн', WRITTEN_OFF: 'Хасагдсан', SUSPENDED: 'Түдгэлзүүлсэн', CLOSED: 'Хаасан', DRAFT: 'Ноорог',
  PAUSED: 'Түр зогсоосон', ARCHIVED: 'Архивласан', NOT_STARTED: 'Эхлээгүй', VERIFIED: 'Баталгаажсан', DISABLED: 'Идэвхгүй', SCHEDULED: 'Товлосон', SENT: 'Илгээсэн',
  CREATED: 'Үүссэн', FAILED: 'Амжилтгүй', EXPIRED: 'Хугацаа дууссан', REFUNDED: 'Буцаасан', UPLOADED: 'Оруулсан', ACCEPTED: 'Зөвшөөрсөн',
  APPROVE_RECOMMENDED: 'Зөвшөөрөхийг санал болгосон', MANUAL_REVIEW: 'Гараар хянах', DECLINE_RECOMMENDED: 'Татгалзахыг санал болгосон',
};

export const CATEGORY_LABEL: Record<string, string> = {
  CONSUMER: 'Хэрэглээний', SHORT_TERM: 'Богино хугацаат', BNPL: 'Хуваан төлөх', SALARY: 'Цалингийн', VEHICLE: 'Автомашины', BUSINESS: 'Бизнесийн',
};
