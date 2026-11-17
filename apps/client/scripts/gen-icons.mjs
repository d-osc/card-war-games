// ดึง path data จากไอคอน SVG ที่คัดเลือก (packages/icons = game-icons.net collection)
// มาเป็น src/icons-data.ts เพื่อให้ bundle เล็กและระบายสีด้วย currentColor ได้
// รัน: node scripts/gen-icons.mjs
import fs from 'node:fs';
import path from 'node:path';

// key → ไฟล์ใน packages/icons (คัดเลือกเฉพาะที่ใช้ในเกม)
const CURATED = {
  home: 'delapouite/camping-tent.svg',
  pvp: 'lorc/crossed-swords.svg',
  dungeon: 'delapouite/dungeon-gate.svg',
  quests: 'lorc/scroll-unfurled.svg',
  pquests: 'delapouite/checklist.svg',
  inventory: 'delapouite/backpack.svg',
  deck: 'faithtoken/card-random.svg',
  shop: 'delapouite/shop.svg',
  market: 'lorc/gavel.svg',
  mine: 'lorc/mining.svg',
  forest: 'lorc/tree-branch.svg',
  craft: 'lorc/anvil.svg',
  social: 'delapouite/discussion.svg',
  guild: 'delapouite/knight-banner.svg',
  profile: 'delapouite/wizard-face.svg',
  admin: 'darkzaitzev/big-gear.svg',
  menu: 'delapouite/hamburger-menu.svg',
  gold: 'delapouite/two-coins.svg',
  energy: 'delapouite/energy-tank.svg',
  // ---- อาร์ตการ์ด (หน้าการ์) ตามหมวดอุปกรณ์ ----
  sword: 'delapouite/sword-brandish.svg',
  katana: 'delapouite/katana.svg',
  bow: 'delapouite/bow-arrow.svg',
  hat: 'lorc/pointy-hat.svg',
  top: 'lorc/mail-shirt.svg',
  pants: 'lorc/trousers.svg',
  shoes: 'darkzaitzev/tabi-boot.svg',
  gloves: 'delapouite/gauntlet.svg',
  ringIcon: 'lorc/gem-pendant.svg',
  bracelet: 'lorc/gem-chain.svg',
  earring: 'delapouite/crystal-earrings.svg',
  food: 'lorc/roast-chicken.svg',
  ingredient: 'delapouite/honey-jar.svg',
  potion: 'delapouite/health-potion.svg',
  ore: 'faithtoken/minerals.svg',
  gem: 'lorc/cut-diamond.svg',
  herb: 'delapouite/herbs-bundle.svg',
  wood: 'delapouite/axe-in-log.svg',
  claw: 'delapouite/claws.svg',
  pickaxe: 'lorc/mining.svg',
  axe: 'delapouite/magic-axe.svg',
  magic: 'lorc/crystal-ball.svg',
  heal: 'delapouite/heart-beats.svg',
  shield: 'delapouite/attached-shield.svg',
  buffAtk: 'lorc/muscle-up.svg',
  sparkles: 'delapouite/sparkles.svg',
  poison: 'lorc/poison-bottle.svg',
  pet: 'lorc/paw-front.svg',
  // ---- มอนสเตอร์ดันเจียน ----
  slime: 'delapouite/slime.svg',
  goblin: 'caro-asercion/goblin.svg',
  wolf: 'lorc/direwolf.svg',
  golem: 'delapouite/rock-golem.svg',
  dragon: 'delapouite/dragon-shield.svg',
  // ---- สถานิพ/รางวัล ----
  spd: 'delapouite/running-shoe.svg',
  mana: 'sbed/water-drop.svg',
  trophy: 'delapouite/laurels-trophy.svg',
  gacha: 'caro-asercion/slot-machine.svg',
  // ---- ส่วนประกอบ UI/สนามรบ ----
  target: 'delapouite/convergence-target.svg',
  flame: 'carl-olsen/flame.svg',
  check: 'delapouite/check-mark.svg',
  flag: 'delapouite/checkered-flag.svg',
  eagle: 'delapouite/eagle-head.svg',
  tiger: 'delapouite/tiger-head.svg',
  cardPlay: 'quoting/card-play.svg',
  cancel: 'sbed/cancel.svg',
  exit: 'delapouite/exit-door.svg',
  boltShield: 'lorc/bolt-shield.svg',
  sack: 'lorc/knapsack.svg',
};

const root = path.resolve(import.meta.dirname, '../../../packages/icons');
const out = [];
for (const [key, rel] of Object.entries(CURATED)) {
  const file = path.join(root, rel);
  const src = fs.readFileSync(file, 'utf-8');
  const m = src.match(/\sd="([^"]+)"/);
  if (!m) throw new Error(`ไม่พบ path d ใน ${rel}`);
  out.push(`  ${key}: '${m[1]}',`);
}

const ts = `// สร้างโดย scripts/gen-icons.mjs — อย่าแก้ไขด้วยมือ (รันใหม่ด้วย node scripts/gen-icons.mjs)
// ที่มา: game-icons.net (CC BY 3.0) ผ่าน packages/icons
export const ICONS: Record<string, string> = {
${out.join('\n')}
};
`;
fs.writeFileSync(path.resolve(import.meta.dirname, '../src/icons-data.ts'), ts);
console.log(`Generated ${Object.keys(CURATED).length} icons → src/icons-data.ts`);
