// ===========================================================================
// Card War — แค็ตตาล็อกการ์ดทั้งหมด + ตารางสุ่ม (drop / gacha / craft / gather)
// ===========================================================================
import {
  BASE_PRICE, DEFAULT_SHARD_COST, CardTemplate, CardCategory, Rarity, RARITIES, SkillKind,
} from './types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const matPrice = (r: Rarity) => Math.round(BASE_PRICE[r] * 0.8);
const toolPrice = (r: Rarity) => Math.round(BASE_PRICE[r] * 3);

function mat(id: string, name: string, emoji: string, category: CardCategory, rarity: Rarity, desc: string): CardTemplate {
  return {
    id, name, emoji, category, group: 'material', rarity,
    basePrice: matPrice(rarity), description: desc,
    shardCost: 0, tier: RARITIES.indexOf(rarity) + 1,
  };
}

function tool(id: string, name: string, emoji: string, category: 'pickaxe' | 'axe' | 'sickle', rarity: Rarity, desc: string): CardTemplate {
  return {
    id, name, emoji, category, group: 'tool', rarity,
    basePrice: toolPrice(rarity), description: desc,
    shardCost: 0, tier: RARITIES.indexOf(rarity) + 1,
  };
}

function equip(
  id: string, name: string, emoji: string, category: CardCategory, rarity: Rarity,
  stats: CardTemplate['equip'], desc: string, weaponKind?: CardTemplate['weaponKind'],
): CardTemplate {
  return {
    id, name, emoji, category, group: 'equipment', rarity,
    basePrice: BASE_PRICE[rarity], description: desc,
    shardCost: 0, tier: 0, equip: stats, weaponKind,
  };
}

function skill(id: string, name: string, emoji: string, kind: SkillKind, power: number, rarity: Rarity, desc: string, duration?: number): CardTemplate {
  return {
    id, name, emoji, category: kind === 'physical' || kind === 'shield' || kind === 'buff_atk' ? 'skill_physical' : 'skill_magic',
    group: 'skill', rarity, basePrice: BASE_PRICE[rarity], description: desc,
    shardCost: DEFAULT_SHARD_COST[rarity], tier: 0,
    skill: { kind, power, duration },
  };
}

function potionCard(id: string, name: string, emoji: string, rarity: Rarity, desc: string, effect: CardTemplate['consumable']): CardTemplate {
  return {
    id, name, emoji, category: 'potion', group: 'consumable', rarity,
    basePrice: BASE_PRICE[rarity], description: desc,
    shardCost: DEFAULT_SHARD_COST[rarity], tier: 0, consumable: effect,
  };
}

function foodCard(id: string, name: string, emoji: string, rarity: Rarity, desc: string, effect: CardTemplate['consumable']): CardTemplate {
  return {
    id, name, emoji, category: 'food', group: 'consumable', rarity,
    basePrice: BASE_PRICE[rarity], description: desc,
    shardCost: DEFAULT_SHARD_COST[rarity], tier: 0, consumable: effect,
  };
}

function petCard(id: string, name: string, emoji: string, rarity: Rarity, atk: number, hp: number, desc: string): CardTemplate {
  return {
    id, name, emoji, category: 'pet', group: 'pet', rarity,
    basePrice: BASE_PRICE[rarity], description: desc,
    shardCost: DEFAULT_SHARD_COST[rarity] + 1, tier: 0,
    pet: { atk, hp },
  };
}

// ---------------------------------------------------------------------------
// วัตถุดิบ
// ---------------------------------------------------------------------------
const MATERIALS: CardTemplate[] = [
  // ไม้
  mat('wood_pine', 'ไม้สน', '🪵', 'wood', 'C', 'ไม้จากต้นสน วัตถุดิบพื้นฐานของช่างฝีมือ'),
  mat('wood_oak', 'ไม้โอ๊ก', '🌳', 'wood', 'UC', 'ไม้แข็งแรงกว่า นิยมทำด้ามอาวุธ'),
  mat('wood_ironwood', 'ไม้เหล็ก', '🪵', 'wood', 'R', 'เนื้อไม้แกร่งดั่งเหล็ก ทนทานมาก'),
  mat('wood_spirit', 'ไม้วิญญาณ', '🎋', 'wood', 'SR', 'ไม้ศักดิ์สิทธิ์เปล่งประกายอ่อน ๆ'),
  mat('wood_dragon', 'ไม้มังกร', '🐉', 'wood', 'SSR', 'ไม้จากต้นไม้อายุพันปี แผ่ออร่ามังกร'),
  // แร่
  mat('ore_copper', 'แร่ทองแดง', '🟤', 'ore', 'C', 'แร่พื้นฐานที่ขุดได้ง่ายที่สุด'),
  mat('ore_iron', 'แร่เหล็ก', '⛏️', 'ore', 'UC', 'แร่เหล็กแท้ ใช้หลอมอาวุธทั่วไป'),
  mat('ore_silver', 'แร่เงิน', '🪙', 'ore', 'R', 'แร่เงินเปล่งประกาย หลอมแล้วเย็นลื่น'),
  mat('ore_mythril', 'แร่มิธริล', '💠', 'ore', 'SR', 'โลหะวิเศษเบาหวาน น้ำหนักเบาแต่แข็งกระด้าง'),
  mat('ore_adamant', 'แร่อะดามันไทม์', '🪨', 'ore', 'SSR', 'โลหะในตำนาน แกร่งเหนือทุกสิ่ง'),
  // อัญมณี
  mat('gem_quartz', 'ควอตซ์', '⚪', 'gem', 'C', 'อัญมณีใสไร้ราคา แต่เริ่มฝึกเจียระไนได้'),
  mat('gem_amethyst', 'อเมทิสต์', '🟣', 'gem', 'UC', 'พลอยสีม่วงสงบจิตใจผู้ถือครอง'),
  mat('gem_sapphire', 'ไพลิน', '🔵', 'gem', 'R', 'พลอยสีน้ำเงินลึก สะท้อนแสงดวงดาว'),
  mat('gem_ruby', 'ทับทิม', '🔴', 'gem', 'SR', 'พลอยสีแดงดั่งเปลวเพลิงอันแรงกล้า'),
  mat('gem_diamond', 'เพชร', '💎', 'gem', 'SSR', 'ราชาแห่งอัญมณี ไร้รอยตำหนิ'),
  // สมุนไพร
  mat('herb_mint', 'ใบมินต์', '🌿', 'herb', 'C', 'สมุนไพรหอมเย็น พื้นฐานของงานปรุง'),
  mat('herb_ginseng', 'โสมป่า', '🌱', 'herb', 'UC', 'รากบำรุงกำลัง หาได้ไม่ยากในป่าลึก'),
  mat('herb_moon', 'หญ้าพระจันทร์', '🌙', 'herb', 'R', 'เรืองแสงราตรี ใช้ปรุงยาเวทสูง'),
  mat('herb_golden_root', 'รากทองคำ', '🥕', 'herb', 'SR', 'รากสีทอง ว่ากันว่าคืนชีวิตได้'),
  mat('herb_phoenix', 'ดอกฟีนิกซ์', '🌺', 'herb', 'SSR', 'ดอกไม้ที่เกิดจากเถ้าถ่านนกฟีนิกซ์'),
  // วัตถุดิบอาหาร
  mat('ing_honey', 'น้ำผึ้ง', '🍯', 'ingredient', 'C', 'น้ำผึ้งหอมหวานจากรังป่า'),
  mat('ing_egg', 'ไข่ป่า', '🥚', 'ingredient', 'UC', 'ไข่นกป่า สดใหม่'),
  mat('ing_mushroom', 'เห็ดหอม', '🍄', 'ingredient', 'R', 'เห็ดหอมกรุ่นจากใต้ต้นโอ๊ก'),
  mat('ing_jelly', 'วุ้นราชินี', '🫙', 'ingredient', 'SR', 'วุ้นล้ำค่าจากรังแมลงเวท'),
  mat('ing_dragon_egg', 'ไข่มังกร', '🥚', 'ingredient', 'SSR', 'ไข่มังกรที่ยังอุ่นวูบไหว'),
  // ชิ้นส่วนมอนสเตอร์
  mat('mp_slime_gel', 'เจลสไลม์', '🫠', 'monster_part', 'C', 'เจลเหนียวจากสไลม์ ใช้ผสมยาได้'),
  mat('mp_wolf_fang', 'เขี้ยวหมาป่า', '🦷', 'monster_part', 'UC', 'เขี้ยวคมกริบของหมาป่าเถื่อน'),
  mat('mp_lizard_scale', 'เกล็ดกิ้งก่า', '🐊', 'monster_part', 'R', 'เกล็ดแข็งของจระเข้ลึกลับ'),
  mat('mp_golem_core', 'แกนโกเลม', '🗿', 'monster_part', 'SR', 'แกนพลังงานของโกเลมหิน'),
  mat('mp_dragon_heart', 'หัวใจมังกร', '❤️‍🔥', 'monster_part', 'SSR', 'หัวใจที่ยังเต้นตุบ ๆ ของมังกร'),
];
for (const t of MATERIALS) {
  if (t.id === 'gem_ruby') t.image = '/card-art/gem_ruby.svg';
  if (t.id === 'gem_diamond') t.image = '/card-art/gem_diamond.svg';
}

// ---------------------------------------------------------------------------
// เครื่องมือ
// ---------------------------------------------------------------------------
const TOOLS: CardTemplate[] = [
  tool('tool_pickaxe_rusty', 'จอบขุดแร่เก่า', '⛏️', 'pickaxe', 'C', 'จอบเก่า ๆ แต่ยังใช้ขุดเหมืองได้ (ต้องมีติดตัวจึงเข้าเหมืองได้)'),
  tool('tool_pickaxe_iron', 'จอบเหล็ก', '⛏️', 'pickaxe', 'UC', 'จอบเหล็กแท้ ขุดพบของดีได้บ่อยขึ้น'),
  tool('tool_pickaxe_mythril', 'จอบมิธริล', '⛏️', 'pickaxe', 'R', 'จอบโลหะวิเศษ สั่นถี่รับรู้แร่หายาก'),
  tool('tool_axe_rusty', 'ขวานตัดไม้เก่า', '🪓', 'axe', 'C', 'ขวานเก่า ๆ แต่ยังฟันไม้ได้ (ต้องมีติดตัวจึงเข้าป่าได้)'),
  tool('tool_axe_steel', 'ขวานเหล็กกล้า', '🪓', 'axe', 'UC', 'ขวานคม ๆ ตัดไม้เจอของดีขึ้น'),
  tool('tool_axe_forest', 'ขวานวิญญาณป่า', '🪓', 'axe', 'R', 'ขวานที่ต้นป่ามอบให้ รู้ว่าของดีซ่อนอยู่ไหน'),
  tool('tool_sickle_rusty', 'เคียวเก่า', '🔪', 'sickle', 'C', 'เคียวมือเก่า ๆ เก็บของป่าได้ (ต้องมีติดตัวจึงเก็บเกี่ยวได้)'),
  tool('tool_sickle_iron', 'เคียวเหล็ก', '🔪', 'sickle', 'UC', 'เคียวเหล็กคม ๆ เก็บของดีเจอากขึ้น'),
  tool('tool_sickle_moon', 'เคียวดวงจันทร์', '🔪', 'sickle', 'R', 'เคียวส่องแสงนวล มองเห็นของมีค่าในพุ่มไม้'),
];

// ---------------------------------------------------------------------------
// อุปกรณ์สวมใส่
// ---------------------------------------------------------------------------
const EQUIPMENT: CardTemplate[] = [
  // หมวก
  equip('hat_straw', 'หมวกฟาง', '🧢', 'hat', 'C', { hp: 14 }, 'หมวกฟางสานมือ กันแดดกำลังดี'),
  equip('hat_leather', 'หมวกหนัง', '👒', 'hat', 'UC', { hp: 32, def: 3 }, 'หมวกหนังฟอกนุ่ม กันกระแทกเบา ๆ'),
  equip('hat_iron', 'หมวกเกราะเหล็ก', '⛑️', 'hat', 'R', { hp: 65, def: 9, mdef: 5 }, 'หมวกเหล็กหล่อชุบ ทนทานระดับกองทัพ'),
  equip('hat_crown', 'มงกุฎราชัน', '👑', 'hat', 'SR', { hp: 140, def: 16, mdef: 12, manaMax: 10 }, 'มงกุฎของกษัตริย์โบราณ เปล่งอำนาจ'),
  equip('hat_dragon', 'มงกุฎมังกร', '🐲', 'hat', 'SSR', { hp: 300, def: 26, mdef: 22, manaMax: 20, stamMax: 20 }, 'มงกุฎทำจากเขามังกร แผ่ออร่าน่าเกรงขาม'),
  // ชุดเกราะ
  equip('top_cloth', 'เสื้อผ้ายา', '👕', 'top', 'C', { hp: 16, def: 1 }, 'เสื้อผ้ายาที่แม่เย็บให้'),
  equip('top_leather', 'เกราะหนัง', '🦺', 'top', 'UC', { hp: 38, def: 5 }, 'เกราะหนังสัตว์ตัวเมือง คล่องตัวดี'),
  equip('top_chain', 'เกราะลูกโซ่', '⛓️', 'top', 'R', { hp: 80, def: 13 }, 'เกราะลูกโซ่เหล็ก กันดาบได้จริงจัง'),
  equip('top_knight', 'เกราะอัศวิน', '🥋', 'top', 'SR', { hp: 165, def: 24, mdef: 10 }, 'เกราะเต็มตัวของอัศวินชั้นสูง'),
  equip('top_dragon', 'เกราะเกล็ดมังกร', '🐉', 'top', 'SSR', { hp: 360, def: 40, mdef: 26 }, 'เกล็ดมังกรแท้ ๆ ถักเป็นชุดเกราะ'),
  // กางเกง
  equip('pants_cloth', 'กางเกงผ้า', '👖', 'pants', 'C', { hp: 10, def: 1 }, 'กางเกงผ้าธรรมดาสบายเคลื่อนไหว'),
  equip('pants_leather', 'กางเกงหนัง', '🩳', 'pants', 'UC', { hp: 26, def: 4 }, 'กางเกงหนังทนทานสำหรับนักผจญภัย'),
  equip('pants_iron', 'กางเกงเกราะเหล็ก', '🧦', 'pants', 'R', { hp: 55, def: 10 }, 'แผ่นเหล็กป้องกันต้นขา'),
  equip('pants_knight', 'กางเกงอัศวิน', '🥾', 'pants', 'SR', { hp: 120, def: 18, spd: 2 }, 'ชุดขาอัศวิน เคลื่อนที่คล่องแม้หนัก'),
  equip('pants_dragon', 'กางเกงมังกร', '🔥', 'pants', 'SSR', { hp: 260, def: 30, spd: 5 }, 'เกราะขาจากเกล็ดมังกรเผาไฟ'),
  // รองเท้า
  equip('shoes_straw', 'รองเท้าฟาง', '🩴', 'shoes', 'C', { spd: 2 }, 'รองเท้าฟางเบา ๆ เดนิ่มเร็วขึ้นนิดหน่อย'),
  equip('shoes_leather', 'รองเท้าหนัง', '👢', 'shoes', 'UC', { spd: 4, hp: 12 }, 'รองเท้าบูตหนังแท้ กระชับเท้า'),
  equip('shoes_swift', 'รองเท้าว่องไว', '👟', 'shoes', 'R', { spd: 7, hp: 28 }, 'รองเท้าเวทเร่งความเร็ว'),
  equip('shoes_winged', 'รองเท้าปีก', '🪽', 'shoes', 'SR', { spd: 12, atk: 8 }, 'มีปีกเล็ก ๆ ผูกไว้กับส้นเท้า'),
  equip('shoes_dragon', 'รองเท้ามังกรบิน', '🐲', 'shoes', 'SSR', { spd: 20, atk: 18, def: 10 }, 'รองเท้าตำนานที่ว่ากันว่าเคยบินข้ามทวีป'),
  // ถุงมือ
  equip('gloves_cloth', 'ถุงมือผ้า', '🧤', 'gloves', 'C', { def: 2 }, 'ถุงมือผ้ากันหนาว'),
  equip('gloves_leather', 'ถุงมือหนัง', '🧤', 'gloves', 'UC', { atk: 3, def: 3 }, 'ถุงมือหนังจับดาบแน่นมือ'),
  equip('gloves_iron', 'ถุงมือเหล็ก', '🥊', 'gloves', 'R', { atk: 8, def: 7 }, 'สนับมือเหล็กหนักหน่วง'),
  equip('gloves_titan', 'ถุงมือไททัน', '💪', 'gloves', 'SR', { atk: 18, def: 11, spd: 3 }, 'ถุงมือที่ยกภูเขาได้ตามตำนาน'),
  equip('gloves_dragon', 'เล็บมังกร', '🐉', 'gloves', 'SSR', { atk: 38, def: 18, spd: 6 }, 'ถุงมือที่ปลายเป็นเล็บมังกรแท้'),
  // แหวน
  equip('ring_copper', 'แหวนทองแดง', '💍', 'ring', 'C', { manaMax: 8 }, 'แหวนทองแดงจารตัวอักษรเล็ก ๆ'),
  equip('ring_mana', 'แหวนมานา', '💍', 'ring', 'UC', { manaMax: 20, manaRegen: 1 }, 'เพิ่มพลังมานาให้ผู้สวม'),
  equip('ring_sapphire', 'แหวนไพลิน', '💠', 'ring', 'R', { matk: 10, manaMax: 26 }, 'พลอยสีน้ำเงินเร้าพลังเวท'),
  equip('ring_archmage', 'แหวนจอมเวท', '🔮', 'ring', 'SR', { matk: 24, manaMax: 40, manaRegen: 1 }, 'แหวนของจอมเวทผู้ยิ่งใหญ่'),
  equip('ring_dragon_eye', 'แหวนดวงตามังกร', '👁️', 'ring', 'SSR', { matk: 48, manaMax: 60, manaRegen: 2 }, 'ดวงตามังกรที่ถูกเจียระไนเป็นพลอย'),
  // กำไร
  equip('bracelet_bead', 'กำไลลูกปัด', '📿', 'bracelet', 'C', { hp: 10, mdef: 2 }, 'กำไลลูกปัดสานมือสวมง่าย'),
  equip('bracelet_jade', 'กำไลหยก', '🟢', 'bracelet', 'UC', { hp: 26, def: 3, mdef: 4 }, 'หยกเขียวชุ่มตา บำรุงลมปราณ'),
  equip('bracelet_silver', 'กำไลเงิน', '⭐', 'bracelet', 'R', { hp: 52, def: 6, mdef: 8 }, 'กำไลเงินสลักลายดอกไม้'),
  equip('bracelet_guardian', 'กำไลผู้พิทักษ์', '🛡️', 'bracelet', 'SR', { hp: 115, def: 12, mdef: 16 }, 'เกราะนำโชคของผู้พิทักษ์เมือง'),
  equip('bracelet_dragon', 'กำไลมังกร', '🐉', 'bracelet', 'SSR', { hp: 230, def: 20, mdef: 30, spd: 5 }, 'กำไลขดตัวเป็นรูปมังกร'),
  // ต่างหู
  equip('earring_feather', 'ต่างหูขนนก', '🪶', 'earring', 'C', { spd: 1, mdef: 2 }, 'เบาจนลืมว่าใส่อยู่'),
  equip('earring_crystal', 'ต่างหูคริสตัล', '💎', 'earring', 'UC', { mdef: 5, matk: 4 }, 'คริสตัลใสแขวนเคล้าเสียงกรุ่งกริ่ง'),
  equip('earring_moon', 'ต่างหูจันทรา', '🌙', 'earring', 'R', { mdef: 10, matk: 9 }, 'สะท้อนแสงจันทร์ยามค่ำคืน'),
  equip('earring_star', 'ต่างหูดวงดาว', '✨', 'earring', 'SR', { mdef: 18, matk: 20 }, 'ดวงดาวตกที่ถูกดักจับไว้'),
  equip('earring_dragon', 'ต่างหูหางมังกร', '🐲', 'earring', 'SSR', { mdef: 30, matk: 40, manaRegen: 1 }, 'เศษเกล็ดหางมังกรแท้ ๆ'),
  // อาวุธ — ดาบ
  equip('sword_wooden', 'ดาบไม้', '🗡️', 'weapon', 'C', { atk: 6 }, 'ดาบไม้สำหรับฝึกฟัน', 'sword'),
  equip('sword_iron', 'ดาบเหล็ก', '⚔️', 'weapon', 'UC', { atk: 14 }, 'ดาบเหล็กหล่อมาตรฐานทหาร', 'sword'),
  equip('sword_knight', 'ดาบอัศวิน', '⚔️', 'weapon', 'R', { atk: 28, spd: 2 }, 'ดาบของอัศวินผ่านศึกมานับร้อย', 'sword'),
  equip('sword_excalibur', 'ดาบเอกซ์คาลิเบอร์', '🗡️', 'weapon', 'SR', { atk: 60, def: 8 }, 'ดาบศักดิ์สิทธิ์ในตำนานกษัตริย์', 'sword'),
  equip('sword_dragon_slayer', 'ดาบสังหารมังกร', '🐉', 'weapon', 'SSR', { atk: 120, hp: 120, spd: 5 }, 'ดาบที่ฆ่ามังกรไปแล้วเก้าตัว', 'sword'),
  // อาวุธ — คาทา
  equip('katara_bone', 'คาทากระดูก', '🔪', 'weapon', 'C', { atk: 5, spd: 1 }, 'คาทาทำจากกระดูกสัตว์', 'katara'),
  equip('katara_steel', 'คาทาเหล็ก', '🗡️', 'weapon', 'UC', { atk: 12, spd: 2 }, 'ใบมีดคู่ที่กระพริบไวดั่งเงา', 'katara'),
  equip('katara_moon', 'คาทาจันทรา', '🌙', 'weapon', 'R', { atk: 24, spd: 4 }, 'คมมีดเย็นดั่งแสงจันทร์', 'katara'),
  equip('katara_shadow', 'คาทาเงา', '🌑', 'weapon', 'SR', { atk: 50, spd: 8 }, 'มีดที่ฟันแล้วเห็นเพียงเงา', 'katara'),
  equip('katara_blood_drinker', 'คาทาดื่มเลือด', '🩸', 'weapon', 'SSR', { atk: 100, spd: 15, hp: 80 }, 'มีดต้องคำสาปที่กระหายเลือด', 'katara'),
  // อาวุธ — ธนู
  equip('bow_short', 'ธนูสั้น', '🏹', 'weapon', 'C', { atk: 4, spd: 1 }, 'ธนูสั้นยิงได้เร็ว', 'bow'),
  equip('bow_long', 'ธนูยาว', '🏹', 'weapon', 'UC', { atk: 10, spd: 2 }, 'ธนูยาวไร้สังกัด แรงเหนี่ยวสม่ำเสมอ', 'bow'),
  equip('bow_elven', 'ธนูเอลฟ์', '🏹', 'weapon', 'R', { atk: 22, spd: 3, def: 3 }, 'ธนูประจำเผ่าเอลฟ์ แม่นยำเยี่ยม', 'bow'),
  equip('bow_wind_speaker', 'ธนูผู้สั่งลม', '🌪️', 'weapon', 'SR', { atk: 45, spd: 6 }, 'ลูกธนูที่ยิงไปตามกระแสลม', 'bow'),
  equip('bow_phoenix', 'ธนูฟีนิกซ์', '🔥', 'weapon', 'SSR', { atk: 90, spd: 12, matk: 20 }, 'ลูกธนูเปลวเพลิงที่ไม่มีวันดับ', 'bow'),
];

// ---------------------------------------------------------------------------
// ยา
// ---------------------------------------------------------------------------
const POTIONS: CardTemplate[] = [
  potionCard('potion_hp_minor', 'ยาฟื้นฟูเล็ก', '🧪', 'C', 'ฟื้นฟูพลังชีวิต 40 จุด (ใช้ในการต่อสู้)', { heal: 40 }),
  potionCard('potion_hp', 'ยาฟื้นฟู', '🧪', 'UC', 'ฟื้นฟูพลังชีวิต 100 จุด (ใช้ในการต่อสู้)', { heal: 100 }),
  potionCard('potion_hp_greater', 'ยาฟื้นฟูขั้นสูง', '🧪', 'R', 'ฟื้นฟูพลังชีวิต 220 จุด (ใช้ในการต่อสู้)', { heal: 220 }),
  potionCard('potion_mana', 'ยามานา', '🫐', 'UC', 'ฟื้นฟูมานา 40 จุด (ใช้ในการต่อสู้)', { mana: 40 }),
  potionCard('potion_mana_greater', 'ยามานาขั้นสูง', '🫐', 'R', 'ฟื้นฟูมานา 90 จุด (ใช้ในการต่อสู้)', { mana: 90 }),
  potionCard('potion_stam', 'ยากำลัง', '🥤', 'UC', 'ฟื้นฟูกำลัง 40 จุด (ใช้ในการต่อสู้)', { stam: 40 }),
  potionCard('potion_full', 'ยาเอกลักษณ์', '⚗️', 'SR', 'ฟื้นฟู HP 400 มานา 30 และกำลัง 30 (ใช้ในการต่อสู้)', { heal: 400, mana: 30, stam: 30 }),
  potionCard('potion_elixir', 'ยาทิพย์', '⚗️', 'SR', 'ฟื้นฟู HP 150 มานา 60 กำลัง 60 และเพิ่มโจมตี (ใช้ในการต่อสู้)', { heal: 150, mana: 60, stam: 60, atkBuff: 10, buffTurns: 3 }),
];

// ---------------------------------------------------------------------------
// อาหาร (กินนอกสนามเพื่อฟื้นพลังงาน / กินในสนามเพื่อบัฟ)
// ---------------------------------------------------------------------------
const FOODS: CardTemplate[] = [
  foodCard('food_bread', 'ขนมปัง', '🍞', 'C', 'ฟื้นพลังงาน 10 จุด (นอกสนาม) หรือฟื้น HP 20 (ในสนาม)', { energy: 10, heal: 20 }),
  foodCard('food_fish', 'ปลาย่าง', '🐟', 'C', 'ฟื้นพลังงาน 15 จุด (นอกสนาม) หรือฟื้น HP 30 (ในสนาม)', { energy: 15, heal: 30 }),
  foodCard('food_salad', 'สลัดสมุนไพร', '🥗', 'UC', 'ฟื้นพลังงาน 20 จุด หรือเพิ่มพลังเวท +6 (3 เทิร์น)', { energy: 20, matkBuff: 6, buffTurns: 3 }),
  foodCard('food_steak', 'สเต๊กพลัง', '🥩', 'R', 'ฟื้นพลังงาน 30 จุด หรือเพิ่มโจมตี +12 (3 เทิร์น)', { energy: 30, atkBuff: 12, buffTurns: 3 }),
  foodCard('food_soup', 'ซุปเวทมนต์', '🍲', 'R', 'ฟื้นพลังงาน 30 จุด หรือเพิ่มพลังเวท +12 (3 เทิร์น)', { energy: 30, matkBuff: 12, buffTurns: 3 }),
  foodCard('food_feast', 'ชามโภชนาการ', '🍱', 'SR', 'ฟื้นพลังงาน 50 จุด หรือบัฟโจมตี+เวท 10 และฟื้น HP 60', { energy: 50, atkBuff: 10, matkBuff: 10, heal: 60, buffTurns: 3 }),
  foodCard('food_dragon_feast', 'ชามเลี้ยงมังกร', '🐲', 'SSR', 'ฟื้นพลังงาน 100 จุด หรือบัฟโจมตี+เวท 20 และฟื้น HP 150', { energy: 100, atkBuff: 20, matkBuff: 20, heal: 150, buffTurns: 3 }),
];

// ---------------------------------------------------------------------------
// สกิลกายภาพ (ใช้กำลัง)
// ---------------------------------------------------------------------------
const SKILLS_PHYS: CardTemplate[] = [
  skill('skill_quick_slash', 'ฟันเร็ว', '⚔️', 'physical', 8, 'C', 'ฟันศัตรูอย่างรวดเร็ว'),
  skill('skill_heavy_slash', 'ฟันหนัก', '🗡️', 'physical', 16, 'UC', 'รวมแรงฟันเต็มน้ำหนัก'),
  skill('skill_shield_bash', 'ทุบด้วยโล่', '🛡️', 'shield', 20, 'UC', 'สร้างเกราะป้องกัน 20 จุดให้ตัวเอง'),
  skill('skill_war_cry', 'เสียงคำราม', '📢', 'buff_atk', 8, 'UC', 'เพิ่มโจมตี +8 (3 เทิร์น)', 3),
  skill('skill_triple_hit', 'หมัดสามทับ', '🌀', 'physical', 26, 'R', 'โจมตีรัวสามชุดติดกัน'),
  skill('skill_berserker', 'นักเลือดเดือด', '😤', 'physical', 40, 'SR', 'บ้าคลั่งโจมตีไม่ให้ตั้งตัว'),
  skill('skill_heavens_cleave', 'ผ่าฟ้าสลายดิน', '☄️', 'physical', 66, 'SSR', 'ดาบฟ้าผ่าลงมาดั่งอุกกาบาต'),
];

// ---------------------------------------------------------------------------
// สกิลเวทมนต์ (ใช้มานา)
// ---------------------------------------------------------------------------
const SKILLS_MAGIC: CardTemplate[] = [
  skill('skill_spark', 'ประกายไฟ', '✨', 'magic', 7, 'C', 'ปล่อยประกายไฟเล็ก ๆ ใส่ศัตรู'),
  skill('skill_heal', 'รักษาเล็กน้อย', '💖', 'heal', 20, 'C', 'ฟื้นฟูพลังชีวิตตัวเอง 20 จุด'),
  skill('skill_fireball', 'บอลไฟ', '🔥', 'magic', 14, 'UC', 'ขว้างลูกไฟใส่ศัตรู'),
  skill('skill_arcane_might', 'พลังเวทลึกลับ', '🔮', 'buff_matk', 8, 'UC', 'เพิ่มพลังเวท +8 (3 เทิร์น)', 3),
  skill('skill_ice_lance', 'หอกน้ำแข็ง', '❄️', 'magic', 23, 'R', 'แทงด้วยหอกน้ำแข็งคมกริบ'),
  skill('skill_poison_cloud', 'หมอกพิษ', '☠️', 'poison', 7, 'R', 'สร้างพิษ 7 จุดต่อเทิร์น (3 เทิร์น)', 3),
  skill('skill_greater_heal', 'รักษาขั้นสูง', '💚', 'heal', 42, 'R', 'ฟื้นฟูพลังชีวิตตัวเอง 42 จุด'),
  skill('skill_lightning', 'สายฟ้าทรนิง', '⚡', 'magic', 37, 'SR', 'เรียกสายฟ้าฟาดใส่ศัตรู'),
  skill('skill_holy_burst', 'แสงศักดิ์สิทธิ์', '🌟', 'heal', 75, 'SR', 'ฟื้นฟูพลังชีวิตตัวเองอย่างท่วมท้น'),
  skill('skill_meteor', 'อุกกาบาต', '☄️', 'magic', 62, 'SSR', 'ทุ่มอุกกาบาตลงมาทำลายล้าง'),
];

// ---------------------------------------------------------------------------
// สัตว์เลี้ยง
// ---------------------------------------------------------------------------
const PETS: CardTemplate[] = [
  petCard('pet_slime', 'สไลม์เลี้ยง', '🟢', 'C', 4, 10, 'จิ้มศัตรู 4 ดาเมจทุกเทิร์นของเจ้าของ'),
  petCard('pet_wolf', 'ลูกหมาป่า', '🐺', 'UC', 8, 20, 'กัดศัตรู 8 ดาเมจทุกเทิร์นของเจ้าของ'),
  petCard('pet_eagle', 'อินทรี', '🦅', 'R', 14, 25, 'ฉีกศัตรู 14 ดาเมจทุกเทิร์นของเจ้าของ'),
  petCard('pet_tiger', 'เสือโคร่ง', '🐯', 'SR', 24, 40, 'ตะปบศัตรู 24 ดาเมจทุกเทิร์นของเจ้าของ'),
  petCard('pet_dragon', 'มังกรน้อย', '🐉', 'SSR', 45, 80, 'พ่นไฟศัตรู 45 ดาเมจทุกเทิร์นของเจ้าของ'),
];

export const CARD_TEMPLATES: CardTemplate[] = [
  ...MATERIALS, ...TOOLS, ...EQUIPMENT, ...POTIONS, ...FOODS, ...SKILLS_PHYS, ...SKILLS_MAGIC, ...PETS,
];

const CARD_MAP = new Map(CARD_TEMPLATES.map((c) => [c.id, c]));

// การ์ดที่แอดมินสร้างระหว่างรัน (เก็บใน DB ฝั่ง server / ดึงมา register ฝั่ง client เมื่อ boot)
const EXTRA_TEMPLATES = new Map<string, CardTemplate>();

export function registerTemplate(t: CardTemplate): void {
  EXTRA_TEMPLATES.set(t.id, t);
  CARD_MAP.set(t.id, t);
}

/** การ์ดทั้งหมด = ชุดในโค้ด + การ์ด custom ที่แอดมินสร้าง */
export function allTemplates(): CardTemplate[] {
  return [...CARD_TEMPLATES, ...EXTRA_TEMPLATES.values()];
}

export function cardById(id: string): CardTemplate {
  const c = CARD_MAP.get(id);
  if (!c) throw new Error(`Unknown card template: ${id}`);
  return c;
}

export function tryCardById(id: string): CardTemplate | undefined {
  return CARD_MAP.get(id);
}

export function cardsByCategory(category: CardCategory): CardTemplate[] {
  return CARD_TEMPLATES.filter((c) => c.category === category);
}

// ---------------------------------------------------------------------------
// กาชา
// ---------------------------------------------------------------------------
/** อัตรากาชา (%) ตามระดับโชค 0-10 — โชคยืมน้ำหนักจาก C/UC ไปเพิ่ม R/SR/SSR */
export function gachaRates(luck = 0): [Rarity, number][] {
  const l = Math.max(0, Math.min(10, luck));
  return [
    ['C', 50 - 2.5 * l],
    ['UC', 28 - 0.5 * l],
    ['R', 15 + 1.2 * l],
    ['SR', 5.5 + 1.1 * l],
    ['SSR', 1.5 + 0.7 * l],
  ];
}

export function rollGachaRarity(rand: number, luck = 0): Rarity {
  // rand ∈ [0,1) · luck 0-10 จากมินิเกม (เพิ่มเฉพาะรอบนั้น)
  const table = gachaRates(luck);
  const total = table.reduce((a, [, w]) => a + w, 0);
  let acc = 0;
  for (const [r, w] of table) {
    acc += w / total;
    if (rand < acc) return r;
  }
  return 'SSR';
}

// ---------------------------------------------------------------------------
// การเก็บของ (เหมือง / ป่า)
// ---------------------------------------------------------------------------
export type GatherZone = 'mine' | 'forest';
/** กิจกรรมในป่า: ตัดไม้ (ขวาน) / เก็บเกี่ยว (เคียว) */
export type ForestActivity = 'wood' | 'harvest';

/** น้ำหนักของแต่ละ tier ในกองวัตถุดิบ */
const TIER_WEIGHT = [40, 30, 18, 8, 4];

/** เครื่องมือเกรดดีขึ้น shift น้ำหนักไปหา tier สูง */
function tierWeights(toolTier: number): number[] {
  return TIER_WEIGHT.map((w, i) => {
    const diff = toolTier - (i + 1); // >0 = เครื่องมือเกินระดับของ tier นี้
    const mult = diff > 0 ? 1 + diff * 0.12 : 1 / (1 + -diff * 0.10);
    return w * mult;
  });
}

function rollFromTemplates(pool: CardTemplate[], weights: number[], rand: () => number): CardTemplate {
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i] / total;
    if (rand() < acc) return pool[i];
  }
  return pool[pool.length - 1];
}

/** สุ่มผลการเก็บของ — rand ให้ส่ง Math.random() หรือ rng ของระบบ
 *  luck (โชค) = จำนวนครั้งที่สุ่มซ้ำแล้วเลือกของ tier สูงสุด — โชคทุก 2 จุดได้สุ่มเพิ่ม 1 ครั้ง */
export function rollGather(zone: GatherZone, toolTier: number, rand: () => number, luck = 0, activity: ForestActivity = 'wood'): CardTemplate {
  const rollOnce = (): CardTemplate => {
    const pool: CardTemplate[] = [];
    if (zone === 'mine') {
      // 80% แร่ / 20% อัญมณี
      const cat: 'ore' | 'gem' = rand() < 0.8 ? 'ore' : 'gem';
      pool.push(...cardsByCategory(cat));
    } else {
      // ป่า: 40% ไม้ / 28% สมุนไพร / 22% วัตถุดิบ / 10% สัตว์เลี้ยง
      const r = rand();
      let cat: CardCategory = 'wood';
      if (r < 0.4) cat = 'wood';
      else if (r < 0.68) cat = 'herb';
      else if (r < 0.9) cat = 'ingredient';
      else cat = 'pet';
      pool.push(...cardsByCategory(cat));
    }
    const weights = tierWeights(toolTier).slice(0, pool.length);
    return rollFromTemplates(pool, weights, rand);
  };
  const attempts = 1 + Math.floor(Math.max(0, luck) / 2);
  let best: CardTemplate | null = null;
  for (let a = 0; a < attempts; a++) {
    const c = rollOnce();
    if (!best || c.tier > best.tier) best = c;
  }
  return best!;
}

// ---------------------------------------------------------------------------
// คราฟต์
// ---------------------------------------------------------------------------
export type CraftKey =
  | 'sword' | 'katara' | 'bow'
  | 'hat' | 'top' | 'pants' | 'shoes' | 'gloves' | 'ring' | 'bracelet' | 'earring'
  | 'pickaxe' | 'axe' | 'sickle';

export const CRAFT_KEYS: { key: CraftKey; label: string; emoji: string }[] = [
  { key: 'sword', label: 'ดาบ', emoji: '⚔️' },
  { key: 'katara', label: 'คาทา', emoji: '🗡️' },
  { key: 'bow', label: 'ธนู', emoji: '🏹' },
  { key: 'hat', label: 'หมวก', emoji: '🧢' },
  { key: 'top', label: 'ชุดเกราะ', emoji: '🦺' },
  { key: 'pants', label: 'กางเกง', emoji: '👖' },
  { key: 'shoes', label: 'รองเท้า', emoji: '👢' },
  { key: 'gloves', label: 'ถุงมือ', emoji: '🧤' },
  { key: 'ring', label: 'แหวน', emoji: '💍' },
  { key: 'bracelet', label: 'กำไร', emoji: '📿' },
  { key: 'earring', label: 'ต่างหู', emoji: '🪶' },
  { key: 'pickaxe', label: 'จอบขุดแร่', emoji: '⛏️' },
  { key: 'sickle', label: 'เคียวเก็บเกี่ยว', emoji: '🔪' },
  { key: 'axe', label: 'ขวานตัดไม้', emoji: '🪓' },
];

/** คะแนนคุณภาพของวัตถุดิบที่ใส่ (ไม้ x1 / แร่ x1.25 / อัญมณี x1.5) */
export function craftScore(inputs: CardTemplate[]): number {
  let s = 0;
  for (const c of inputs) {
    const mult = c.category === 'gem' ? 1.5 : c.category === 'ore' ? 1.25 : 1;
    s += c.tier * mult;
  }
  return s;
}

/** สุ่ม rarity จากคะแนน — เริ่มที่ C แล้วมีโอกาสเลื่อนขึ้นตามคุณภาพวัตถุดิบ */
export function rollCraftRarity(score: number, rand: () => number, startIdx = 0): Rarity {
  const steps = [
    { need: 2, base: 0.7, scale: 0.03 },   // C -> UC
    { need: 4.5, base: 0.5, scale: 0.04 }, // UC -> R
    { need: 8, base: 0.35, scale: 0.03 },  // R -> SR
    { need: 13, base: 0.22, scale: 0.02 }, // SR -> SSR
  ];
  let idx = Math.max(0, Math.min(4, startIdx));
  for (let i = idx; i < steps.length; i++) {
    const st = steps[i];
    if (score < st.need) break;
    const chance = Math.min(0.85, st.base + (score - st.need) * st.scale);
    if (rand() < chance) idx = i + 1;
    else break;
  }
  return RARITIES[Math.min(idx, 4)];
}

function pickFromRarity(pool: CardTemplate[], rarity: Rarity, rand: () => number): CardTemplate {
  // หา template ตาม rarity ที่ได้ ถ้าไม่มีค่อย ๆ ลดระดับลง
  for (let i = RARITIES.indexOf(rarity); i >= 0; i--) {
    const exact = pool.filter((c) => c.rarity === RARITIES[i]);
    if (exact.length > 0) return exact[Math.floor(rand() * exact.length)];
  }
  return pool[Math.floor(rand() * pool.length)];
}

/** คราฟต์อุปกรณ์: เลือกประเภท + ใส่ไม้และแร่/อัญมณีกี่ชิ้นก็ได้ (bonus = โบนัสคะแนนจากมินิเกม) */
export function rollCraftEquipment(key: CraftKey, inputs: CardTemplate[], rand: () => number, bonus = 0): CardTemplate {
  const isTool = key === 'pickaxe' || key === 'axe' || key === 'sickle';
  const pool = isTool
    ? TOOLS.filter((c) => c.category === key)
    : EQUIPMENT.filter((c) => (key === 'sword' || key === 'katara' || key === 'bow') ? c.weaponKind === key : c.category === key);
  const rarity = rollCraftRarity(craftScore(inputs) + bonus, rand);
  return pickFromRarity(pool, rarity, rand);
}

/** แร่แปรธาตุ: ผสมแร่/อัญมณี ≥ 2 ชิ้น → สุ่มแร่หรืออัญมณีใหม่ */
export function rollAlchemy(inputs: CardTemplate[], rand: () => number, bonus = 0): CardTemplate {
  const pool = MATERIALS.filter((c) => c.category === 'ore' || c.category === 'gem');
  const avgTier = inputs.reduce((a, c) => a + c.tier, 0) / inputs.length;
  const rarity = rollCraftRarity(craftScore(inputs) * 1.1 + bonus, rand, Math.max(0, Math.floor(avgTier) - 1));
  return pickFromRarity(pool, rarity, rand);
}

/** ปรุงยา: สมุนไพร + ชิ้นส่วนมอนสเตอร์ ≥ 2 ชิ้น → สุ่มยา */
export function rollBrew(inputs: CardTemplate[], rand: () => number, bonus = 0): CardTemplate {
  const pool = POTIONS;
  const rarity = rollCraftRarity(craftScore(inputs) + bonus, rand);
  return pickFromRarity(pool, rarity, rand);
}

/** ทำอาหาร: สมุนไพร + วัตถุดิบ ≥ 2 ชิ้น → สุ่มอาหาร */
export function rollCook(inputs: CardTemplate[], rand: () => number, bonus = 0): CardTemplate {
  const pool = FOODS;
  const rarity = rollCraftRarity(craftScore(inputs) + bonus, rand);
  return pickFromRarity(pool, rarity, rand);
}
