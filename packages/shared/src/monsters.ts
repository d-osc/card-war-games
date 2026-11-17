// ===========================================================================
// Card War — มอนสเตอร์ในดันเจี้ยน
// ===========================================================================
import { Stats } from './types';

export interface MonsterDef {
  id: string;
  name: string;
  emoji: string;
  floor: number;   // ชั้นของดันเจี้ยน
  level: number;
  stats: Stats;
  deck: string[];  // templateId ของการ์ดที่มอนสเตอร์ใช้ (ซ้ำได้)
  xp: number;
  goldMin: number;
  goldMax: number;
  drops: { templateId: string; chance: number }[];
}

function st(partial: Partial<Stats>): Stats {
  return {
    hp: 100, hpRegen: 2, atk: 5, def: 3, matk: 2, mdef: 2, spd: 5, luck: 0,
    manaMax: 40, manaRegen: 3, stamMax: 40, stamRegen: 3,
    ...partial,
  };
}

function deck(...entries: [string, number][]): string[] {
  const out: string[] = [];
  for (const [id, n] of entries) for (let i = 0; i < n; i++) out.push(id);
  return out;
}

export const MONSTERS: MonsterDef[] = [
  {
    id: 'slime', name: 'สไลม์เขียว', emoji: '🟢', floor: 1, level: 2,
    stats: st({ hp: 90, atk: 7, def: 3, matk: 2, mdef: 2, spd: 3 }),
    deck: deck(['skill_quick_slash', 4], ['skill_spark', 2], ['skill_heal', 2]),
    xp: 40, goldMin: 30, goldMax: 60,
    drops: [
      { templateId: 'mp_slime_gel', chance: 0.6 },
      { templateId: 'herb_mint', chance: 0.3 },
      { templateId: 'potion_hp_minor', chance: 0.25 },
      { templateId: 'pet_slime', chance: 0.05 },
    ],
  },
  {
    id: 'goblin', name: 'ก็อบลินโจรป่า', emoji: '👺', floor: 2, level: 4,
    stats: st({ hp: 140, atk: 12, def: 6, matk: 4, mdef: 4, spd: 6 }),
    deck: deck(['skill_quick_slash', 3], ['skill_heavy_slash', 2], ['skill_shield_bash', 2], ['skill_war_cry', 1], ['potion_hp', 2]),
    xp: 70, goldMin: 60, goldMax: 110,
    drops: [
      { templateId: 'mp_wolf_fang', chance: 0.35 },
      { templateId: 'ore_copper', chance: 0.4 },
      { templateId: 'ing_honey', chance: 0.3 },
      { templateId: 'sword_iron', chance: 0.08 },
      { templateId: 'pet_wolf', chance: 0.04 },
    ],
  },
  {
    id: 'wolf_king', name: 'ราชาหมาป่า', emoji: '🐺', floor: 3, level: 6,
    stats: st({ hp: 210, atk: 18, def: 9, matk: 6, mdef: 6, spd: 10 }),
    deck: deck(['skill_quick_slash', 4], ['skill_triple_hit', 2], ['skill_war_cry', 2], ['potion_hp', 2]),
    xp: 120, goldMin: 100, goldMax: 160,
    drops: [
      { templateId: 'mp_wolf_fang', chance: 0.5 },
      { templateId: 'herb_ginseng', chance: 0.35 },
      { templateId: 'gem_amethyst', chance: 0.2 },
      { templateId: 'hat_leather', chance: 0.1 },
      { templateId: 'pet_wolf', chance: 0.06 },
    ],
  },
  {
    id: 'golem', name: 'โกเลมหินโบราณ', emoji: '🗿', floor: 4, level: 8,
    stats: st({ hp: 340, atk: 24, def: 16, matk: 8, mdef: 12, spd: 4 }),
    deck: deck(['skill_heavy_slash', 3], ['skill_shield_bash', 3], ['skill_triple_hit', 2], ['skill_berserker', 1]),
    xp: 200, goldMin: 150, goldMax: 220,
    drops: [
      { templateId: 'mp_golem_core', chance: 0.3 },
      { templateId: 'ore_iron', chance: 0.5 },
      { templateId: 'ore_silver', chance: 0.25 },
      { templateId: 'gem_sapphire', chance: 0.12 },
      { templateId: 'gloves_iron', chance: 0.1 },
    ],
  },
  {
    id: 'dragon', name: 'มังกรเพลิง', emoji: '🐉', floor: 5, level: 10,
    stats: st({ hp: 520, hpRegen: 6, atk: 34, def: 20, matk: 26, mdef: 16, spd: 12, manaMax: 70, manaRegen: 5 }),
    deck: deck(['skill_fireball', 3], ['skill_lightning', 2], ['skill_heavy_slash', 2], ['skill_triple_hit', 2], ['skill_heal', 2]),
    xp: 350, goldMin: 250, goldMax: 400,
    drops: [
      { templateId: 'mp_dragon_heart', chance: 0.15 },
      { templateId: 'ore_mythril', chance: 0.3 },
      { templateId: 'gem_ruby', chance: 0.2 },
      { templateId: 'herb_phoenix', chance: 0.1 },
      { templateId: 'wood_dragon', chance: 0.1 },
      { templateId: 'sword_knight', chance: 0.12 },
      { templateId: 'pet_dragon', chance: 0.03 },
    ],
  },
];

export function monsterForFloor(floor: number): MonsterDef {
  const m = MONSTERS.find((x) => x.floor === floor);
  if (!m) throw new Error(`No monster for floor ${floor}`);
  return m;
}
