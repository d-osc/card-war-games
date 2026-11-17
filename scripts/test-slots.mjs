// ทดสอบ: ระบบช่องวางการ์ด (place/open/discard)
// รัน: npx tsx scripts/test-slots.mjs (จาก apps/server)
import { createBattle, placeCardToSlot, openSlotCard, discardFromHand, canPlayCard } from '@cardwar/shared';

const stats = { hp: 500, atk: 10, def: 0, matk: 10, mdef: 0, spd: 5, manaMax: 200, manaRegen: 5, stamMax: 200, stamRegen: 5 };

const st = createBattle(
  { uid: 'u1', name: 'A', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_shield_bash') },
  { uid: 'u2', name: 'B', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_quick_slash') },
  'pvp', 'a', 11,
);

const me = st.active;
st[me].shards = 9; st[me].stam = 100;

// 1) หมอบการ์ดโล่ลงช่อง
const shieldHand = st[me].hand.find((h) => h.templateId === 'skill_shield_bash');
const r1 = placeCardToSlot(st, me, shieldHand.uid);
console.log('หมอบการ์ดลงช่อง:', r1.ok ? 'ผ่าน ✔' : 'FAIL ' + r1.reason);
console.log('การ์ดอยู่ในช่อง 0:', st[me].slots[0]?.templateId === 'skill_shield_bash' ? 'ผ่าน ✔' : 'FAIL');
console.log('การ์ดหายจากมือ:', !st[me].hand.some((h) => h.uid === shieldHand.uid) ? 'ผ่าน ✔' : 'FAIL');

// 2) หมอบใบที่ 2 ในเทิร์นเดียว → ถูกปฏิเสธ
const shieldHand2 = st[me].hand.find((h) => h.templateId === 'skill_shield_bash');
const r2 = placeCardToSlot(st, me, shieldHand2.uid);
console.log('หมอบใบที่ 2 ในเทิร์นเดียวถูกปฏิเสธ:', !r2.ok ? 'ผ่าน ✔' : 'FAIL');

// 3) เปิดการ์ดหมอบในเทิร์นตัวเอง → ได้เกราะ
st[me].shards = 9;
const r3 = openSlotCard(st, me, 0);
console.log('เปิดการ์ดหมอบ (โล่):', r3.ok ? 'ผ่าน ✔' : 'FAIL ' + r3.reason);
console.log('ได้เกราะ:', st[me].shield > 0 ? `+${st[me].shield} ผ่าน ✔` : 'FAIL');
console.log('ช่อง 0 ว่างแล้ว:', st[me].slots[0] === null ? 'ผ่าน ✔' : 'FAIL');

// 4) ทิ้งการ์ด
const anyHand = st[me].hand[0];
if (anyHand) {
  const r4 = discardFromHand(st, me, anyHand.uid);
  console.log('ทิ้งการ์ด:', r4.ok ? 'ผ่าน ✔' : 'FAIL ' + r4.reason);
  const r4b = discardFromHand(st, me, st[me].hand[0]?.uid ?? 'x');
  console.log('ทิ้งใบที่ 2 ในเทิร์นเดียวถูกปฏิเสธ:', !r4b.ok ? 'ผ่าน ✔' : 'FAIL');
}

// 5) หมอบการ์ดโจมตีแล้วเปิดช่วงเทิร์นศัตรู → ถูกปฏิเสธ
const st2 = createBattle(
  { uid: 'u1', name: 'A', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_quick_slash') },
  { uid: 'u2', name: 'B', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_shield_bash') },
  'pvp', 'a', 13,
);
const me2 = st2.active;
st2[me2].shards = 9; st2[me2].stam = 100;
const slashHand = st2[me2].hand.find((h) => h.templateId === 'skill_quick_slash');
placeCardToSlot(st2, me2, slashHand.uid);
// จำลองข้ามเทิร์น: ใช้ import endTurn ไม่ได้เพราะไม่ได้ import → set active ตรง ๆ
st2.active = me2 === 'a' ? 'b' : 'a';
const r5 = openSlotCard(st2, me2, 0);
console.log('เปิดการ์ดโจมตีช่วงเทิร์นศัตรูถูกปฏิเสธ:', !r5.ok ? 'ผ่าน ✔' : 'FAIL');

console.log('=== ทดสอบระบบช่องวางการ์ด จบ ===');
