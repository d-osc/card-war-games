// ===========================================================================
// Card War — shared types ใช้ร่วมกันทั้ง client และ server
// ===========================================================================

export type Rarity = 'C' | 'UC' | 'R' | 'SR' | 'SSR';

export const RARITIES: Rarity[] = ['C', 'UC', 'R', 'SR', 'SSR'];

export const RARITY_NAME_TH: Record<Rarity, string> = {
  C: 'ธรรมดา',
  UC: 'ไม่ธรรมดา',
  R: 'หายาก',
  SR: 'หายากมาก',
  SSR: 'ตำนาน',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  C: '#8f9aa8',
  UC: '#3fb950',
  R: '#3d8bfd',
  SR: '#a371f7',
  SSR: '#f5b301',
};

/** หมวดหมู่ย่อยของการ์ด (ใช้กำหนดช่องสวมใส่ / กฎการใช้งาน) */
export type CardCategory =
  // อุปกรณ์สวมใส่
  | 'hat' | 'top' | 'pants' | 'shoes' | 'gloves' | 'ring' | 'bracelet' | 'earring'
  | 'weapon'
  // ของกิน/ยา
  | 'food' | 'potion'
  // วัตถุดิบ (กินไม่ได้)
  | 'ore' | 'gem' | 'herb' | 'wood' | 'monster_part' | 'ingredient'
  // เครื่องมือ
  | 'pickaxe' | 'axe' | 'sickle'
  // สกิล
  | 'skill_magic' | 'skill_physical'
  // สัตว์เลี้ยง
  | 'pet'
  // ของเควสต์ (เฟส 2)
  | 'quest';

/** กลุ่มใหญ่ของการ์ด */
export type CardGroup =
  | 'equipment'   // สวมใส่ได้
  | 'consumable'  // ใช้แล้วหาย (ยา/อาหาร)
  | 'material'    // วัตถุดิบ
  | 'tool'        // เครื่องมือ
  | 'skill'       // การ์ดสกิล เข้าเดคได้
  | 'pet'         // สัตว์เลี้ยง เข้าเดคได้
  | 'quest';      // ของเควสต์

export type WeaponKind = 'sword' | 'katara' | 'bow';

export const CATEGORY_NAME_TH: Record<CardCategory, string> = {
  hat: 'หมวก', top: 'ชุดเกราะ', pants: 'กางเกง', shoes: 'รองเท้า', gloves: 'ถุงมือ',
  ring: 'แหวน', bracelet: 'กำไร', earring: 'ต่างหู', weapon: 'อาวุธ',
  food: 'อาหาร', potion: 'ยา',
  ore: 'แร่', gem: 'อัญมณี', herb: 'สมุนไพร', wood: 'ไม้', monster_part: 'ชิ้นส่วนมอนสเตอร์', ingredient: 'วัตถุดิบ',
  pickaxe: 'จอบขุดแร่', axe: 'ขวานตัดไม้', sickle: 'เคียวเก็บเกี่ยว',
  skill_magic: 'สกิลเวทมนต์', skill_physical: 'สกิลกายภาพ',
  pet: 'สัตว์เลี้ยง',
  quest: 'ของเควสต์',
};

export const GROUP_NAME_TH: Record<CardGroup, string> = {
  equipment: 'อุปกรณ์สวมใส่',
  consumable: 'ของใช้/ยา',
  material: 'วัตถุดิบ',
  tool: 'เครื่องมือ',
  skill: 'สกิล',
  pet: 'สัตว์เลี้ยง',
  quest: 'ของเควสต์',
};

export const GROUP_EMOJI: Record<CardGroup, string> = {
  equipment: '🛡️',
  consumable: '🧪',
  material: '🪨',
  tool: '⚒️',
  skill: '✨',
  pet: '🐾',
  quest: '📜',
};

/** ช่องสวมใส่ทั้งหมด */
export const EQUIP_SLOTS: CardCategory[] = [
  'weapon', 'hat', 'top', 'pants', 'shoes', 'gloves', 'ring', 'bracelet', 'earring',
];

/** สัตว์เลี้ยงสวมใส่แทนการลงเดค — ติดตัวได้สูงสุดเท่าจำนวนสัตว์เลี้ยงบนสนาม */
export const PET_EQUIP_MAX = 3;

/** เครื่องมือสวมใส่ติดตัว — ชนิดละ 1 ช่อง (จอบสำหรับเหมือง / ขวานสำหรับป่า) */
export const TOOL_CATEGORIES: CardCategory[] = ['pickaxe', 'axe', 'sickle'];

/** กฎเดค — ไม่จำกัดจำนวนใบและซ้ำได้ไม่จำกัด แต่ต้องมีขั้นต่ำเพื่อเข้าต่อสู้ (กันเดคเปล่าแพ้ fatigue ทันที) */
export const DECK_MIN = 10;
/** สัตว์เลี้ยง "สวมใส่" ไม่ต้องลงเดค */
export const DECK_ALLOWED_GROUPS: CardGroup[] = ['skill', 'consumable'];

// ===========================================================================
// สเตตัส
// ===========================================================================

export interface Stats {
  hp: number;        // พลังชีวิตสูงสุด
  hpRegen: number;   // ฟื้นพลังชีวิตต่อเทิร์น (ใน battle)
  atk: number;       // โจมตีกายภาพ
  def: number;       // ป้องกันกายภาพ
  matk: number;      // โจมตีเวทมนต์
  mdef: number;      // ป้องกันเวทมนต์
  spd: number;       // ความเร็ว
  luck: number;      // โชค — เพิ่มโอกาสเจอของ tier สูงตอนเก็บของ
  manaMax: number;   // มานาสูงสุด (ใช้สกิลเวท)
  manaRegen: number; // มานาที่ฟื้นต่อเทิร์น
  stamMax: number;   // กำลังสูงสุด (ใช้สกิลกายภาพ)
  stamRegen: number; // กำลังที่ฟื้นต่อเทิร์น
}

export type StatKey = keyof Stats;

export const STAT_NAME_TH: Record<StatKey, string> = {
  hp: 'พลังชีวิต', hpRegen: 'ฟื้นพลังชีวิต/เทิร์น', atk: 'โจมตี',
  luck: 'โชค', def: 'ป้องกัน', matk: 'เวทมนต์', mdef: 'ต้านเวท',
  spd: 'ความเร็ว', manaMax: 'มานาสูงสุด', manaRegen: 'ฟื้นมานา/เทิร์น',
  stamMax: 'กำลังสูงสุด', stamRegen: 'ฟื้นกำลัง/เทิร์น',
};

export const ALLOCATABLE_STATS: StatKey[] = [
  'hp', 'hpRegen', 'atk', 'def', 'matk', 'mdef', 'spd', 'luck', 'manaMax', 'stamMax',
];

export function zeroStats(): Stats {
  return {
    hp: 0, hpRegen: 0, atk: 0, def: 0, matk: 0, mdef: 0, spd: 0, luck: 0,
    manaMax: 0, manaRegen: 0, stamMax: 0, stamRegen: 0,
  };
}

export function addStats(base: Stats, ...others: Partial<Stats>[]): Stats {
  const out = { ...base };
  for (const o of others) {
    for (const k of Object.keys(o) as StatKey[]) out[k] += o[k] ?? 0;
  }
  return out;
}

/** เกณฑ์การ์ดเข้าเดคได้ (สกิล/ยา/อาหาร) — สัตว์เลี้ยงสวมใส่ ไม่ลงเดค */
export function isDeckable(t: CardTemplate): boolean {
  return DECK_ALLOWED_GROUPS.includes(t.group);
}

// ===========================================================================
// เอฟเฟกต์ของการ์ด
// ===========================================================================

export type SkillKind =
  | 'physical'   // ดาเมจกายภาพ (ใช้กำลัง)
  | 'magic'      // ดาเมจเวทมนต์ (ใช้มานา)
  | 'heal'       // รักษาตัวเอง (ใช้มานา)
  | 'shield'     // เกราะป้องกัน (ใช้กำลัง)
  | 'buff_atk'   // เพิ่มโจมตีชั่วคราว (ใช้กำลัง)
  | 'buff_matk'  // เพิ่มเวทชั่วคราว (ใช้มานา)
  | 'poison';    // ทำให้ศัตรูพิษ (ใช้มานา)

export interface SkillEffect {
  kind: SkillKind;
  power: number;
  duration?: number; // จำนวนเทิร์น (poison/buff)
}

export interface ConsumableEffect {
  heal?: number;      // ฟื้น HP (ใน/นอก battle ไม่มีผลนอก battle — HP รีเซ็ตทุก battle)
  mana?: number;      // ฟื้นมานา (ใน battle)
  stam?: number;      // ฟื้นกำลัง (ใน battle)
  atkBuff?: number;   // บัฟโจมตี (ใน battle)
  matkBuff?: number;  // บัฟเวท (ใน battle)
  buffTurns?: number;
  energy?: number;    // ฟื้นพลังงาน (ใช้นอก battle)
}

export interface PetEffect {
  atk: number; // ดาเมจที่สัตว์เลี้ยงจิ้มศัตรูทุกเทิร์นของเจ้าของ
  hp: number;
}

/** นิยามการ์ด 1 แบบ (ข้อมูลคงที่ seed ลง DB) */
export interface CardTemplate {
  id: string;
  name: string;
  emoji: string;
  category: CardCategory;
  group: CardGroup;
  rarity: Rarity;
  basePrice: number;      // ราคาฐานของระบบ = ราคาขั้นต่ำตอนขาย
  description: string;
  shardCost: number;      // ชาร์ดที่ใช้อัญเชิญใน battle (0 = เล่นใน battle ไม่ได้)
  tier: number;           // เกรดวัตถุดิบ 1-5 (อุปกรณ์ใช้ 0)
  weaponKind?: WeaponKind;
  equip?: Partial<Stats>; // โบนัสสเตตัสเมื่อสวมใส่
  skill?: SkillEffect;
  consumable?: ConsumableEffect;
  pet?: PetEffect;
  /** ภาพอาร์ตกลางการ์ด (URL/พาธ) — ไม่ระบุจะลอง /card-art/{id}.png แล้วค่อย fallback เป็นไอคอน/อีโมจิ */
  image?: string;
}

/** ค่าใช้ทรัพยากรของการ์ดใน battle (คำนวณจาก template) */
export function resourceCost(t: CardTemplate): { shard: number; mana: number; stam: number } {
  const shard = t.shardCost;
  let mana = 0;
  let stam = 0;
  if (t.group === 'skill' && t.skill) {
    const cast = Math.ceil(t.skill.power / 8);
    if (t.skill.kind === 'physical' || t.skill.kind === 'shield' || t.skill.kind === 'buff_atk') stam += cast;
    else mana += cast;
  }
  return { shard, mana, stam };
}

export const BASE_PRICE: Record<Rarity, number> = {
  C: 20, UC: 50, R: 150, SR: 500, SSR: 2000,
};

export const DEFAULT_SHARD_COST: Record<Rarity, number> = {
  C: 1, UC: 2, R: 3, SR: 4, SSR: 5,
};

// ===========================================================================
// การเลื่อนเลเวล
// ===========================================================================

export function xpForLevel(level: number): number {
  // XP สะสมที่ต้องมีเพื่อขึ้นจากเลเวล level -> level+1
  return 60 + (level - 1) * 40;
}

export const LEVEL_STAT_POINTS = 3;

// ===========================================================================
// เศรษฐกิจ / ค่าคงที่
// ===========================================================================

export const GOLD_START = 600;
export const ENERGY_MAX = 100;
export const ENERGY_REGEN_MS = 30_000; // ฟื้น 1 พลังงานทุก 30 วินาที
/** มานา/กำลังนอกสนาม — ฟื้น 1 จุดต่อรอบ (ใน battle ฟื้นตามเทิร์นตามสเตตัส) */
export const REST_REGEN_MS = 3_600_000;
/** การฟื้นนอกสนาม (ต่อรอบ): hp +hpRegen ตามสถิติ, มานา +1, กำลัง +1
 *  รอบฟื้น = 60 นาที − (ความเร็ว × 2 นาที) แต่ไม่สั้นกว่า 10 นาที */
export const REST_TICK_BASE_MIN = 60;
export const SPD_REST_MIN_PER_POINT = 2;
export const REST_TICK_MIN_MIN = 10;
export const GATHER_ENERGY_COST = 10;
/** เก็บของทุกโซน (เหมือง/ตัดไม้/เก็บเกี่ยว) ใช้ "กำลัง" */
export const GATHER_STAM_COST = 5;

/** ความทนทานสูงสุดของเครื่องมือ = 20 × เกรด (ทน 20/40/60 ครั้ง) */
export function toolMaxDurability(tier: number): number {
  return 20 * Math.max(1, tier);
}
/** ค่าซ่อมเครื่องมือ = 25 ทอง × เกรด (ซ่อมให้เต็ม) */
export const TOOL_REPAIR_GOLD_PER_TIER = 25;
export const GATHER_XP = 8;
export const CRAFT_XP = 12;
export const GACHA_COST = 100;
export const GACHA_RATES: { rarity: Rarity; weight: number }[] = [
  { rarity: 'C', weight: 50 },
  { rarity: 'UC', weight: 28 },
  { rarity: 'R', weight: 15 },
  { rarity: 'SR', weight: 5.5 },
  { rarity: 'SSR', weight: 1.5 },
];
export const SYSTEM_SHOP_MARKUP = 1.25; // การ์ดที่ผู้เล่นขายคืน ระบบขายต่อ +25%
export const DESTROY_REFUND_RATE = 0.2; // ทำลายการ์ดคืนทอง 20% ของราคาฐาน
export const STARTING_RATING = 1000;
export const ELO_K = 32;
export const PVP_TURN_MS = 60_000;
export const MAX_TURNS = 30;
export const DUNGEON_FLOORS = 5;

// ===========================================================================
// Quest รายชั่วโมง
// ===========================================================================

export type HourlyQuestType =
  | 'GATHER_MINE'    // ขุดแร่ N ครั้ง
  | 'GATHER_FOREST'  // เก็บของป่า N ครั้ง
  | 'WIN_PVP'        // ชนะ PvP N ครั้ง
  | 'CLEAR_FLOOR'    // ผ่านดันเจี้ยนชั้นที่แน่ะนำ
  | 'CRAFT'          // craft N ครั้ง
  | 'GACHA';         // กาชา N ครั้ง

export const QUEST_NAME_TH: Record<HourlyQuestType, string> = {
  GATHER_MINE: 'ขุดแร่ในเหมือง',
  GATHER_FOREST: 'เก็บของในป่า',
  WIN_PVP: 'ชนะการประลอง PvP',
  CLEAR_FLOOR: 'พิชิตดันเจี้ยน',
  CRAFT: 'หมุนวงจรคราฟต์',
  GACHA: 'สุ่มกาชาการ์ด',
};

export const QUEST_COOLDOWN_MS = 60 * 60 * 1000; // 1 ชั่วโมง

// ===========================================================================
// Ledger (ระบบบัญชีเงิน/การ์ดแบบปิดวงจร)
// ===========================================================================

export type LedgerType =
  | 'MINT_CARD' | 'BURN_CARD'
  | 'SELL_TO_SYSTEM' | 'SHOP_BUY'
  | 'GACHA_PULL'
  | 'CRAFT_CONSUME' | 'CRAFT_PRODUCE'
  | 'PVP_REWARD' | 'DUNGEON_REWARD'
  | 'QUEST_REWARD'
  | 'GATHER_REWARD' | 'GATHER_CONSUME'
  | 'TOOL_REPAIR'
  | 'CHARACTER_CREATE'
  | 'DESTROY_REFUND'
  | 'STAT_ALLOCATE'
  // เฟส 2 — ตลาดการ์ด
  | 'AUCTION_LIST'      // ค่าธรรมเนียมตั้งประมูล
  | 'AUCTION_BID'       // เงินวางประกันการเสนอราคา
  | 'AUCTION_REFUND'    // คืนเงินผู้เสนอราคาก่อนหน้า
  | 'AUCTION_PAYOUT'    // ผู้ขายได้รับเงินหลังหักค่าธรรมเนียม
  | 'AUCTION_WIN'       // ผู้ชนะจ่ายเงินแลกการ์ด
  | 'DIRECT_LIST'       // ค่าธรรมเนียมตั้งขายตรง
  | 'DIRECT_BUY'        // ซื้อขายตรง
  | 'DIRECT_PAYOUT'     // ผู้ขายได้รับเงินหลังหักค่าธรรมเนียม
  // เฟส 2 — โซเชียล
  | 'GUILD_CREATE'      // ค่าสร้างกิลด์
  // เฟส 2 — เควสต์ผู้เล่น
  | 'PLAYER_QUEST_CREATE'  // ฝากรางวัล + ค่าธรรมเนียม
  | 'PLAYER_QUEST_DELIVER' // ผู้ส่งมอบได้รับรางวัล
  | 'PLAYER_QUEST_REFUND'  // ยกเลิกเควสต์ คืนเงินคงเหลือ
  // เงินจริง
  | 'IAP_PURCHASE'        // ซื้อแพ็กพิเศษด้วยเงินจริง
  // แอดมิน
  | 'ADMIN_ADJUST';       // แอดมินปรับยอด/มองการ์ด

export const LEDGER_NAME_TH: Record<LedgerType, string> = {
  MINT_CARD: 'ระบบออกการ์ด',
  BURN_CARD: 'การ์ดถูกทำลาย',
  SELL_TO_SYSTEM: 'ขายการ์ดคืนระบบ',
  SHOP_BUY: 'ซื้อการ์ดจากร้านมือสอง',
  GACHA_PULL: 'สุ่มกาชาการ์ด',
  CRAFT_CONSUME: 'ใช้วัตถุดิบคราฟต์',
  CRAFT_PRODUCE: 'ได้การ์ดจากคราฟต์',
  PVP_REWARD: 'รางวัล PvP',
  DUNGEON_REWARD: 'รางวัลดันเจี้ยน',
  QUEST_REWARD: 'รางวัลเควสต์',
  GATHER_REWARD: 'รางวัลการเก็บของ',
  GATHER_CONSUME: 'ใช้พลังงานเก็บของ',
  TOOL_REPAIR: 'ซ่อมเครื่องมือ',
  CHARACTER_CREATE: 'สร้างตัวละคร',
  DESTROY_REFUND: 'ทองจากการทำลายการ์ด',
  STAT_ALLOCATE: 'ลงแต้มสเตตัส',
  AUCTION_LIST: 'ค่าธรรมเนียมตั้งประมูล',
  AUCTION_BID: 'วางประกันเสนอราคาประมูล',
  AUCTION_REFUND: 'คืนเงินประกันประมูล',
  AUCTION_PAYOUT: 'ขายประมูลสำเร็จ',
  AUCTION_WIN: 'ชนะประมูล',
  DIRECT_LIST: 'ค่าธรรมเนียมตั้งขายตรง',
  DIRECT_BUY: 'ซื้อการ์ดแบบระบุผู้เล่น',
  DIRECT_PAYOUT: 'ขายตรงสำเร็จ',
  GUILD_CREATE: 'สร้างกิลด์',
  PLAYER_QUEST_CREATE: 'ตั้งเควสต์ (ฝากรางวัล)',
  PLAYER_QUEST_DELIVER: 'ส่งมอบการ์ดตามเควสต์',
  PLAYER_QUEST_REFUND: 'คืนเงินคงค้างเควสต์',
  IAP_PURCHASE: 'ซื้อแพ็กพิเศษ (เงินจริง)',
  ADMIN_ADJUST: 'แอดมินจัดการ',
};

// ---------------------------------------------------------------------------
// ตลาดการ์ด (เฟส 2) — ประมูล + ขายตรง
// ---------------------------------------------------------------------------
export const MARKET_FEE_RATE = 0.05;          // ค่าธรรมเนียม 5% (ตั้งประกาศ + ตอนขายสำเร็จ)
export const MARKET_MIN_FEE = 5;              // ขั้นต่ำ 5 ทอง
export const AUCTION_MIN_INCREMENT = 0.1;     // เสนอราคาถัดไป +10% ของราคาปัจจุบัน
export const AUCTION_DURATIONS_H = [6, 12, 24];      // ชั่วโมงที่เลือกได้
export const DIRECT_SALE_HOURS = 48;          // ขายตรงหมดอายุใน 48 ชม.
export const GUILD_CREATE_COST = 1000;        // ค่าสร้างกิลด์
export const PLAYER_QUEST_FEE_RATE = 0.1;     // ค่าธรรมเนียมตั้งเควสต์ 10% ของเงินรางวัล
export const PLAYER_QUEST_MAX_QTY = 20;       // จำนวนการ์ดที่ขอได้สูงสุดต่อเควสต์
export const PLAYER_QUEST_XP_GOLD_RATE = 0.1; // ค่ารางวัล XP — 1 ทอง = 10 XP
export const PLAYER_QUEST_MAX_XP_PER_UNIT = 100; // XP ต่อใบสูงสุดที่ตั้งได้

/** โควตาการผลิตสูงสุดต่อการ์ด 1 แบบ ตามความหายาก — mint เกินไม่ได้ */
export const RARITY_MAX_SUPPLY: Record<Rarity, number> = {
  SSR: 10_000,
  SR: 50_000,
  R: 150_000,
  UC: 500_000,
  C: 1_000_000,
};

// ---------------------------------------------------------------------------
// แพ็กพิเศษ (IAP) — ขายด้วยเงินจริง · โบนัสซื้อครั้งแรกต่อแพ็ก 1 ครั้ง
// ---------------------------------------------------------------------------
export interface IapPackage {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  gold: number;
  firstBonusGold: number;   // ทองโบนัสเมื่อซื้อแพ็กนี้ครั้งแรก
  guaranteedTemplateId?: string; // การ์ดการันตีที่ได้ทุกครั้ง
  priceTHB: number;
}

export const IAP_PACKAGES: IapPackage[] = [
  { id: 'pack_starter', title: 'แพ็กนักผจญภัย', emoji: '🎒', desc: 'ทุนทองสำหรับเริ่มต้นผจญภัย', gold: 1000, firstBonusGold: 500, priceTHB: 39 },
  { id: 'pack_collector', title: 'แพ็กนักสะสม', emoji: '💎', desc: 'ทุนทองก้อนใหญ่ + ทับทิม (SR) การันตี', gold: 6000, firstBonusGold: 1500, guaranteedTemplateId: 'gem_ruby', priceTHB: 199 },
  { id: 'pack_legend', title: 'แพ็กเซียน', emoji: '👑', desc: 'ทุนทองมหาศาล + เพชร (SSR) การันตี', gold: 15000, firstBonusGold: 5000, guaranteedTemplateId: 'gem_diamond', priceTHB: 399 },
];

export function marketFee(amount: number): number {
  return Math.max(MARKET_MIN_FEE, Math.ceil(amount * MARKET_FEE_RATE));
}
