import { cardById, ForestActivity, GATHER_XP, GATHER_STAM_COST, rollGather, GatherZone, toolMaxDurability } from '@cardwar/shared';
import type { Character } from '@prisma/client';
import { prisma } from '../db';
import { recordLedger } from './ledger';
import { mintCard } from './inventory';
import { computeStats, grantXp, syncManaStam } from './characters';
import { onQuestEvent } from './quests';
import { AppError } from '../errors';

const ZONE_INFO: Record<GatherZone, { tool: string; name: string }> = {
  mine: { tool: 'pickaxe', name: 'เหมือง' },
  forest: { tool: 'axe', name: 'ป่า' },
};

/** คำนำหน้า template ของเครื่องมือตามโซน+กิจกรรม (ป่าแบ่งตัดไม้=ขวาน / เก็บเกี่ยว=เคียว) */
function toolPrefix(zone: GatherZone, activity: ForestActivity): string {
  if (zone === 'mine') return 'tool_pickaxe';
  return activity === 'harvest' ? 'tool_sickle' : 'tool_axe';
}

/** หาเครื่องมือเกรดดีสุดที่ความทนทานยัง > 0 (สวมใส่/ในคลัง; เครื่องมือเก่าที่ null = ถือว่าเต็ม) */
async function bestTool(userId: number, zone: GatherZone, activity: ForestActivity): Promise<{ id: number; tier: number; durability: number } | null> {
  const tools = await prisma.cardInstance.findMany({
    where: { ownerId: userId, status: { in: ['INVENTORY', 'EQUIPPED'] }, templateId: { startsWith: zone === 'mine' ? 'tool_pickaxe' : 'tool_axe' } },
  });
  let best: { id: number; tier: number; durability: number } | null = null;
  for (const tool of tools) {
    const t = cardById(tool.templateId);
    const dura = tool.durability ?? toolMaxDurability(t.tier);
    if (dura <= 0) continue;
    if (!best || t.tier > best.tier) best = { id: tool.id, tier: t.tier, durability: dura };
  }
  if (!best && tools.length === 0) {
    throw new AppError(`ต้องมี${zone === 'mine' ? 'จอบขุดแร่' : 'ขวานตัดไม้'}ติดตัวก่อน (ซื้อจากร้านมือสอง หรือคราฟต์เอง)`);
  }
  return best;
}

/** ขั้นที่ 1 — เริ่มขุด: ตรวจและหักต้นทุนก่อน (กำลัง/พลังงาน + ความทนทานเครื่องมือ −1)
 *  จากนั้น client ไปเล่นมินิเกม แล้วเรียก gatherReward พร้อมค่าโชค */
export async function gatherStart(char0: Character, zone: GatherZone, activity: ForestActivity = 'wood'): Promise<{ toolTier: number }> {
  // ทุกโซนใช้ "กำลัง" — ซิงก์การฟื้นนอกสนามก่อนตรวจ
  const char = await syncManaStam(char0);
  if (char.stam < GATHER_STAM_COST) {
    throw new AppError(`กำลังไม่พอ (ต้องใช้ ${GATHER_STAM_COST} — ฟื้น 1 จุดต่อรอบตามความเร็ว, ใน battle ฟื้นต่อเทิร์น)`);
  }
  const best = await bestTool(char.userId, zone, activity);
  if (!best) {
    throw new AppError(`${zone === 'mine' ? 'จอบขุดแร่' : 'ขวานตัดไม้'}พังหมดแล้ว (ความทนทาน 0) — เปิดคลังการ์ดกดซ่อมก่อน`);
  }

  // หักต้นทุนทันทีก่อนเข้ามินิเกม
  await prisma.character.update({ where: { id: char.id }, data: { stam: char.stam - GATHER_STAM_COST } });
  await prisma.cardInstance.update({ where: { id: best.id }, data: { durability: best.durability - 1 } });
  return { toolTier: best.tier };
}

/** ขั้นที่ 2 — รับค่าโชคจากมินิเกมแล้วสุ่มการ์ด + รางวัล (ต้นทุนหักไปแล้วใน gatherStart) */
export async function gatherReward(char0: Character, zone: GatherZone, miniLuck = 0, activity: ForestActivity = 'wood'): Promise<{
  templateId: string; goldBonus: number; xp: number; luckUsed: number;
}> {
  const char = await syncManaStam(char0);
  // เกรดเครื่องมือ: ใช้เกรดดีสุดที่มี (รวมใบที่เพิ่งสึกลงเป็น 0 ในรอบนี้) เพราะต้นทุนจ่ายไปแล้ว
  const tools = await prisma.cardInstance.findMany({
    where: { ownerId: char.userId, status: { in: ['INVENTORY', 'EQUIPPED'] }, templateId: { startsWith: toolPrefix(zone, activity) } },
  });
  let bestTier = 1;
  for (const tool of tools) bestTier = Math.max(bestTier, cardById(tool.templateId).tier);

  // โชครวม = คะแนนมินิเกม (clamp 0-10) + โชคจากสเตตัส (อุปกรณ์/แต้ม)
  const equipped = await prisma.cardInstance.findMany({ where: { ownerId: char.userId, status: 'EQUIPPED' } });
  const luckUsed = Math.max(0, Math.min(10, Math.floor(miniLuck))) + computeStats(char, equipped).luck;

  const template = rollGather(zone, bestTier, Math.random, luckUsed, activity);
  const goldBonus = 5 + Math.floor(Math.random() * 11); // 5-15 ทอง

  await mintCard(template.id, char.userId, 'GATHER_REWARD', { zone, activity, toolTier: bestTier, luck: luckUsed });
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + goldBonus } });
  await recordLedger({ type: 'GATHER_REWARD', userId: char.userId, templateId: template.id, gold: goldBonus, meta: { zone, luck: luckUsed } });
  await grantXp(char, GATHER_XP);
  await onQuestEvent(char.userId, zone === 'mine' ? 'GATHER_MINE' : 'GATHER_FOREST', 1);

  return { templateId: template.id, goldBonus, xp: GATHER_XP, luckUsed };
}
