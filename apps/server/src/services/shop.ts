import { cardById, allTemplates, GACHA_COST, rollGachaRarity, Rarity, IAP_PACKAGES, IapPackage } from '@cardwar/shared';
import type { Character } from '@prisma/client';
import { prisma } from '../db';
import { recordLedger } from './ledger';
import { mintCard } from './inventory';
import { grantXp } from './characters';
import { onQuestEvent } from './quests';
import { AppError } from '../errors';

// ---------------------------------------------------------------------------
// แพ็กพิเศษ (IAP) — ขายด้วยเงินจริง
// ---------------------------------------------------------------------------

export interface IapView extends IapPackage {
  /** ยังไม่เคยซื้อแพ็กนี้ → ได้โบนัสทองครั้งแรก */
  firstBonusLeft: boolean;
}

async function boughtPackageIds(userId: number): Promise<Set<string>> {
  const rows = await prisma.ledger.findMany({ where: { userId, type: 'IAP_PURCHASE' }, select: { meta: true } });
  const ids = new Set<string>();
  for (const r of rows) {
    try {
      const meta = JSON.parse(r.meta ?? '{}') as { packageId?: string };
      if (meta.packageId) ids.add(meta.packageId);
    } catch { /* meta เพี้ยน — ข้าม */ }
  }
  return ids;
}

export async function listIap(userId: number): Promise<IapView[]> {
  const bought = await boughtPackageIds(userId);
  return IAP_PACKAGES.map((p) => ({ ...p, firstBonusLeft: !bought.has(p.id) }));
}

/**
 * TODO(production): ก่อนใช้เงินจริงต้องต่อ provider (เช่น Google Play Billing / Stripe)
 * แล้วตรวจสอบ receipt ที่นี่ก่อนส่งของ — ตอนนี้เป็น dev mode: จำลองการชำระเงินสำเร็จทันที
 */
async function processPayment(_char: Character, _pkg: IapPackage): Promise<{ ok: boolean; receipt: string }> {
  return { ok: true, receipt: `dev_${Date.now()}` };
}

export async function purchaseIap(char: Character, packageId: string): Promise<{ gold: number; cards: string[]; firstBonus: boolean; character: Character }> {
  const pkg = IAP_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new AppError('ไม่พบแพ็กนี้');
  const bought = await boughtPackageIds(char.userId);
  const firstBonus = !bought.has(pkg.id);

  const payment = await processPayment(char, pkg);
  if (!payment.ok) throw new AppError('การชำระเงินไม่สำเร็จ — ลองอีกครั้ง');

  const gold = pkg.gold + (firstBonus ? pkg.firstBonusGold : 0);
  const cards: string[] = [];
  if (pkg.guaranteedTemplateId) {
    await mintCard(pkg.guaranteedTemplateId, char.userId, 'IAP_PURCHASE', { packageId: pkg.id });
    cards.push(pkg.guaranteedTemplateId);
  }
  const updated = await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + gold } });
  await recordLedger({
    type: 'IAP_PURCHASE',
    userId: char.userId,
    gold,
    meta: { packageId: pkg.id, priceTHB: pkg.priceTHB, firstBonus, receipt: payment.receipt, cards },
  });
  return { gold, cards, firstBonus, character: updated };
}

// ---------------------------------------------------------------------------
// กาชา
// ---------------------------------------------------------------------------

function randomTemplateOfRarity(rarity: Rarity) {
  const pool = allTemplates().filter((c) => c.rarity === rarity && c.group !== 'quest');
  if (pool.length === 0) return allTemplates()[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function gachaPull(char: Character, pulls: number, hits = 0): Promise<{ cards: string[]; goldSpent: number }> {
  if (pulls !== 1 && pulls !== 10) throw new AppError('สุ่มได้ครั้งละ 1 หรือ 10 ครั้งเท่านั้น');
  const cost = GACHA_COST * pulls;
  if (char.gold < cost) throw new AppError(`ทองไม่พอ (ต้องใช้ ${cost} ทอง)`);
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - cost } });
  await recordLedger({ type: 'GACHA_PULL', userId: char.userId, gold: -cost, meta: { pulls } });
  // โชคจากมินิเกม — มีผลเฉพาะรอบสุ่มนี้ (สุ่ม 10 ครั้ง โชคคูณ 2, สูงสุด 10)
  const baseLuck = Math.max(0, Math.min(10, Math.floor(hits)));
  const luck = Math.min(10, baseLuck * (pulls === 10 ? 2 : 1));
  const cards: string[] = [];
  for (let i = 0; i < pulls; i++) {
    const rarity = rollGachaRarity(Math.random(), luck);
    const t = randomTemplateOfRarity(rarity);
    await mintCard(t.id, char.userId, 'GACHA_PULL', { rarity });
    cards.push(t.id);
  }
  await grantXp(char, 5 * pulls);
  await onQuestEvent(char.userId, 'GACHA', pulls);
  return { cards, goldSpent: cost };
}

// ---------------------------------------------------------------------------
// ร้านมือสอง (การ์ดที่ผู้เล่นขายคืนระบบ ระบบขายต่อในราคา +markup)
// ---------------------------------------------------------------------------

export async function listShop(): Promise<{
  id: number; price: number; sellerName: string; createdAt: Date;
  templateId: string; card: ReturnType<typeof cardById>;
}[]> {
  const listings = await prisma.shopListing.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return listings.map((l) => ({
    id: l.id,
    price: l.price,
    sellerName: l.sellerName,
    createdAt: l.createdAt,
    templateId: l.templateId,
    card: cardById(l.templateId),
  }));
}

export async function buyListing(char: Character, listingId: number): Promise<{ templateId: string }> {
  const listing = await prisma.shopListing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE') throw new AppError('รายการนี้ไม่พร้อมขายแล้ว');
  if (char.gold < listing.price) throw new AppError(`ทองไม่พอ (ต้องใช้ ${listing.price} ทอง)`);
  const inst = await prisma.cardInstance.findUnique({ where: { id: listing.instanceId } });
  if (!inst || inst.status !== 'SHOP') throw new AppError('การ์ดนี้ถูกซื้อไปแล้ว');
  await prisma.$transaction([
    prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - listing.price } }),
    prisma.cardInstance.update({ where: { id: inst.id }, data: { ownerId: char.userId, status: 'INVENTORY' } }),
    prisma.shopListing.update({ where: { id: listing.id }, data: { status: 'SOLD' } }),
  ]);
  await recordLedger({ type: 'SHOP_BUY', userId: char.userId, templateId: listing.templateId, serial: inst.id, gold: -listing.price, meta: { listingId: listing.id } });
  return { templateId: listing.templateId };
}
