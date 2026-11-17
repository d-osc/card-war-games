import { prisma } from '../db';
import { LedgerType } from '@cardwar/shared';

/** บันทึกทุกการไหลของเงิน/การ์ดเข้าระบบบัญชีปิดวงจร */
export async function recordLedger(entry: {
  type: LedgerType;
  userId?: number | null;
  templateId?: string | null;
  serial?: number | null;
  gold?: number | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.ledger.create({
    data: {
      type: entry.type,
      userId: entry.userId ?? null,
      templateId: entry.templateId ?? null,
      serial: entry.serial ?? null,
      gold: entry.gold ?? null,
      meta: entry.meta ? JSON.stringify(entry.meta) : null,
    },
  });
}
