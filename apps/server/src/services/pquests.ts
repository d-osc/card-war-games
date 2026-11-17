// ===========================================================================
// เควสต์ที่ผู้เล่นสร้างเอง — ระบุการ์ดที่ต้องการ + รางวัลทอง/XP ต่อใบ
// เงินรางวัลถูกฝากไว้กับระบบ (escrow) ส่วนค่ารางวัล XP จ่ายเป็นทองตอนตั้งเควสต์
// ===========================================================================
import { cardById, CardTemplate, PLAYER_QUEST_FEE_RATE, PLAYER_QUEST_MAX_QTY, PLAYER_QUEST_MAX_XP_PER_UNIT, PLAYER_QUEST_XP_GOLD_RATE, tryCardById } from '@cardwar/shared';
import type { Character, PlayerQuest } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';
import { recordLedger } from './ledger';
import { grantXp } from './characters';

export interface PlayerQuestView {
  id: number;
  creatorName: string;
  isMine: boolean;
  wanted: CardTemplate;
  quantity: number;
  delivered: number;
  remaining: number;
  goldPerUnit: number;
  xpPerUnit: number;
  totalReward: number;
  status: string;
  createdAt: string;
}

function view(q: PlayerQuest, viewerId: number): PlayerQuestView {
  return {
    id: q.id,
    creatorName: q.creatorName,
    isMine: q.creatorId === viewerId,
    wanted: cardById(q.templateId),
    quantity: q.quantity,
    delivered: q.delivered,
    remaining: Math.max(0, q.quantity - q.delivered),
    goldPerUnit: q.goldPerUnit,
    xpPerUnit: q.xpPerUnit,
    totalReward: q.quantity * q.goldPerUnit,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  };
}

export async function listPlayerQuests(viewerId: number, mine = false): Promise<PlayerQuestView[]> {
  const rows = mine
    ? await prisma.playerQuest.findMany({ where: { creatorId: viewerId }, orderBy: { createdAt: 'desc' } })
    : await prisma.playerQuest.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 60 });
  return rows.map((q) => view(q, viewerId));
}

export async function createPlayerQuest(char: Character, templateId: string, quantity: number, goldPerUnit: number, xpPerUnit = 0): Promise<PlayerQuestView> {
  const t = tryCardById(templateId);
  if (!t) throw new AppError('ไม่พบชนิดการ์ดนี้ในแค็ตตาล็อก');
  quantity = Math.floor(quantity);
  goldPerUnit = Math.floor(goldPerUnit);
  xpPerUnit = Math.floor(xpPerUnit);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > PLAYER_QUEST_MAX_QTY) {
    throw new AppError(`จำนวนที่ต้องการต้องอยู่ระหว่าง 1-${PLAYER_QUEST_MAX_QTY} ใบ`);
  }
  if (!Number.isFinite(goldPerUnit) || goldPerUnit < t.basePrice) {
    throw new AppError(`รางวัลต่อใบต้องไม่ต่ำกว่าราคาฐานของระบบ (${t.basePrice} ทอง)`);
  }
  if (!Number.isFinite(xpPerUnit) || xpPerUnit < 0 || xpPerUnit > PLAYER_QUEST_MAX_XP_PER_UNIT) {
    throw new AppError(`รางวัล XP ต่อใบต้องอยู่ระหว่าง 0-${PLAYER_QUEST_MAX_XP_PER_UNIT}`);
  }
  const total = quantity * goldPerUnit;
  const fee = Math.ceil(total * PLAYER_QUEST_FEE_RATE);
  // ค่ารางวัล XP — แปลงเป็นทอง (1 ทอง = 10 XP) แล้วหักตอนตั้ง (ถ้ายกเลิกจะคืนตามส่วนที่เหลือ)
  const xpCost = Math.ceil(xpPerUnit * quantity * PLAYER_QUEST_XP_GOLD_RATE);
  const charge = total + fee + xpCost;
  if (char.gold < charge) {
    throw new AppError(`ทองไม่พอ — ต้องฝากรางวัล ${total} + ค่าธรรมเนียม ${fee} + ค่ารางวัล XP ${xpCost} = ${charge} ทอง`);
  }
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - charge } });
  const quest = await prisma.playerQuest.create({
    data: {
      creatorId: char.userId,
      creatorName: char.name,
      templateId,
      quantity,
      goldPerUnit,
      xpPerUnit,
      escrowGold: total,
      feePaid: fee + xpCost,
    },
  });
  await recordLedger({ type: 'PLAYER_QUEST_CREATE', userId: char.userId, templateId, gold: -charge, meta: { questId: quest.id, escrow: total, fee, xpCost, xpPerUnit } });
  return view(quest, char.userId);
}

/** ผู้เล่นคนอื่นส่งมอบการ์ดตามเควสต์ — ได้รางวัลจากเงินฝากทันที การ์ดส่งตรงถึงผู้ตั้งเควสต์ */
export async function deliverPlayerQuest(char: Character, questId: number, serials: number[]): Promise<{ payout: number; xpGained: number; delivered: number }> {
  const q = await prisma.playerQuest.findUnique({ where: { id: questId } });
  if (!q || q.status !== 'OPEN') throw new AppError('เควสต์นี้ปิดรับส่งมอบแล้ว');
  if (q.creatorId === char.userId) throw new AppError('ส่งมอบเควสต์ของตัวเองไม่ได้');
  const remaining = q.quantity - q.delivered;
  if (serials.length < 1) throw new AppError('เลือกการ์ดอย่างน้อย 1 ใบ');
  if (serials.length > remaining) throw new AppError(`เควสต์รับเพิ่มได้อีก ${remaining} ใบเท่านั้น`);
  const uniq = [...new Set(serials)];
  if (uniq.length !== serials.length) throw new AppError('มีการ์ดซ้ำในรายการ');
  const instances = [];
  for (const serial of serials) {
    const inst = await prisma.cardInstance.findUnique({ where: { id: serial } });
    if (!inst || inst.ownerId !== char.userId || inst.status !== 'INVENTORY') {
      throw new AppError(`การ์ด #${serial} ไม่อยู่ในคลังของคุณ`);
    }
    if (inst.templateId !== q.templateId) {
      throw new AppError(`การ์ด #${serial} ไม่ใช่ "${cardById(q.templateId).name}" ที่เควสต์ต้องการ`);
    }
    instances.push(inst);
  }
  const payout = instances.length * q.goldPerUnit;
  // โอนการ์ดให้ผู้ตั้งเควสต์
  for (const inst of instances) {
    await prisma.cardInstance.update({ where: { id: inst.id }, data: { ownerId: q.creatorId, status: 'INVENTORY' } });
  }
  // จ่ายรางวัลจากเงินฝาก + XP จากระบบ (ค่า XP ผู้ตั้งจ่ายไปแล้วตอนตั้งเควสต์)
  const xpGained = q.xpPerUnit * instances.length;
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + payout } });
  if (xpGained > 0) await grantXp(char, xpGained);
  const delivered = q.delivered + instances.length;
  await prisma.playerQuest.update({
    where: { id: q.id },
    data: { delivered, escrowGold: q.escrowGold - payout, status: delivered >= q.quantity ? 'DONE' : 'OPEN' },
  });
  await recordLedger({
    type: 'PLAYER_QUEST_DELIVER',
    userId: char.userId,
    templateId: q.templateId,
    gold: payout,
    meta: { questId: q.id, count: instances.length, serials: instances.map((i) => i.id), toCreator: q.creatorId, xpGained },
  });
  return { payout, xpGained, delivered };
}

export async function cancelPlayerQuest(char: Character, questId: number): Promise<{ refund: number }> {
  const q = await prisma.playerQuest.findUnique({ where: { id: questId } });
  if (!q || q.creatorId !== char.userId) throw new AppError('ไม่พบเควสต์ของคุณ');
  if (q.status !== 'OPEN') throw new AppError('เควสต์นี้ปิดไปแล้ว');
  // คืนเงินฝาก + ค่ารางวัล XP ของส่วนที่ยังไม่ถูกส่งมอบ (1 ทอง = 10 XP)
  const xpRefund = Math.ceil(q.xpPerUnit * (q.quantity - q.delivered) * PLAYER_QUEST_XP_GOLD_RATE);
  const refund = q.escrowGold + xpRefund;
  if (refund > 0) {
    await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + refund } });
    await recordLedger({ type: 'PLAYER_QUEST_REFUND', userId: char.userId, gold: refund, meta: { questId: q.id, escrow: q.escrowGold, xpRefund } });
  }
  await prisma.playerQuest.update({ where: { id: q.id }, data: { status: 'CANCELLED', escrowGold: 0 } });
  return { refund };
}
