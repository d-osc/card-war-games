// ===========================================================================
// Card War — สเตตัสฐานของตัวละคร (ไม่มีระบบอาชีพ ทุกคนเริ่มเท่ากัน
// ต่างกันที่การจัดเดค อุปกรณ์ และการลงแต้มสเตตัส)
// ===========================================================================
import { Stats } from './types';

/** อิโมจิแทนตัวละครผู้เล่น (ใช้ใน battle/dashboard) */
export const HERO_EMOJI = '🧙';

/** สเตตัสเลเวล 1 */
export const PLAYER_BASE: Stats = {
  hp: 110, hpRegen: 3, atk: 9, def: 6, matk: 9, mdef: 6, spd: 6, luck: 1,
  manaMax: 45, manaRegen: 3, stamMax: 40, stamRegen: 4,
};

/** สเตตัสที่บวกอัตโนมัติทุกเลเวล */
export const PLAYER_GROWTH: Stats = {
  hp: 12, hpRegen: 0, atk: 1, def: 1, matk: 1, mdef: 1, spd: 1, luck: 0,
  manaMax: 4, manaRegen: 0, stamMax: 4, stamRegen: 0,
};

/** เดคเริ่มต้น 20 ใบ (สมดุลทั้งกายภาพ/เวท) */
export const STARTER_TEMPLATE_IDS: string[] = [
  'skill_quick_slash', 'skill_quick_slash', 'skill_quick_slash',
  'skill_spark', 'skill_spark', 'skill_spark',
  'skill_heavy_slash', 'skill_heavy_slash',
  'skill_fireball', 'skill_fireball',
  'skill_shield_bash', 'skill_shield_bash',
  'skill_heal', 'skill_heal', 'skill_heal',
  'potion_hp', 'potion_hp',
  'potion_mana',
  'pet_slime', 'pet_slime',
];

/** อุปกรณ์เริ่มต้น (สวมใส่ทันที) */
export const STARTER_EQUIP: string[] = ['sword_iron', 'top_leather', 'shoes_straw', 'ring_mana'];

/** เครื่องมือเริ่มต้นที่ทุกคนได้รับ */
export const STARTER_TOOLS = ['tool_pickaxe_rusty', 'tool_axe_rusty'];
