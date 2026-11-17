// ===========================================================================
// Admin — สถิติระบบ + รายการ ledger + รายชื่อผู้เล่น (เฉพาะ isAdmin)
// ===========================================================================
import { LEDGER_NAME_TH, LedgerType, CardTemplate, Rarity, RARITIES, registerTemplate, allTemplates } from '@cardwar/shared';
import { prisma } from '../db';
import { AppError } from '../errors';
import { recordLedger } from './ledger';

export async function adminStats(): Promise<{
  users: number;
  characters: number;
  guilds: number;
  totalGold: number;
  cardsMinted: number;
  cardsBurned: number;
  cardsInCirculation: number;
  openAuctions: number;
  openPlayerQuests: number;
  ledgerSinks: { type: string; name: string; total: number }[];
  ledgerSources: { type: string; name: string; total: number }[];
}> {
  const [users, characters, guilds] = await Promise.all([
    prisma.user.count(),
    prisma.character.count(),
    prisma.guild.count(),
  ]);
  const agg = await prisma.character.aggregate({ _sum: { gold: true } });
  const templates = await prisma.cardTemplate.findMany({ select: { minted: true, burned: true } });
  const inCirc = await prisma.cardInstance.count({ where: { status: { in: ['INVENTORY', 'IN_DECK', 'EQUIPPED', 'SHOP', 'AUCTION', 'DIRECT'] } } });
  const [openAuctions, openPlayerQuests] = await Promise.all([
    prisma.auction.count({ where: { status: 'ACTIVE' } }),
    prisma.playerQuest.count({ where: { status: 'OPEN' } }),
  ]);

  // สรุปการไหลของทองแยกแหล่งที่มา (source) และทางออก (sink)
  const entries = await prisma.ledger.findMany({ where: { gold: { not: null } }, select: { type: true, gold: true } });
  const byType = new Map<string, number>();
  for (const e of entries) {
    byType.set(e.type, (byType.get(e.type) ?? 0) + (e.gold ?? 0));
  }
  const sinks: { type: string; name: string; total: number }[] = [];
  const sources: { type: string; name: string; total: number }[] = [];
  for (const [type, total] of byType) {
    const name = LEDGER_NAME_TH[type as LedgerType] ?? type;
    if (total < 0) sinks.push({ type, name, total: -total });
    else if (total > 0) sources.push({ type, name, total });
  }
  sinks.sort((a, b) => b.total - a.total);
  sources.sort((a, b) => b.total - a.total);

  return {
    users,
    characters,
    guilds,
    totalGold: agg._sum.gold ?? 0,
    cardsMinted: templates.reduce((a, t) => a + t.minted, 0),
    cardsBurned: templates.reduce((a, t) => a + t.burned, 0),
    cardsInCirculation: inCirc,
    openAuctions,
    openPlayerQuests,
    ledgerSinks: sinks.slice(0, 10),
    ledgerSources: sources.slice(0, 10),
  };
}

export async function adminLedger(limit = 100, type?: string): Promise<{
  id: number; type: string; typeName: string; userId: number | null; templateId: string | null;
  serial: number | null; gold: number | null; meta: string | null; createdAt: string;
}[]> {
  const rows = await prisma.ledger.findMany({
    where: type ? { type } : undefined,
    orderBy: { id: 'desc' },
    take: Math.min(limit, 300),
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    typeName: LEDGER_NAME_TH[r.type as LedgerType] ?? r.type,
    userId: r.userId,
    templateId: r.templateId,
    serial: r.serial,
    gold: r.gold,
    meta: r.meta,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function adminPlayers(search = ''): Promise<{
  userId: number;
  name: string; level: number; gold: number; rating: number;
  wins: number; losses: number; email: string | null; createdAt: string;
}[]> {
  const chars = await prisma.character.findMany({
    where: search ? { name: { contains: search } } : undefined,
    orderBy: { level: 'desc' },
    take: 100,
  });
  const out = [];
  for (const c of chars) {
    const u = await prisma.user.findUnique({ where: { id: c.userId } });
    out.push({
      userId: c.userId,
      name: c.name,
      level: c.level,
      gold: c.gold,
      rating: c.rating,
      wins: c.wins,
      losses: c.losses,
      email: u?.email ?? null,
      createdAt: c.createdAt.toISOString(),
    });
  }
  return out;
}

export function assertAdmin(user: { isAdmin?: boolean }): void {
  if (!user.isAdmin) throw new AppError('เฉพาะแอดมินเท่านั้น', 403);
}

// ===========================================================================
// Admin Manager — จัดการผู้เล่นรายคน (ดูรายละเอียด / ตั้งทอง / ตั้งเรตติ้ง / มองการ์ด)
// ===========================================================================

export async function playerDetail(userId: number): Promise<{
  userId: number;
  name: string;
  level: number;
  xp: number;
  gold: number;
  rating: number;
  wins: number;
  losses: number;
  statPoints: number;
  deckCount: number;
  cardCount: number;
  email: string | null;
  createdAt: string;
}> {
  const char = await prisma.character.findUnique({ where: { userId } });
  if (!char) throw new AppError('ไม่พบตัวละครของผู้ใช้นี้', 404);
  const [user, instances] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.cardInstance.findMany({ where: { ownerId: userId }, select: { status: true } }),
  ]);
  return {
    userId,
    name: char.name,
    level: char.level,
    xp: char.xp,
    gold: char.gold,
    rating: char.rating,
    wins: char.wins,
    losses: char.losses,
    statPoints: char.statPoints,
    deckCount: instances.filter((i) => i.status === 'IN_DECK').length,
    cardCount: instances.filter((i) => i.status !== 'DESTROYED').length,
    email: user?.email ?? null,
    createdAt: char.createdAt.toISOString(),
  };
}

/** ตั้งทองเป็นค่าใหม่ (absolute) — บันทึกส่วนต่างลง ledger เป็น ADMIN_ADJUST */
export async function setPlayerGold(adminId: number, userId: number, newGold: number): Promise<{ gold: number }> {
  newGold = Math.max(0, Math.floor(newGold));
  if (!Number.isFinite(newGold)) throw new AppError('จำนวนทองไม่ถูกต้อง');
  const char = await prisma.character.findUnique({ where: { userId } });
  if (!char) throw new AppError('ไม่พบตัวละคร', 404);
  const delta = newGold - char.gold;
  await prisma.character.update({ where: { id: char.id }, data: { gold: newGold } });
  if (delta !== 0) {
    await recordLedger({ type: 'ADMIN_ADJUST', userId, gold: delta, meta: { action: 'setGold', from: char.gold, to: newGold, by: adminId } });
  }
  return { gold: newGold };
}

export async function setPlayerRating(userId: number, newRating: number): Promise<{ rating: number }> {
  newRating = Math.max(100, Math.floor(newRating));
  if (!Number.isFinite(newRating)) throw new AppError('เรตติ้งไม่ถูกต้อง');
  const char = await prisma.character.findUnique({ where: { userId } });
  if (!char) throw new AppError('ไม่พบตัวละคร', 404);
  await prisma.character.update({ where: { id: char.id }, data: { rating: newRating } });
  return { rating: newRating };
}

/** มองการ์ดให้ผู้เล่นโดยตรง (mint) */
export async function mintToPlayer(adminId: number, userId: number, templateId: string, count: number): Promise<{ minted: number; templateId: string }> {
  count = Math.max(1, Math.min(50, Math.floor(count)));
  const t = await prisma.cardTemplate.findUnique({ where: { id: templateId } });
  if (!t) throw new AppError('ไม่พบชนิดการ์ดนี้');
  const { mintCard } = await import('./inventory');
  for (let i = 0; i < count; i++) {
    await mintCard(templateId, userId, 'ADMIN_ADJUST', { by: adminId });
  }
  return { minted: count, templateId };
}


// ===========================================================================
// Admin — สร้างการ์ดใหม่ (custom card) เก็บในตาราง CardTemplate แล้ว register ทันที
// ====================================================================================

export const CUSTOM_PREFIX = 'custom_';

/** โหลดการ์ด custom จาก DB มา register เข้า registry — เรียกตอน server boot */
export async function loadCustomTemplates(): Promise<number> {
  const rows = await prisma.cardTemplate.findMany({ where: { id: { startsWith: CUSTOM_PREFIX } } });
  let ok = 0;
  for (const r of rows) {
    try {
      const t = JSON.parse(r.data) as CardTemplate;
      registerTemplate(t);
      ok++;
    } catch { /* ข้อมูลเพี้ยน — ข้าม */ }
  }
  return ok;
}

export interface CreateCardInput {
  name: string;
  emoji: string;
  description: string;
  rarity: Rarity;
  group: string;            // material | equipment | weapon | consumable | skill | pet | tool
  category: string;
  tier?: number;
  image?: string;
  basePrice?: number;
  // ค่าตามกลุ่ม
  stats?: Record<string, number>;   // equipment/weapon: hp/atk/def/matk/mdef/spd
  power?: number;                   // skill/pet: พลัง
  duration?: number;                // buff/poison
  skillKind?: string;               // physical/magic/heal/shield/buff_atk/buff_matk/poison
  consumable?: Record<string, number>; // heal/mana/stam/atkBuff/energy
}

const PRICE_BY_GROUP: Record<string, (r: Rarity) => number> = {
  material: (r) => Math.round(BASE_PRICE_MAP[r] * 0.8),
  tool: (r) => Math.round(BASE_PRICE_MAP[r] * 3),
};
const BASE_PRICE_MAP: Record<Rarity, number> = { C: 30, UC: 50, R: 90, SR: 160, SSR: 280 };
const SHARD_BY_GROUP: Record<string, number> = { skill: 2, pet: 2, consumable: 1, equipment: 0, weapon: 0, tool: 0, material: 0 };

export async function createCustomCard(adminId: number, input: CreateCardInput): Promise<CardTemplate> {
  const name = (input.name ?? '').trim().slice(0, 24);
  const emoji = (input.emoji ?? '🃏').trim().slice(0, 8) || '🃏';
  const description = (input.description ?? '').trim().slice(0, 80) || 'การ์ดพิเศษจากแอดมิน';
  const rarity = (RARITIES as string[]).includes(input.rarity) ? input.rarity as Rarity : 'C';
  const group = input.group ?? 'material';

  // ประกอบ template ตามกลุ่ม
  const id = `${CUSTOM_PREFIX}${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
  const tier = Math.max(0, Math.min(5, Math.floor(input.tier ?? 0)));
  const rarityIdx = RARITIES.indexOf(rarity) + 1;
  const base: CardTemplate = {
    id, name, emoji,
    category: input.category as CardTemplate['category'],
    group: (group === 'weapon' ? 'equipment' : group) as CardTemplate['group'],
    rarity,
    basePrice: Math.max(1, Math.floor(input.basePrice ?? (PRICE_BY_GROUP[group]?.(rarity) ?? BASE_PRICE_MAP[rarity]))),
    description,
    shardCost: SHARD_BY_GROUP[group] ?? 0,
    tier: group === 'material' || group === 'tool' ? (tier || rarityIdx) : 0,
    ...(input.image ? { image: input.image } : {}),
  };
  if (group === 'weapon') base.weaponKind = (input.category as CardTemplate['weaponKind']) ?? 'sword';
  if ((group === 'equipment' || group === 'weapon') && input.stats) {
    const eq: Record<string, number> = {};
    for (const [k, v] of Object.entries(input.stats)) {
      if (Number.isFinite(v) && v !== 0) eq[k] = Math.floor(v);
    }
    if (Object.keys(eq).length > 0) base.equip = eq;
  }
  if (group === 'skill' && input.skillKind) {
    base.skill = {
      kind: input.skillKind as 'physical',
      power: Math.max(1, Math.floor(input.power ?? 10)),
      ...(input.duration ? { duration: Math.max(1, Math.floor(input.duration)) } : {}),
    };
  }
  if (group === 'pet') {
    base.pet = { atk: Math.max(1, Math.floor(input.power ?? 5)), hp: Math.max(1, Math.floor(input.stats?.hp ?? 10)) };
  }
  if (group === 'consumable' && input.consumable) {
    const c: Record<string, number> = {};
    for (const [k, v] of Object.entries(input.consumable)) {
      if (Number.isFinite(v) && v > 0) c[k] = Math.floor(v);
    }
    if (Object.keys(c).length > 0) base.consumable = c;
  }

  // บันทึกลง DB + register ให้ใช้ได้ทันที
  await prisma.cardTemplate.create({
    data: {
      id, name, emoji,
      category: base.category, groupName: base.group, rarity, basePrice: base.basePrice, description,
      data: JSON.stringify(base),
    },
  });
  registerTemplate(base);
  await recordLedger({ type: 'ADMIN_ADJUST', userId: adminId, meta: { action: 'createCard', cardId: id, name, rarity, group } });
  return base;
}

export async function listCustomCards(): Promise<{ id: string; name: string; emoji: string; rarity: string; group: string; category: string; minted: number }[]> {
  const rows = await prisma.cardTemplate.findMany({ where: { id: { startsWith: CUSTOM_PREFIX } }, select: { id: true, minted: true } });
  const mintedMap = new Map(rows.map((r) => [r.id, r.minted]));
  return allTemplates()
    .filter((t) => t.id.startsWith(CUSTOM_PREFIX))
    .map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, rarity: t.rarity, group: t.group, category: t.category, minted: mintedMap.get(t.id) ?? 0 }));
}
