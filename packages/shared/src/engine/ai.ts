// ===========================================================================
// Card War — AI สำหรับมอนสเตอร์ในดันเจี้ยน และคุมฝ่ายที่หลุดการเชื่อมต่อ
// ===========================================================================
import { BattleState, canPlayCard, effAtk, effMatk, estimateDamage, REUSE_DECK_COST } from './battle';
import { cardById } from '../cards';

export type AiAction =
  | { type: 'play'; handUid: string }
  | { type: 'endTurn' }
  | { type: 'reuseDeck' };

interface Candidate {
  handUid: string;
  score: number;
}

/** ประเมินการ์ด 1 ใบว่าคุ้มแค่ไหนในสถานการณ์ปัจจุบัน */
function evaluate(state: BattleState, key: 'a' | 'b', handUid: string): Candidate | null {
  const s = key === 'a' ? state.a : state.b;
  const foe = key === 'a' ? state.b : state.a;
  const hc = s.hand.find((h) => h.uid === handUid);
  if (!hc || hc.templateId == null) return null;
  const check = canPlayCard(state, key, handUid);
  if (!check.ok) return null;
  const t = cardById(hc.templateId);

  const hpMissing = s.maxHp - s.hp;
  const foeHpTotal = Math.max(1, foe.hp + foe.shield);

  let score = 0;
  if (t.group === 'skill' && t.skill) {
    const sk = t.skill;
    switch (sk.kind) {
      case 'physical': {
        const dmg = estimateDamage(sk.power, effAtk(s), foe.stats.def);
        score = dmg;
        if (dmg >= foeHpTotal) score = 100000; // จบเกมได้เลย
        break;
      }
      case 'magic': {
        const dmg = estimateDamage(sk.power, effMatk(s), foe.stats.mdef);
        score = dmg;
        if (dmg >= foeHpTotal) score = 100000;
        break;
      }
      case 'heal': {
        const effective = Math.min(sk.power + Math.round(effMatk(s) * 0.3), hpMissing);
        score = hpMissing > s.maxHp * 0.3 ? effective * 1.6 : 1; // ไม่หวังให้รักษาตอนเลือดเต็ม
        break;
      }
      case 'shield':
        score = s.shield === 0 ? sk.power : 3;
        break;
      case 'buff_atk':
        score = s.statuses.some((x) => x.kind === 'atkUp') ? 1 : sk.power * 2.5;
        break;
      case 'buff_matk':
        score = s.statuses.some((x) => x.kind === 'matkUp') ? 1 : sk.power * 2.5;
        break;
      case 'poison':
        score = foe.statuses.some((x) => x.kind === 'poison') ? 1 : sk.power * (sk.duration ?? 3) * 1.4;
        break;
    }
  } else if (t.group === 'pet' && t.pet) {
    score = 30 + t.pet.atk * 2;
  } else if (t.group === 'consumable' && t.consumable) {
    const c = t.consumable;
    let v = 0;
    if (c.heal) v += Math.min(c.heal, hpMissing) * (hpMissing > s.maxHp * 0.35 ? 1.8 : 0.1);
    if (c.mana) v += Math.min(c.mana, s.stats.manaMax - s.mana) * 0.5;
    if (c.stam) v += Math.min(c.stam, s.stats.stamMax - s.stam) * 0.5;
    if (c.atkBuff && !s.statuses.some((x) => x.kind === 'atkUp')) v += c.atkBuff * 2;
    if (c.matkBuff && !s.statuses.some((x) => x.kind === 'matkUp')) v += c.matkBuff * 2;
    score = v;
  }
  return { handUid, score };
}

export function aiPickAction(state: BattleState, key: 'a' | 'b'): AiAction {
  const s = key === 'a' ? state.a : state.b;

  // รีไซเคิลการ์ดเมื่อเดคใกล้หมด + มีชาร์ดพอ + มีการ์ดที่ใช้ไปแล้ว
  // (AI ฉลาดขึ้น: กัน fatigue ตายโดยไม่จำเป็น)
  if (s.deck.length <= 2 && s.usedCards.length > 0 && s.shards >= REUSE_DECK_COST + 3) {
    return { type: 'reuseDeck' };
  }

  let best: Candidate | null = null;
  for (const hc of s.hand) {
    const c = evaluate(state, key, hc.uid);
    if (c && (!best || c.score > best.score)) best = c;
  }
  // ไม่เปลืองการ์ดกับการ์ดคุณภาพต่ำจนหมดมือ ถ้าไม่มีอะไรคุ้มก็จบเทิร์น
  if (!best || best.score < 4) return { type: 'endTurn' };
  return { type: 'play', handUid: best.handUid };
}
