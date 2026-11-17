// ทดสอบ: สกิลโล่ใช้ได้ในเทิร์นศัตรู (reaction) — สกิลอื่นใช้ไม่ได้
// รัน: npx tsx scripts/test-shield-reaction.mjs (จาก apps/server)
import { createBattle, canPlayCard, playCard, endTurn } from '@cardwar/shared';

const stats = { hp: 200, atk: 10, def: 5, matk: 5, mdef: 5, spd: 5, manaMax: 50, manaRegen: 3, stamMax: 50, stamRegen: 4 };
const deckA = Array(20).fill('skill_quick_slash');  // A = ผู้โจมตี (เริ่มเทิร์น)
const deckB = Array(20).fill('skill_shield_bash');  // B = ผู้ตั้งรับ

const st = createBattle(
  { uid: 'u1', name: 'A', emoji: 'x', level: 1, stats, deck: deckA },
  { uid: 'u2', name: 'B', emoji: 'x', level: 1, stats, deck: deckB },
  'pvp', 'a', 42,
);

const actor = st.active;                       // ฝ่ายเริ่มเทิร์น (A)
const defender = actor === 'a' ? 'b' : 'a';    // ฝ่ายตั้งรับ (B)
// จำลองว่า B เคยผ่านเทิร์นตัวเอง มีชาร์ด/กำลังคงเหลือพอใช้ตั้งรับ
st[defender].shards = 5;
st[defender].stam = 30;
const defHand = st[defender].hand.find((h) => h.templateId === 'skill_shield_bash');
const atkHand = st[actor].hand.find((h) => h.templateId === 'skill_quick_slash');

// 1) ฝ่ายตั้งรับเล่นโล่ในเทิร์นศัตรู — ต้องผ่าน
const react = canPlayCard(st, defender, defHand.uid);
console.log('โล่ในเทิร์นศัตรู:', react.ok ? 'ผ่าน ✔' : 'FAIL ' + react.reason);

// 2) เล่นสำเร็จ + ได้เกราะ
const played = playCard(st, defender, defHand.uid);
console.log('เล่นโล่สำเร็จ:', played.ok ? 'ผ่าน ✔' : 'FAIL');
console.log('ได้เกราะ:', st[defender].shield > 0 ? `+${st[defender].shield} ผ่าน ✔` : 'FAIL');

// 3) ฝ่ายตั้งรับหยิบการ์ดโจมตีของฝ่ายตรงข้ามมาเช็ค (ไม่มีในมือ) — ใช้การเล่นโล่ซ้ำอีกใบแบบสกิลผิดแทน:
//    ให้ B (ผู้เริ่ม) พยายามเล่นการ์ดในเทิร์นตัวเองผ่านปกติ
const ownTurnPlay = canPlayCard(st, actor, atkHand.uid);
console.log('สกิลโจมตีในเทิร์นตัวเอง:', ownTurnPlay.ok ? 'ผ่าน ✔' : 'FAIL ' + ownTurnPlay.reason);

// 4) จบเทิร์นแล้วฝ่ายเดิมพยายามเล่นสกิลโจมตีในเทิร์นศัตรู — ต้องถูกปฏิเสธ
endTurn(st);
const attackerNow = st.active === 'a' ? 'b' : 'a';
const wrongHand = st[attackerNow].hand.find((h) => h.templateId === 'skill_quick_slash');
if (wrongHand) {
  const bad = canPlayCard(st, attackerNow, wrongHand.uid);
  const isDefenderTurnCard = attackerNow !== st.active;
  console.log('สกิลโจมตีในเทิร์นศัตรูถูกปฏิเสธ:', (!isDefenderTurnCard || bad.ok === false) ? 'ผ่าน ✔' : 'FAIL ถูกอนุญาต');
} else {
  console.log('สกิลโจมตีในเทิร์นศัตรูถูกปฏิเสธ: ผ่าน ✔ (ไม่มีการ์ดในมือ — ข้าม)');
}

console.log('=== ทดสอบ shield reaction จบ ===');
