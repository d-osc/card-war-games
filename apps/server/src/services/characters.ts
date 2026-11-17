import {
  addStats, ALLOCATABLE_STATS, CardTemplate, cardById, ENERGY_MAX, ENERGY_REGEN_MS,
  EQUIP_SLOTS, HERO_EMOJI, LEVEL_STAT_POINTS, PLAYER_BASE, PLAYER_GROWTH, REST_TICK_BASE_MIN, REST_TICK_MIN_MIN, SPD_REST_MIN_PER_POINT, Stats, TOOL_CATEGORIES, xpForLevel,
} from '@cardwar/shared';
import type { Character, CardInstance } from '@prisma/client';
import { prisma } from '../db';
import { recordLedger } from './ledger';

export function parseAllocated(c: Character): Partial<Stats> {
  try {
    return JSON.parse(c.allocated) as Partial<Stats>;
  } catch {
    return {};
  }
}

/** สเตตัสรวม = ฐาน + growth*(level-1) + แต้มที่ลงเอง + อุปกรณ์ที่สวมใส่ */
export function computeStats(c: Character, equipped: CardInstance[]): Stats {
  let stats: Stats = PLAYER_BASE;
  for (let lv = 1; lv < c.level; lv++) stats = addStats(stats, PLAYER_GROWTH);
  stats = addStats(stats, parseAllocated(c));
  for (const inst of equipped) {
    const t = cardById(inst.templateId);
    if (t.equip) stats = addStats(stats, t.equip);
  }
  // ค่าขั้นต่ำกันติดลบ/ศูนย์
  stats.hp = Math.max(20, stats.hp);
  stats.hpRegen = Math.max(0, stats.hpRegen);
  stats.luck = Math.max(0, stats.luck);
  stats.atk = Math.max(1, stats.atk);
  stats.def = Math.max(0, stats.def);
  stats.matk = Math.max(0, stats.matk);
  stats.mdef = Math.max(0, stats.mdef);
  stats.spd = Math.max(1, stats.spd);
  stats.manaMax = Math.max(10, stats.manaMax);
  stats.stamMax = Math.max(10, stats.stamMax);
  stats.manaRegen = Math.max(0, stats.manaRegen);
  stats.stamRegen = Math.max(0, stats.stamRegen);
  return stats;
}

/** คำนวณพลังงานที่ฟื้นตามเวลาจริง */
export async function syncEnergy(c: Character): Promise<Character> {
  const now = Date.now();
  if (c.energy >= ENERGY_MAX) {
    if (c.energyAt.getTime() < now - ENERGY_REGEN_MS) {
      return prisma.character.update({ where: { id: c.id }, data: { energyAt: new Date(now) } });
    }
    return c;
  }
  const gained = Math.floor((now - c.energyAt.getTime()) / ENERGY_REGEN_MS);
  if (gained <= 0) return c;
  const energy = Math.min(ENERGY_MAX, c.energy + gained);
  return prisma.character.update({ where: { id: c.id }, data: { energy, energyAt: new Date(now) } });
}

export interface XpResult {
  character: Character;
  levelsGained: number;
}

export async function grantXp(c: Character, xp: number): Promise<XpResult> {
  if (xp <= 0) return { character: c, levelsGained: 0 };
  let { level, xp: cur, statPoints } = c;
  cur += xp;
  let levels = 0;
  while (cur >= xpForLevel(level)) {
    cur -= xpForLevel(level);
    level += 1;
    statPoints += LEVEL_STAT_POINTS;
    levels += 1;
    if (level > 200) break;
  }
  const character = await prisma.character.update({
    where: { id: c.id },
    data: { xp: cur, level, statPoints },
  });
  return { character, levelsGained: levels };
}

export async function grantGold(c: Character, amount: number, ledgerType: Parameters<typeof recordLedger>[0]['type'], meta?: Record<string, unknown>): Promise<Character> {
  if (amount === 0) return c;
  const gold = Math.max(0, c.gold + amount);
  const character = await prisma.character.update({ where: { id: c.id }, data: { gold } });
  await recordLedger({ type: ledgerType, userId: c.userId, gold: amount, meta });
  return character;
}

export async function requireCharacter(userId: number): Promise<Character> {
  const c = await prisma.character.findUnique({ where: { userId } });
  if (!c) throw new Error('ไม่พบตัวละคร กรุณาสร้างตัวละครก่อน');
  return c;
}

export async function allocateStatPoint(c: Character, stat: string, points: number): Promise<Character> {
  if (!ALLOCATABLE_STATS.includes(stat as never)) throw new Error('สเตตัสไม่ถูกต้อง');
  if (points <= 0) throw new Error('จำนวนแต้มไม่ถูกต้อง');
  if (points > c.statPoints) throw new Error('แต้มสเตตัสไม่พอ');
  const alloc = parseAllocated(c);
  const perPoint: Record<string, number> = {
    hp: 10, atk: 2, def: 2, matk: 2, mdef: 2, spd: 1, manaMax: 6, stamMax: 6,
  };
  alloc[stat as keyof typeof alloc] = (alloc[stat as keyof typeof alloc] ?? 0) + perPoint[stat] * points;
  const character = await prisma.character.update({
    where: { id: c.id },
    data: { allocated: JSON.stringify(alloc), statPoints: c.statPoints - points },
  });
  await recordLedger({ type: 'STAT_ALLOCATE', userId: c.userId, meta: { stat, points } });
  return character;
}

export interface MeCharacter {
  id: number;
  name: string;
  heroEmoji: string;
  level: number;
  xp: number;
  xpNext: number;
  statPoints: number;
  allocated: Partial<Stats>;
  gold: number;
  energy: number;
  energyAt: string;
  mana: number;
  stam: number;
  hp: number;
  rating: number;
  wins: number;
  losses: number;
  highestFloor: number;
  stats: Stats;
  equipment: { slot: string; instanceId: number; templateId: string; template: CardTemplate | null }[];
  deckCount: number;
}

/** hp/มานา/กำลังนอกสนาม — ต่อรอบ: hp +hpRegen ตามสถิติ, มานา/กำลัง +1
 *  รอบฟื้น = 60 นาที − (ความเร็ว × 2 นาที) ต่ำสุด 10 นาที (ค่า -1 = ยังไม่เคยซิงก์ ถือว่าเต็ม) */
export async function syncManaStam(c: Character): Promise<Character> {
  const now = Date.now();
  const equipped = await prisma.cardInstance.findMany({ where: { ownerId: c.userId, status: 'EQUIPPED' } });
  const stats = computeStats(c, equipped);
  // ความเร็วยิ่งสูง รอบการฟื้นยิ่งสั้นลง (ลบนาทีตรง ๆ)
  const tickMinutes = Math.max(REST_TICK_MIN_MIN, REST_TICK_BASE_MIN - stats.spd * SPD_REST_MIN_PER_POINT);
  const interval = tickMinutes * 60_000;
  if (c.mana < 0 || c.stam < 0 || c.hp < 0) {
    return prisma.character.update({ where: { id: c.id }, data: { hp: stats.hp, mana: stats.manaMax, stam: stats.stamMax, regenAt: new Date(now) } });
  }
  if (c.mana >= stats.manaMax && c.stam >= stats.stamMax && c.hp >= stats.hp) {
    if (c.regenAt.getTime() < now - interval) {
      return prisma.character.update({ where: { id: c.id }, data: { regenAt: new Date(now) } });
    }
    return c;
  }
  const ticks = Math.floor((now - c.regenAt.getTime()) / interval);
  if (ticks <= 0) return c;
  return prisma.character.update({
    where: { id: c.id },
    data: {
      hp: Math.min(stats.hp, c.hp + Math.max(1, stats.hpRegen) * ticks),
      mana: Math.min(stats.manaMax, c.mana + ticks),
      stam: Math.min(stats.stamMax, c.stam + ticks),
      regenAt: new Date(now),
    },
  });
}

export async function buildMeCharacter(c0: Character): Promise<MeCharacter> {
  const c1 = await syncEnergy(c0);
  const c = await syncManaStam(c1);
  const instances = await prisma.cardInstance.findMany({
    where: { ownerId: c.userId, status: { in: ['INVENTORY', 'IN_DECK', 'EQUIPPED'] } },
  });
  const equipped = instances.filter((i) => i.status === 'EQUIPPED');
  const deckCount = instances.filter((i) => i.status === 'IN_DECK').length;
  return {
    id: c.id,
    name: c.name,
    heroEmoji: HERO_EMOJI,
    level: c.level,
    xp: c.xp,
    xpNext: xpForLevel(c.level),
    statPoints: c.statPoints,
    allocated: parseAllocated(c),
    gold: c.gold,
    energy: c.energy,
    energyAt: c.energyAt.toISOString(),
    mana: Math.max(0, c.mana),
    stam: Math.max(0, c.stam),
    hp: Math.max(1, c.hp),
    rating: c.rating,
    wins: c.wins,
    losses: c.losses,
    highestFloor: c.highestFloor,
    stats: computeStats(c, equipped),
    equipment: [
      ...EQUIP_SLOTS.map((slot) => {
        const inst = equipped.find((i) => i.slot === slot);
        if (!inst) return { slot, instanceId: 0, templateId: '', template: null };
        return { slot, instanceId: inst.id, templateId: inst.templateId, template: cardById(inst.templateId) };
      }),
      // สัตว์เลี้ยงที่สวมใส่ (slot='pet' ได้หลายตัว)
      ...equipped.filter((i) => i.slot === 'pet').map((i) => ({
        slot: 'pet' as const, instanceId: i.id, templateId: i.templateId, template: cardById(i.templateId),
      })),
      // เครื่องมือที่สวมใส่ (slot = pickaxe/axe ชนิดละ 1)
      ...equipped.filter((i) => TOOL_CATEGORIES.includes(i.slot as never)).map((i) => ({
        slot: i.slot as string, instanceId: i.id, templateId: i.templateId, template: cardById(i.templateId),
      })),
    ],
    deckCount,
  };
}
