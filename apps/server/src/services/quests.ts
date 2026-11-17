import { DUNGEON_FLOORS, HourlyQuestType, QUEST_COOLDOWN_MS, QUEST_NAME_TH } from '@cardwar/shared';
import type { HourlyQuest } from '@prisma/client';
import { prisma } from '../db';
import { recordLedger } from './ledger';
import { mintCard } from './inventory';
import { grantXp } from './characters';

const QUEST_POOL: HourlyQuestType[] = ['GATHER_MINE', 'GATHER_FOREST', 'WIN_PVP', 'CLEAR_FLOOR', 'CRAFT', 'GACHA'];

interface QuestSpec {
  type: HourlyQuestType;
  target: number;
  rewardGold: number;
  rewardXp: number;
  rewardCard?: string;
}

function randomQuest(highestFloor: number): QuestSpec {
  const type = QUEST_POOL[Math.floor(Math.random() * QUEST_POOL.length)];
  const r = Math.random();
  switch (type) {
    case 'GATHER_MINE':
    case 'GATHER_FOREST': {
      const target = 3 + Math.floor(r * 3); // 3-5
      return { type, target, rewardGold: 60 + target * 15, rewardXp: 25 + target * 5 };
    }
    case 'WIN_PVP': {
      const target = 1 + Math.floor(r * 2); // 1-2
      return { type, target, rewardGold: 80 + target * 40, rewardXp: 40 + target * 15 };
    }
    case 'CLEAR_FLOOR': {
      const target = Math.min(DUNGEON_FLOORS, Math.max(1, highestFloor + (r < 0.6 ? 1 : 0)));
      return { type, target, rewardGold: 70 + target * 30, rewardXp: 35 + target * 12 };
    }
    case 'CRAFT': {
      const target = 2 + Math.floor(r * 2); // 2-3
      return { type, target, rewardGold: 50 + target * 20, rewardXp: 25 + target * 8 };
    }
    case 'GACHA': {
      const target = 1;
      return { type, target, rewardGold: 70, rewardXp: 20 };
    }
  }
}

/** โอกาส 15% ที่เควสต์จะมีการ์ดวัตถุดิบเป็นโบนัส */
const CARD_REWARD_POOL = ['ore_iron', 'gem_amethyst', 'herb_ginseng', 'wood_oak', 'potion_hp', 'ing_honey'];

async function createQuest(userId: number, highestFloor: number): Promise<HourlyQuest> {
  const spec = randomQuest(highestFloor);
  const rewardCard = Math.random() < 0.15 ? CARD_REWARD_POOL[Math.floor(Math.random() * CARD_REWARD_POOL.length)] : null;
  return prisma.hourlyQuest.create({
    data: {
      userId,
      type: spec.type,
      target: spec.target,
      rewardGold: spec.rewardGold,
      rewardXp: spec.rewardXp,
      rewardCard,
    },
  });
}

/** เติมเควสต์ให้ครบ 3 และฟื้นช่องที่คูลดาวน์หมดแล้วด้วยเควสต์ใหม่ */
export async function ensureQuests(userId: number, highestFloor: number): Promise<HourlyQuest[]> {
  const now = new Date();
  // ช่องที่คูลดาวน์หมดแล้ว → ลบทิ้งเพื่อสุ่มใหม่
  await prisma.hourlyQuest.deleteMany({
    where: { userId, status: 'COOLDOWN', cooldownUntil: { lt: now } },
  });
  const current = await prisma.hourlyQuest.findMany({ where: { userId }, orderBy: { id: 'asc' } });
  let active = current;
  for (let i = current.length; i < 3; i++) {
    active = [...active, await createQuest(userId, highestFloor)];
  }
  return active;
}

export interface QuestView {
  id: number;
  type: HourlyQuestType;
  name: string;
  target: number;
  progress: number;
  rewardGold: number;
  rewardXp: number;
  rewardCard: string | null;
  status: string;
  cooldownUntil: string | null;
}

export function questView(q: HourlyQuest): QuestView {
  return {
    id: q.id,
    type: q.type as HourlyQuestType,
    name: QUEST_NAME_TH[q.type as HourlyQuestType],
    target: q.target,
    progress: q.progress,
    rewardGold: q.rewardGold,
    rewardXp: q.rewardXp,
    rewardCard: q.rewardCard,
    status: q.status,
    cooldownUntil: q.cooldownUntil ? q.cooldownUntil.toISOString() : null,
  };
}

export interface CompletedQuestInfo {
  name: string;
  rewardGold: number;
  rewardXp: number;
  rewardCard: string | null;
}

/**
 * แจ้งความคืบหน้าเควสต์ — เรียกจากทุกจุดที่ผู้เล่นทำกิจกรรม
 * เควสต์ครบเป้าจะจ่ายรางวัลทันทีแล้วเข้าคูลดาวน์ 1 ชม.
 */
export async function onQuestEvent(
  userId: number,
  type: HourlyQuestType,
  amount = 1,
  meta?: { floor?: number },
): Promise<CompletedQuestInfo[]> {
  const active = await prisma.hourlyQuest.findMany({ where: { userId, type, status: 'ACTIVE' } });
  const completed: CompletedQuestInfo[] = [];
  for (const q of active) {
    // เควสต์พิชิตดันเจี้ยน: ผ่านชั้นเป้าหมายหรือสูงกว่าถือว่าสำเร็จ
    const done = q.type === 'CLEAR_FLOOR'
      ? (meta?.floor ?? 0) >= q.target
      : q.progress + amount >= q.target;
    if (done) {
      const char = await prisma.character.findUnique({ where: { userId } });
      if (char) {
        await prisma.character.update({
          where: { id: char.id },
          data: { gold: char.gold + q.rewardGold },
        });
        await grantXp(char, q.rewardXp);
        if (q.rewardCard) await mintCard(q.rewardCard, userId, 'QUEST_REWARD', { questId: q.id });
        await recordLedger({ type: 'QUEST_REWARD', userId, gold: q.rewardGold, meta: { questId: q.id, type: q.type } });
      }
      await prisma.hourlyQuest.update({
        where: { id: q.id },
        data: { status: 'COOLDOWN', cooldownUntil: new Date(Date.now() + QUEST_COOLDOWN_MS), progress: q.target },
      });
      completed.push({ name: QUEST_NAME_TH[q.type as HourlyQuestType], rewardGold: q.rewardGold, rewardXp: q.rewardXp, rewardCard: q.rewardCard });
    } else {
      await prisma.hourlyQuest.update({
        where: { id: q.id },
        data: { progress: q.progress + amount },
      });
    }
  }
  return completed;
}
