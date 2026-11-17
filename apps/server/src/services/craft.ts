import { cardById, CRAFT_XP, rollAlchemy, rollBrew, rollCook, rollCraftEquipment, CraftKey } from '@cardwar/shared';
import type { CardInstance as PCardInstance, Character } from '@prisma/client';
import { prisma } from '../db';
import { burnCard, mintCard } from './inventory';
import { grantXp } from './characters';
import { onQuestEvent } from './quests';
import { AppError } from '../errors';
import { recordLedger } from './ledger';

/** ดึง instance ของผู้เล่นพร้อมตรวจว่าเป็นของเขาและอยู่ในคลัง */
async function takeInputs(userId: number, serials: number[], allowed: (t: ReturnType<typeof cardById>) => boolean, minCount: number, station: string): Promise<PCardInstance[]> {
  const uniq = [...new Set(serials)];
  if (uniq.length !== serials.length) throw new AppError('มีการ์ดซ้ำในรายการวัตถุดิบ');
  if (serials.length < minCount) throw new AppError(`ต้องใส่วัตถุดิบอย่างน้อย ${minCount} ชิ้น`);
  const insts: PCardInstance[] = [];
  for (const serial of serials) {
    const inst = await prisma.cardInstance.findUnique({ where: { id: serial } });
    if (!inst || inst.ownerId !== userId || inst.status !== 'INVENTORY') {
      throw new AppError(`การ์ด #${serial} ไม่อยู่ในคลังของคุณ`);
    }
    const t = cardById(inst.templateId);
    if (!allowed(t)) throw new AppError(`${t.name} ใช้ในสถานี${station}ไม่ได้`);
    insts.push(inst);
  }
  return insts;
}

async function finalize(char: Character, inputs: PCardInstance[], outputTemplateId: string, station: string, ledgerType: 'CRAFT_CONSUME' | 'GATHER_CONSUME') {
  for (const inst of inputs) {
    await burnCard(inst, ledgerType, { station });
  }
  await recordLedger({ type: ledgerType, userId: char.userId, meta: { station, inputs: inputs.map((i) => i.templateId), output: outputTemplateId } });
  const output = await mintCard(outputTemplateId, char.userId, 'CRAFT_PRODUCE', { station });
  await grantXp(char, CRAFT_XP);
  await onQuestEvent(char.userId, 'CRAFT', 1);
  return { output, template: cardById(outputTemplateId), station };
}

// ---------------------------------------------------------------------------
// 1) คราฟต์อุปกรณ์: เลือกประเภท + ไม้ (กี่ชิ้นก็ได้) + แร่/อัญมณี (กี่ชิ้นก็ได้)
// ---------------------------------------------------------------------------

/** โบนัสคะแนนจากมินิเกม (hits 0-10 → คะแนน 0-5) — ยิ่งโดนโซนทองมาก ยิ่งมีโอกาสได้ของดี */
function hitsBonus(hits: number): number {
  return Math.max(0, Math.min(10, Math.floor(hits))) * 0.5;
}

export async function craftEquipment(char: Character, key: CraftKey, woodSerials: number[], oreSerials: number[], hits = 0) {
  const woods = await takeInputs(char.userId, woodSerials, (t) => t.category === 'wood', 1, 'คราฟต์อุปกรณ์');
  const ores = await takeInputs(char.userId, oreSerials, (t) => t.category === 'ore' || t.category === 'gem', 1, 'คราฟต์อุปกรณ์');
  const inputs = [...woods, ...ores];
  if (inputs.length > 20) throw new AppError('ใส่วัตถุดิบได้สูงสุด 20 ชิ้นต่อครั้ง');
  const output = rollCraftEquipment(key, inputs.map((i) => cardById(i.templateId)), Math.random, hitsBonus(hits));
  return finalize(char, inputs, output.id, `craft-equipment:${key}`, 'CRAFT_CONSUME');
}

// ---------------------------------------------------------------------------
// 2) แร่แปรธาตุ: แร่/อัญมณี ≥ 2 → สุ่มแร่/อัญมณีใหม่
// ---------------------------------------------------------------------------

export async function craftAlchemy(char: Character, serials: number[], hits = 0) {
  const inputs = await takeInputs(char.userId, serials, (t) => t.category === 'ore' || t.category === 'gem', 2, 'แร่แปรธาตุ');
  if (inputs.length > 20) throw new AppError('ใส่วัตถุดิบได้สูงสุด 20 ชิ้นต่อครั้ง');
  const output = rollAlchemy(inputs.map((i) => cardById(i.templateId)), Math.random, hitsBonus(hits));
  return finalize(char, inputs, output.id, 'alchemy', 'CRAFT_CONSUME');
}

// ---------------------------------------------------------------------------
// 3) ปรุงยา: สมุนไพร/ชิ้นส่วนมอนสเตอร์ ≥ 2 → สุ่มยา
// ---------------------------------------------------------------------------

export async function craftBrew(char: Character, serials: number[], hits = 0) {
  const inputs = await takeInputs(char.userId, serials, (t) => t.category === 'herb' || t.category === 'monster_part', 2, 'ปรุงยา');
  if (inputs.length > 20) throw new AppError('ใส่วัตถุดิบได้สูงสุด 20 ชิ้นต่อครั้ง');
  const output = rollBrew(inputs.map((i) => cardById(i.templateId)), Math.random, hitsBonus(hits));
  return finalize(char, inputs, output.id, 'brew', 'CRAFT_CONSUME');
}

// ---------------------------------------------------------------------------
// 4) ทำอาหาร: สมุนไพร/วัตถุดิบ ≥ 2 → สุ่มอาหาร
// ---------------------------------------------------------------------------

export async function craftCook(char: Character, serials: number[], hits = 0) {
  const inputs = await takeInputs(char.userId, serials, (t) => t.category === 'herb' || t.category === 'ingredient', 2, 'ทำอาหาร');
  if (inputs.length > 20) throw new AppError('ใส่วัตถุดิบได้สูงสุด 20 ชิ้นต่อครั้ง');
  const output = rollCook(inputs.map((i) => cardById(i.templateId)), Math.random, hitsBonus(hits));
  return finalize(char, inputs, output.id, 'cook', 'CRAFT_CONSUME');
}
