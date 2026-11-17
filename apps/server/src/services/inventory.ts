import {
  cardById, DECK_MIN, DESTROY_REFUND_RATE, EQUIP_SLOTS, PET_EQUIP_MAX, RARITY_MAX_SUPPLY, Rarity,
  TOOL_REPAIR_GOLD_PER_TIER, isDeckable, LedgerType, SYSTEM_SHOP_MARKUP, toolMaxDurability,
} from '@cardwar/shared';
import type { CardInstance as PCardInstance, Character } from '@prisma/client';
import { prisma } from '../db';
import { recordLedger } from './ledger';
import { syncEnergy } from './characters';
import { AppError } from '../errors';

/** ระบบออกการ์ดใหม่ (mint) — ใช้ทุกที่ที่การ์ดเกิดขึ้น: drop/กาชา/craft/รางวัล
 *  มีโควตาการผลิตตามความหายาก (RARITY_MAX_SUPPLY) — เต็มแล้ว mint ไม่ได้ */
export async function mintCard(templateId: string, userId: number, source: LedgerType, meta?: Record<string, unknown>): Promise<PCardInstance> {
  const t = cardById(templateId);
  const row = await prisma.cardTemplate.findUnique({ where: { id: templateId }, select: { rarity: true } });
  const cap = RARITY_MAX_SUPPLY[(row?.rarity ?? t.rarity) as Rarity] ?? Infinity;
  // เพิ่ม counter แบบมีเงื่อนไข (atomic) — ถ้าใครแซงเข้ามาก่อนจนเต็มโควตา จะไม่มีการ์ดเกิด
  const bumped = await prisma.cardTemplate.updateMany({
    where: { id: templateId, minted: { lt: cap } },
    data: { minted: { increment: 1 } },
  });
  if (bumped.count === 0) {
    throw new AppError(`"${t.name}" ครบโควตาการผลิตแล้ว (${cap.toLocaleString('th-TH')} ใบ) — หาได้จากผู้เล่นคนอื่นเท่านั้น`, 409);
  }
  const inst = await prisma.cardInstance.create({
    data: {
      templateId, ownerId: userId, status: 'INVENTORY',
      // เครื่องมือเกิดมาพร้อมความทนทานเต็มตามเกรด
      ...(t.group === 'tool' ? { durability: toolMaxDurability(t.tier) } : {}),
    },
  });
  await recordLedger({ type: 'MINT_CARD', userId, templateId, serial: inst.id, meta: { ...meta ?? {}, source } });
  return inst;
}

/** ซ่อมเครื่องมือแบบรวดเดียว (จ่าย + ซ่อมพร้อมกัน — ใช้กับ "ซ่อมทั้งหมด" / ซ่อมด่วนไม่เล่นมินิเกม)
 *  ปริมาณที่ซ่อมได้ขึ้นกับ hits (0-10): ซ่อมได้ = round(ความทนทานเต็ม × hits ÷ 10) */
export async function repairTool(userId: number, serial: number, char: Character, hits = 10): Promise<{ durability: number; cost: number; gain: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY', 'EQUIPPED']);
  const t = cardById(inst.templateId);
  if (t.group !== 'tool') throw new AppError('ซ่อมได้เฉพาะการ์ดเครื่องมือ');
  const max = toolMaxDurability(t.tier);
  const current = inst.durability ?? max;
  if (current >= max) throw new AppError('เครื่องมือนี้ยังสภาพดี ไม่ต้องซ่อม');
  const safeHits = Math.max(0, Math.min(10, Math.floor(hits)));
  const gain = Math.min(max - current, Math.round((max * safeHits) / 10));
  if (gain <= 0) throw new AppError('ตีไม่โดนเลย… ช่างมือไม้ไปเลย — ไม่คิดค่าซ่อม ลองอีกครั้ง');
  const cost = t.tier * TOOL_REPAIR_GOLD_PER_TIER;
  if (char.gold < cost) throw new AppError(`ทองไม่พอซ่อม (ต้องใช้ ${cost})`);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { durability: current + gain } });
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - cost } });
  await recordLedger({ type: 'TOOL_REPAIR', userId, templateId: t.id, serial: inst.id, gold: -cost, meta: { from: current, to: current + gain, hits: safeHits } });
  return { durability: current + gain, cost, gain };
}

/** จ่ายค่าซ่อมก่อนเข้ามินิเกม — หักทองทันที (เสียแล้วเสียเลย ตีไม่โดนไม่คืน) */
export async function payRepairTool(userId: number, serial: number, char: Character): Promise<{ cost: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY', 'EQUIPPED']);
  const t = cardById(inst.templateId);
  if (t.group !== 'tool') throw new AppError('ซ่อมได้เฉพาะการ์ดเครื่องมือ');
  const max = toolMaxDurability(t.tier);
  if ((inst.durability ?? max) >= max) throw new AppError('เครื่องมือนี้ยังสภาพดี ไม่ต้องซ่อม');
  const cost = t.tier * TOOL_REPAIR_GOLD_PER_TIER;
  if (char.gold < cost) throw new AppError(`ทองไม่พอซ่อม (ต้องใช้ ${cost})`);
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - cost } });
  await recordLedger({ type: 'TOOL_REPAIR', userId, templateId: t.id, serial: inst.id, gold: -cost, meta: { phase: 'pay' } });
  return { cost };
}

/** นำผลมินิเกมมาซ่อม (จ่ายไปแล้วใน payRepairTool — ขั้นนี้ไม่คิดเงิน) */
export async function applyRepairTool(userId: number, serial: number, hits: number): Promise<{ durability: number; gain: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY', 'EQUIPPED']);
  const t = cardById(inst.templateId);
  if (t.group !== 'tool') throw new AppError('ซ่อมได้เฉพาะการ์ดเครื่องมือ');
  const max = toolMaxDurability(t.tier);
  const current = inst.durability ?? max;
  if (current >= max) return { durability: current, gain: 0 };
  const safeHits = Math.max(0, Math.min(10, Math.floor(hits)));
  const gain = Math.min(max - current, Math.round((max * safeHits) / 10));
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { durability: current + gain } });
  await recordLedger({ type: 'TOOL_REPAIR', userId, templateId: t.id, serial: inst.id, gold: 0, meta: { phase: 'apply', from: current, to: current + gain, hits: safeHits } });
  return { durability: current + gain, gain };
}

/** ทำลายการ์ด (ใช้/เผาวัตถุดิบ) — การ์ดกลับเข้า pool ของระบบเพื่อ drop/กาชาใหม่ */
export async function burnCard(inst: PCardInstance, type: LedgerType = 'BURN_CARD', meta?: Record<string, unknown>): Promise<void> {
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'DESTROYED', ownerId: null, slot: null } });
  await prisma.cardTemplate.update({ where: { id: inst.templateId }, data: { burned: { increment: 1 } } });
  await recordLedger({ type, userId: inst.ownerId, templateId: inst.templateId, serial: inst.id, meta });
}

async function requireOwnedInstance(userId: number, serial: number, statuses: string[]): Promise<PCardInstance> {
  const inst = await prisma.cardInstance.findUnique({ where: { id: serial } });
  if (!inst || inst.ownerId !== userId) throw new AppError('ไม่พบการ์ดนี้ในคลังของคุณ');
  if (!statuses.includes(inst.status)) throw new AppError('การ์ดนี้อยู่ในสถานะที่ทำรายการนี้ไม่ได้');
  return inst;
}

// ---------------------------------------------------------------------------
// สวมใส่ / ถอด
// ---------------------------------------------------------------------------

export async function equipCard(userId: number, serial: number): Promise<void> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY']);
  const t = cardById(inst.templateId);
  if (t.group === 'pet') {
    // สัตว์เลี้ยงสวมใส่ได้หลายตัว (ไม่ถอดตัวเดิม) จนถึง PET_EQUIP_MAX
    const petCount = await prisma.cardInstance.count({ where: { ownerId: userId, status: 'EQUIPPED', slot: 'pet' } });
    if (petCount >= PET_EQUIP_MAX) {
      throw new AppError(`สวมสัตว์เลี้ยงได้สูงสุด ${PET_EQUIP_MAX} ตัว — ถอดตัวใดตัวหนึ่งก่อน`);
    }
    await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'EQUIPPED', slot: 'pet' } });
    return;
  }
  if (t.group === 'tool') {
    // เครื่องมือสวมใส่ชนิดละ 1 ช่อง (จอบ/ขวาน) — สวมใหม่แล้วถอดตัวเดิมออกคลัง
    const current = await prisma.cardInstance.findFirst({ where: { ownerId: userId, status: 'EQUIPPED', slot: t.category } });
    if (current) {
      await prisma.cardInstance.update({ where: { id: current.id }, data: { status: 'INVENTORY', slot: null } });
    }
    await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'EQUIPPED', slot: t.category } });
    return;
  }
  if (t.group !== 'equipment' || !EQUIP_SLOTS.includes(t.category)) {
    throw new AppError('การ์ดใบนี้สวมใส่ไม่ได้');
  }
  // ถอดของเดิมในช่องนั้นออกก่อน
  const current = await prisma.cardInstance.findFirst({ where: { ownerId: userId, status: 'EQUIPPED', slot: t.category } });
  if (current) {
    await prisma.cardInstance.update({ where: { id: current.id }, data: { status: 'INVENTORY', slot: null } });
  }
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'EQUIPPED', slot: t.category } });
}

export async function unequipCard(userId: number, serial: number): Promise<void> {
  const inst = await requireOwnedInstance(userId, serial, ['EQUIPPED']);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'INVENTORY', slot: null } });
}

// ---------------------------------------------------------------------------
// เดค
// ---------------------------------------------------------------------------

export async function addToDeck(userId: number, serial: number): Promise<void> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY']);
  const t = cardById(inst.templateId);
  if (!isDeckable(t)) throw new AppError('การ์ดใบนี้เข้าเดคไม่ได้ — เดครับเฉพาะการ์ดสกิล ยา/อาหาร (สัตว์เลี้ยงให้สวมใส่)');
  // กติกาใหม่: เดคไม่จำกัดจำนวนใบ และใส่การ์ดชนิดเดียวกันซ้ำได้ไม่จำกัด
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'IN_DECK', slot: null } });
}

export async function removeFromDeck(userId: number, serial: number): Promise<void> {
  const inst = await requireOwnedInstance(userId, serial, ['IN_DECK']);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'INVENTORY', slot: null } });
}

/** เดคต้องมีขั้นต่ำ DECK_MIN ใบจึงจะเข้าต่อสู้ได้ (ไม่จำกัดจำนวนสูงสุด) */
export async function requireDeck(userId: number): Promise<string[]> {
  const deck = await prisma.cardInstance.findMany({
    where: { ownerId: userId, status: 'IN_DECK' },
    orderBy: { id: 'asc' },
  });
  if (deck.length < DECK_MIN) {
    throw new AppError(`เดคต้องมีอย่างน้อย ${DECK_MIN} ใบจึงเข้าต่อสู้ได้ (ตอนนี้มี ${deck.length} ใบ — ไม่มีขีดจำกัดสูงสุด)`);
  }
  return deck.map((d) => d.templateId);
}

// ---------------------------------------------------------------------------
// ใช้การ์ดนอกสนาม (อาหาร → ฟื้นพลังงาน)
// ---------------------------------------------------------------------------

export async function useOutOfBattle(userId: number, serial: number, char: Character): Promise<{ energyGained: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY']);
  const t = cardById(inst.templateId);
  if (t.group !== 'consumable' || t.category !== 'food' || !t.consumable?.energy) {
    throw new AppError('การ์ดใบนี้ใช้ได้เฉพาะในการต่อสู้ (ยาสกิลใช้ในสนามเท่านั้น)');
  }
  const c = await syncEnergy(char);
  const gained = Math.min(t.consumable.energy, 100 - c.energy);
  if (gained <= 0) throw new AppError('พลังงานเต็มอยู่แล้ว');
  await prisma.character.update({ where: { id: c.id }, data: { energy: c.energy + gained } });
  await burnCard(inst, 'BURN_CARD', { used: 'food-energy' });
  return { energyGained: gained };
}

// ---------------------------------------------------------------------------
// ขายคืนระบบ / ทำลาย
// ---------------------------------------------------------------------------

export async function sellToSystem(userId: number, serial: number, char: Character): Promise<{ gold: number; listingId: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY']);
  const t = cardById(inst.templateId);
  const price = t.basePrice;
  const resale = Math.ceil(t.basePrice * SYSTEM_SHOP_MARKUP);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'SHOP' } });
  const listing = await prisma.shopListing.create({
    data: { instanceId: inst.id, templateId: inst.templateId, price: resale, sellerName: char.name },
  });
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + price } });
  await recordLedger({ type: 'SELL_TO_SYSTEM', userId, templateId: inst.templateId, serial: inst.id, gold: price, meta: { listingId: listing.id, resale } });
  return { gold: price, listingId: listing.id };
}

export async function destroyCard(userId: number, serial: number, char: Character): Promise<{ refund: number }> {
  const inst = await requireOwnedInstance(userId, serial, ['INVENTORY', 'IN_DECK']);
  const t = cardById(inst.templateId);
  const refund = Math.floor(t.basePrice * DESTROY_REFUND_RATE);
  await burnCard(inst, 'BURN_CARD', { by: 'player-destroy' });
  if (refund > 0) {
    await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + refund } });
    await recordLedger({ type: 'DESTROY_REFUND', userId, templateId: inst.templateId, serial: inst.id, gold: refund });
  }
  return { refund };
}
