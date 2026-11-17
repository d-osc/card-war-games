// ===========================================================================
// ตลาดการ์ด — ประมูล + ขายตรงแบบระบุผู้เล่น
// กติกา: ราคาขั้นต่ำ = ราคาฐานของระบบ, มีค่าธรรมเนียมให้ระบบทั้งตอนตั้งขายและตอนขายสำเร็จ
// ===========================================================================
import {
  AUCTION_DURATIONS_H, AUCTION_MIN_INCREMENT, cardById, CardTemplate, DIRECT_SALE_HOURS, marketFee,
} from '@cardwar/shared';
import type { Auction, CardInstance, Character, DirectSale } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';
import { recordLedger } from './ledger';

async function requireOwnedInventoryCard(userId: number, serial: number): Promise<CardInstance> {
  const inst = await prisma.cardInstance.findUnique({ where: { id: serial } });
  if (!inst || inst.ownerId !== userId) throw new AppError('ไม่พบการ์ดนี้ในคลังของคุณ');
  if (inst.status !== 'INVENTORY') throw new AppError('การ์ดต้องอยู่ในคลัง (ไม่ได้อยู่ในเดค/สวมใส่/ตั้งขาย) จึงนำไปตลาดได้');
  return inst;
}

async function payGold(charId: number, amount: number): Promise<void> {
  await prisma.character.update({ where: { id: charId }, data: { gold: { decrement: amount } } });
}

async function receiveGold(charId: number, amount: number): Promise<void> {
  await prisma.character.update({ where: { id: charId }, data: { gold: { increment: amount } } });
}

// ---------------------------------------------------------------------------
// ประมูล
// ---------------------------------------------------------------------------

export interface AuctionView {
  id: number;
  card: CardTemplate;
  serial: number;
  sellerId: number;
  sellerName: string;
  startPrice: number;
  currentBid: number | null;
  currentBidderName: string | null;
  buyoutPrice: number | null;
  endsAt: string;
  isMine: boolean;
  imHighest: boolean;
}

function auctionView(a: Auction, viewerId: number): AuctionView {
  return {
    id: a.id,
    card: cardById(a.templateId),
    serial: a.instanceId,
    sellerId: a.sellerId,
    sellerName: a.sellerName,
    startPrice: a.startPrice,
    currentBid: a.currentBid,
    currentBidderName: a.currentBidderName,
    buyoutPrice: a.buyoutPrice,
    endsAt: a.endsAt.toISOString(),
    isMine: a.sellerId === viewerId,
    imHighest: a.currentBidderId === viewerId,
  };
}

export async function createAuction(char: Character, serial: number, startPrice: number, buyoutPrice: number | null, hours: number): Promise<AuctionView> {
  if (!AUCTION_DURATIONS_H.includes(hours)) throw new AppError('ระยะเวลาประมูลต้องเป็น 6/12/24 ชั่วโมง');
  const inst = await requireOwnedInventoryCard(char.userId, serial);
  const t = cardById(inst.templateId);
  startPrice = Math.floor(startPrice);
  if (!Number.isFinite(startPrice) || startPrice < t.basePrice) {
    throw new AppError(`ราคาเริ่มต้องไม่ต่ำกว่าราคาฐานของระบบ (${t.basePrice} ทอง)`);
  }
  if (buyoutPrice != null && buyoutPrice <= startPrice) throw new AppError('ราคาซื้อทันทีต้องสูงกว่าราคาเริ่มต้น');
  const fee = marketFee(startPrice);
  if (char.gold < fee) throw new AppError(`ทองไม่พอจ่ายค่าธรรมเนียมตั้งประมูล (${fee} ทอง)`);
  await payGold(char.id, fee);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'AUCTION' } });
  const auction = await prisma.auction.create({
    data: {
      instanceId: inst.id,
      templateId: inst.templateId,
      sellerId: char.userId,
      sellerName: char.name,
      startPrice,
      buyoutPrice: buyoutPrice ?? null,
      endsAt: new Date(Date.now() + hours * 3600_000),
    },
  });
  await recordLedger({ type: 'AUCTION_LIST', userId: char.userId, templateId: inst.templateId, serial: inst.id, gold: -fee, meta: { auctionId: auction.id, hours } });
  return auctionView(auction, char.userId);
}

/** ประมูลที่หมดเวลาแล้ว: มีผู้เสนอราคา → ขายสำเร็จ / ไม่มี → คืนการ์ดให้ผู้ขาย */
export async function settleExpiredAuctions(): Promise<number> {
  const ended = await prisma.auction.findMany({ where: { status: 'ACTIVE', endsAt: { lt: new Date() } } });
  for (const a of ended) {
    if (a.currentBidderId && a.currentBid) {
      const fee = marketFee(a.currentBid);
      const payout = a.currentBid - fee;
      // การ์ดไปผู้ชนะ (เงินวางประกันไปแล้วตอนเสนอราคา)
      await prisma.cardInstance.update({ where: { id: a.instanceId }, data: { ownerId: a.currentBidderId, status: 'INVENTORY' } });
      await receiveGoldFromUserId(a.sellerId, payout);
      await recordLedger({ type: 'AUCTION_WIN', userId: a.currentBidderId, templateId: a.templateId, serial: a.instanceId, gold: 0, meta: { auctionId: a.id, price: a.currentBid } });
      await recordLedger({ type: 'AUCTION_PAYOUT', userId: a.sellerId, templateId: a.templateId, serial: a.instanceId, gold: payout, meta: { auctionId: a.id, fee } });
      // ลบแถวเมื่อจบรายการ — instanceId unique ต้องว่างจึงตั้งประมูลใหม่ได้ (ประวัติอยู่ใน Ledger)
      await prisma.auction.delete({ where: { id: a.id } });
    } else {
      await prisma.cardInstance.update({ where: { id: a.instanceId }, data: { ownerId: a.sellerId, status: 'INVENTORY' } });
      await prisma.auction.delete({ where: { id: a.id } });
    }
  }
  return ended.length;
}

async function receiveGoldFromUserId(userId: number, amount: number): Promise<void> {
  await prisma.character.update({ where: { userId }, data: { gold: { increment: amount } } });
}

export async function listAuctions(viewerId: number): Promise<AuctionView[]> {
  await settleExpiredAuctions();
  const rows = await prisma.auction.findMany({ where: { status: 'ACTIVE' }, orderBy: { endsAt: 'asc' }, take: 60 });
  return rows.map((a) => auctionView(a, viewerId));
}

export function minBidOf(a: { startPrice: number; currentBid: number | null }): number {
  return a.currentBid ? Math.ceil(a.currentBid * (1 + AUCTION_MIN_INCREMENT)) : a.startPrice;
}

export async function bidAuction(char: Character, auctionId: number, amount: number): Promise<{ minBid: number }> {
  await settleExpiredAuctions();
  const a = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!a || a.status !== 'ACTIVE') throw new AppError('การประมูลนี้ไม่พร้อมรับราคาแล้ว');
  if (a.sellerId === char.userId) throw new AppError('ประมูลการ์ดของตัวเองไม่ได้');
  if (a.currentBidderId === char.userId) throw new AppError('คุณเป็นผู้เสนอราคาสูงสุดอยู่แล้ว');
  amount = Math.floor(amount);
  const min = minBidOf(a);
  if (!Number.isFinite(amount) || amount < min) throw new AppError(`ต้องเสนอราคาอย่างน้อย ${min} ทอง`);
  if (char.gold < amount) throw new AppError(`ทองไม่พอ (ต้องมี ${amount})`);
  // คืนเงินวางประกันผู้เสนอราคาก่อนหน้า
  if (a.currentBidderId && a.currentBid) {
    await receiveGoldFromUserId(a.currentBidderId, a.currentBid);
    await recordLedger({ type: 'AUCTION_REFUND', userId: a.currentBidderId, gold: a.currentBid, meta: { auctionId: a.id, outbid: true } });
  }
  await payGold(char.id, amount);
  await recordLedger({ type: 'AUCTION_BID', userId: char.userId, templateId: a.templateId, serial: a.instanceId, gold: -amount, meta: { auctionId: a.id } });
  const updated = await prisma.auction.update({
    where: { id: a.id },
    data: { currentBid: amount, currentBidderId: char.userId, currentBidderName: char.name },
  });
  return { minBid: minBidOf(updated) };
}

export async function buyoutAuction(char: Character, auctionId: number): Promise<void> {
  await settleExpiredAuctions();
  const a = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!a || a.status !== 'ACTIVE') throw new AppError('การประมูลนี้จบไปแล้ว');
  if (!a.buyoutPrice) throw new AppError('การประมูลนี้ไม่ได้ตั้งราคาซื้อทันที');
  if (a.sellerId === char.userId) throw new AppError('ซื้อการ์ดของตัวเองไม่ได้');
  if (char.gold < a.buyoutPrice) throw new AppError(`ทองไม่พอ (ต้องมี ${a.buyoutPrice})`);
  await payGold(char.id, a.buyoutPrice);
  // คืนเงินผู้เสนอราคาสูงสุด (ถ้ามี)
  if (a.currentBidderId && a.currentBid) {
    await receiveGoldFromUserId(a.currentBidderId, a.currentBid);
    await recordLedger({ type: 'AUCTION_REFUND', userId: a.currentBidderId, gold: a.currentBid, meta: { auctionId: a.id, buyout: true } });
  }
  const fee = marketFee(a.buyoutPrice);
  const payout = a.buyoutPrice - fee;
  await prisma.cardInstance.update({ where: { id: a.instanceId }, data: { ownerId: char.userId, status: 'INVENTORY' } });
  await receiveGoldFromUserId(a.sellerId, payout);
  await recordLedger({ type: 'AUCTION_WIN', userId: char.userId, templateId: a.templateId, serial: a.instanceId, gold: -a.buyoutPrice, meta: { auctionId: a.id, buyout: true } });
  await recordLedger({ type: 'AUCTION_PAYOUT', userId: a.sellerId, templateId: a.templateId, serial: a.instanceId, gold: payout, meta: { auctionId: a.id, fee, buyout: true } });
  await prisma.auction.delete({ where: { id: a.id } });
}

export async function cancelAuction(char: Character, auctionId: number): Promise<void> {
  const a = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!a || a.status !== 'ACTIVE') throw new AppError('การประมูลนี้ไม่ได้เปิดอยู่');
  if (a.sellerId !== char.userId) throw new AppError('เป็นของผู้อื่น');
  if (a.currentBidderId) throw new AppError('มีผู้เสนอราคาแล้ว ยกเลิกไม่ได้ (ค่าธรรมเนียมไม่คืนเมื่อตั้งประมูล)');
  await prisma.cardInstance.update({ where: { id: a.instanceId }, data: { ownerId: char.userId, status: 'INVENTORY' } });
  // ลบแถวเพื่อให้ตั้งประมูลใหม่ได้ — ประวัติอยู่ใน Ledger
  await prisma.auction.delete({ where: { id: a.id } });
}

// ---------------------------------------------------------------------------
// ขายตรงแบบระบุผู้เล่น
// ---------------------------------------------------------------------------

export interface DirectSaleView {
  id: number;
  card: CardTemplate;
  serial: number;
  sellerName: string;
  targetName: string;
  price: number;
  expiresAt: string;
  isMine: boolean;
  isForMe: boolean;
}

function directView(d: DirectSale, viewerId: number): DirectSaleView {
  return {
    id: d.id,
    card: cardById(d.templateId),
    serial: d.instanceId,
    sellerName: d.sellerName,
    targetName: d.targetName,
    price: d.price,
    expiresAt: d.expiresAt.toISOString(),
    isMine: d.sellerId === viewerId,
    isForMe: d.targetUserId === viewerId,
  };
}

export async function createDirectSale(char: Character, serial: number, targetName: string, price: number): Promise<DirectSaleView> {
  const inst = await requireOwnedInventoryCard(char.userId, serial);
  const t = cardById(inst.templateId);
  const target = await prisma.character.findFirst({ where: { name: targetName } });
  if (!target) throw new AppError(`ไม่พบผู้เล่นชื่อ "${targetName}"`);
  if (target.userId === char.userId) throw new AppError('ขายให้ตัวเองไม่ได้');
  price = Math.floor(price);
  if (!Number.isFinite(price) || price < t.basePrice) {
    throw new AppError(`ราคาต้องไม่ต่ำกว่าราคาฐานของระบบ (${t.basePrice} ทอง)`);
  }
  const fee = marketFee(price);
  if (char.gold < fee) throw new AppError(`ทองไม่พอจ่ายค่าธรรมเนียมตั้งขาย (${fee} ทอง)`);
  await payGold(char.id, fee);
  await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'DIRECT' } });
  const sale = await prisma.directSale.create({
    data: {
      instanceId: inst.id,
      templateId: inst.templateId,
      sellerId: char.userId,
      sellerName: char.name,
      targetUserId: target.userId,
      targetName: target.name,
      price,
      expiresAt: new Date(Date.now() + DIRECT_SALE_HOURS * 3600_000),
    },
  });
  await recordLedger({ type: 'DIRECT_LIST', userId: char.userId, templateId: inst.templateId, serial: inst.id, gold: -fee, meta: { saleId: sale.id, target: target.name } });
  return directView(sale, char.userId);
}

/** เห็นเฉพาะข้อเสนอที่ส่งถึงตัวเอง และรายการที่ตัวเองตั้งขายไว้ */
export async function listDirectSales(viewerId: number): Promise<DirectSaleView[]> {
  await sweepExpiredDirectSales();
  const rows = await prisma.directSale.findMany({
    where: { status: 'ACTIVE', OR: [{ targetUserId: viewerId }, { sellerId: viewerId }] },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return rows.map((d) => directView(d, viewerId));
}

/** คืนการ์ดของรายการขายตรงที่หมดอายุ (เรียกจาก sweeper) */
export async function sweepExpiredDirectSales(): Promise<void> {
  const expired = await prisma.directSale.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: new Date() } } });
  for (const d of expired) {
    await prisma.cardInstance.update({ where: { id: d.instanceId }, data: { ownerId: d.sellerId, status: 'INVENTORY' } });
    await prisma.directSale.delete({ where: { id: d.id } });
  }
}

export async function buyDirectSale(char: Character, saleId: number): Promise<void> {
  const d = await prisma.directSale.findUnique({ where: { id: saleId } });
  if (!d || d.status !== 'ACTIVE' || d.expiresAt < new Date()) throw new AppError('ข้อเสนอนี้ไม่พร้อมขายแล้ว');
  if (d.targetUserId !== char.userId) throw new AppError('ข้อเสนอนี้ส่งถึงผู้เล่นอื่น ไม่ใช่คุณ');
  if (char.gold < d.price) throw new AppError(`ทองไม่พอ (ต้องมี ${d.price})`);
  await payGold(char.id, d.price);
  const fee = marketFee(d.price);
  const payout = d.price - fee;
  await prisma.cardInstance.update({ where: { id: d.instanceId }, data: { ownerId: char.userId, status: 'INVENTORY' } });
  await receiveGoldFromUserId(d.sellerId, payout);
  await recordLedger({ type: 'DIRECT_BUY', userId: char.userId, templateId: d.templateId, serial: d.instanceId, gold: -d.price, meta: { saleId: d.id } });
  await recordLedger({ type: 'DIRECT_PAYOUT', userId: d.sellerId, templateId: d.templateId, serial: d.instanceId, gold: payout, meta: { saleId: d.id, fee } });
  await prisma.directSale.delete({ where: { id: d.id } });
}

export async function cancelDirectSale(char: Character, saleId: number): Promise<void> {
  const d = await prisma.directSale.findUnique({ where: { id: saleId } });
  if (!d || d.status !== 'ACTIVE') throw new AppError('ข้อเสนอนี้ปิดไปแล้ว');
  if (d.sellerId !== char.userId) throw new AppError('เป็นของผู้อื่น');
  await prisma.cardInstance.update({ where: { id: d.instanceId }, data: { ownerId: char.userId, status: 'INVENTORY' } });
  // ลบแถวเพื่อให้ตั้งขายใหม่ได้ — ประวัติอยู่ใน Ledger
  await prisma.directSale.delete({ where: { id: d.id } });
}
