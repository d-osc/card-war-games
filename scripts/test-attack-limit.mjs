// ทดสอบ: การ์ดโจมตีใช้ได้ 1 ใบ/เทิร์น — ใบที่ 2 ถูกปฏิเสธ และรีเซ็ตเทิร์นใหม่
import { createBattle, canPlayCard, playCard, endTurn } from '@cardwar/shared';

const stats = { hp: 500, atk: 10, def: 0, matk: 10, mdef: 0, spd: 5, manaMax: 200, manaRegen: 5, stamMax: 200, stamRegen: 5 };
const deck = Array(20).fill('skill_quick_slash'); // ทุกใบเป็นการ์ดโจมตี

const st = createBattle(
  { uid: 'u1', name: 'A', emoji: 'x', level: 1, stats, deck },
  { uid: 'u2', name: 'B', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_shield_bash') },
  'pvp', 'a', 7,
);

const me = st.active; // 'a'
st[me].shards = 9; st[me].stam = 100; // ทรัพยากรพอเล่นหลายใบ เพื่อพิสูจน์ว่าตัวจำกัดคือกติกา

const [c1, c2] = st[me].hand.filter((h) => h.templateId === 'skill_quick_slash');
const r1 = playCard(st, me, c1.uid);
console.log('โจมตีใบที่ 1:', r1.ok ? 'ผ่าน ✔' : 'FAIL');
const r2 = canPlayCard(st, me, c2.uid);
console.log('โจมตีใบที่ 2 ถูกปฏิเสธ:', r2.ok === false && r2.reason.includes('1 ใบ') ? 'ผ่าน ✔ (' + r2.reason + ')' : 'FAIL ' + JSON.stringify(r2));

// การ์ดโล่ยังใช้ได้ปกติในเทิร์นเดียวกัน (ไม่ใช่การ์ดโจมตี)
const st2 = createBattle(
  { uid: 'u1', name: 'A', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_shield_bash') },
  { uid: 'u2', name: 'B', emoji: 'x', level: 1, stats, deck: Array(20).fill('skill_quick_slash') },
  'pvp', 'a', 9,
);
st2[st2.active].shards = 9; st2[st2.active].stam = 100;
const sh1 = st2[st2.active].hand[0], sh2 = st2[st2.active].hand[1];
const s1 = playCard(st2, st2.active, sh1.uid);
const s2 = playCard(st2, st2.active, sh2.uid);
console.log('โล่ 2 ใบในเทิร์นเดียว (ไม่จำกัด):', s1.ok && s2.ok ? 'ผ่าน ✔' : 'FAIL');

// ข้ามเทิร์นแล้วโจมตีได้อีก
endTurn(st); endTurn(st); // กลับมาเป็นเทิร์นของ me
const back = st.active === me;
const r3 = st[me].hand.some((h) => h.templateId === 'skill_quick_slash') ? canPlayCard(st, me, st[me].hand.find((h) => h.templateId === 'skill_quick_slash').uid) : { ok: true };
console.log('เทิร์นใหม่โจมตีได้อีก:', back && r3.ok ? 'ผ่าน ✔' : 'FAIL ' + JSON.stringify(r3));

console.log('=== ทดสอบจำกัดโจมตี 1 ใบ/เทิร์น จบ ===');
