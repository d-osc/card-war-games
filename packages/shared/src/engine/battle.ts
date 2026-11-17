// ===========================================================================
// Card War — Combat Engine (turn-based)
// กติกา:
//  - เทิร์นละ 3 ชาร์ด จั่ว 1 การ์ด (เปิดมือ 6 ใบ มือไม่จำกัดจำนวน)
//  - อัญเชิญการ์ดใช้ชาร์ดตามการ์ด / สกิลเวทใช้มานา / สกิลกายภาพใช้กำลัง
//  - มานาและกำลังฟื้นต่อเทิร์นตามสเตตัสตัวละคร
//  - เดคหมด = บาดเจ็บสะสมจากความเหนื่อย (fatigue) ที่หนักขึ้นเรื่อย ๆ
//  - ไม่จำกัดจำนวนเทิร์น เกมจบจาก HP หมด/ยอมแพ้ เท่านั้น
// ===========================================================================
import { CardTemplate, Stats, resourceCost } from '../types';
import { cardById } from '../cards';
import { rngNext, shuffle } from './rng';

export const OPENING_HAND = 6;
export const MAX_PETS = 3;

export interface HandCard {
  uid: string;
  templateId: string | null; // null = ถูกซ่อน (การ์ดของฝ่ายตรงข้าม)
}

export interface PetOnField {
  uid: string;
  templateId: string;
  name: string;
  emoji: string;
  atk: number;
  hp: number;
}

export type StatusKind = 'poison' | 'atkUp' | 'matkUp';

export interface StatusFx {
  kind: StatusKind;
  value: number;
  turns: number;
}

/** การ์ดที่วางหมอบไว้ในช่องบนกระดาน */
export interface SlotCard {
  uid: string;
  templateId: string | null; // null = ซ่อนจากฝ่ายตรงข้าม
  placedTurn: number;
}

export const SLOTS_COUNT = 5;
export const REUSE_DECK_COST = 10; // ชาร์ดที่ใช้นำการ์ดกลับเข้าเดค

export interface BattleSide {
  uid: string;
  name: string;
  emoji: string;
  level: number;
  isMonster: boolean;
  stats: Stats;
  hp: number;
  maxHp: number;
  mana: number;
  stam: number;
  shards: number;
  deck: string[];      // เหลืออยู่กี่ใบ (ซ่อนจากคู่ต่อสู้ตอน serialize)
  deckCount: number;
  hand: HandCard[];
  slots: (SlotCard | null)[]; // ช่องวางการ์ดหมอบ 5 ช่อง
  pets: PetOnField[];
  statuses: StatusFx[];
  shield: number;
  /** เล่นการ์ดโจมตีไปแล้วในเทิร์นนี้ (จำกัด 1 ใบ/เทิร์น) */
  attackPlayed: boolean;
  /** การ์ดที่ถูกใช้/ทิ้งไปแล้ว (เก็บไว้ให้ Reuse Deck นำกลับ) */
  usedCards: string[];
  /** หมอบการ์ดลงช่องไปแล้วในเทิร์นนี้ (จำกัด 1 ครั้ง/เทิร์น) */
  placedThisTurn: boolean;
}

export interface BattleLogEntry {
  turnNo: number;
  by: 'a' | 'b' | 'sys';
  text: string;
}

export interface BattleState {
  mode: 'pvp' | 'pve' | 'challenge';
  a: BattleSide;
  b: BattleSide;
  active: 'a' | 'b';
  turnNo: number;
  phase: 'playing' | 'finished';
  winner: 'a' | 'b' | null;
  endReason: string;
  log: BattleLogEntry[];
  fatigue: { a: number; b: number };
  rng: number;
}

export interface SideDef {
  uid: string;
  name: string;
  emoji: string;
  level: number;
  stats: Stats;
  deck: string[];
  isMonster?: boolean;
  /** สัตว์เลี้ยงที่สวมใส่ติดตัว — เข้าสนามอัตโนมัติตั้งแต่เริ่มเกม */
  pets?: { templateId: string; name: string; emoji: string; atk: number; hp: number }[];
  /** มานา/กำลังตอนเข้าสนาม (ติดตัวมาจากนอกสนาม) — ไม่ส่ง = เริ่มเต็ม */
  startMana?: number;
  startStam?: number;
  /** HP ตอนเข้าสนาม (ติดตัวมาจากนอกสนาม) — ไม่ส่ง = เริ่มเต็ม */
  startHp?: number;
}

// ---------------------------------------------------------------------------
// สร้าง battle
// ---------------------------------------------------------------------------

function makeSide(def: SideDef): BattleSide {
  return {
    uid: def.uid,
    name: def.name,
    emoji: def.emoji,
    level: def.level,
    isMonster: !!def.isMonster,
    stats: def.stats,
    hp: Math.max(1, def.startHp ?? def.stats.hp),
    maxHp: def.stats.hp,
    mana: Math.max(0, def.startMana ?? def.stats.manaMax),
    stam: Math.max(0, def.startStam ?? def.stats.stamMax),
    shards: 0,
    deck: [],
    deckCount: def.deck.length,
    hand: [],
    pets: (def.pets ?? []).map((p, i) => ({
      uid: `pet_${def.uid}_${i}_${p.templateId}`,
      templateId: p.templateId,
      name: p.name,
      emoji: p.emoji,
      atk: p.atk,
      hp: p.hp,
    })),
    statuses: [],
    shield: 0,
    attackPlayed: false,
    usedCards: [],
    placedThisTurn: false,
    slots: Array(SLOTS_COUNT).fill(null),
  };
}

export function createBattle(defA: SideDef, defB: SideDef, mode: 'pvp' | 'pve' | 'challenge', first: 'a' | 'b', seed = 12345): BattleState {
  const state: BattleState = {
    mode,
    a: makeSide(defA),
    b: makeSide(defB),
    active: first,
    turnNo: 0,
    phase: 'playing',
    winner: null,
    endReason: '',
    log: [],
    fatigue: { a: 0, b: 0 },
    rng: seed | 0,
  };
  state.a.deck = shuffle(defA.deck, () => rngNext(state));
  state.b.deck = shuffle(defB.deck, () => rngNext(state));
  for (let i = 0; i < OPENING_HAND; i++) {
    drawCard(state, 'a');
    drawCard(state, 'b');
  }
  log(state, 'sys', `⚔️ การต่อสู้เริ่มต้น! ${defA.name} ปะทะ ${defB.name} — ${state[first].name} เริ่มก่อน`);
  if (state.a.pets.length > 0) log(state, 'a', `🐾 ${state.a.name} อัญเชิญ ${state.a.pets.map((p) => `${p.name} (โจมตี ${p.atk})`).join(', ')} เข้าสนาม`);
  if (state.b.pets.length > 0) log(state, 'b', `🐾 ${state.b.name} อัญเชิญ ${state.b.pets.map((p) => `${p.name} (โจมตี ${p.atk})`).join(', ')} เข้าสนาม`);
  startTurn(state);
  return state;
}

// ---------------------------------------------------------------------------
// helpers ภายใน
// ---------------------------------------------------------------------------

function log(state: BattleState, by: 'a' | 'b' | 'sys', text: string): void {
  state.log.push({ turnNo: state.turnNo, by, text });
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
}

function side(state: BattleState, key: 'a' | 'b'): BattleSide {
  return key === 'a' ? state.a : state.b;
}

function other(key: 'a' | 'b'): 'a' | 'b' {
  return key === 'a' ? 'b' : 'a';
}

function drawCard(state: BattleState, key: 'a' | 'b'): void {
  const s = side(state, key);
  if (s.deck.length === 0) {
    state.fatigue[key] += 1;
    const dmg = 5 * state.fatigue[key];
    s.hp -= dmg;
    log(state, key, `😩 ${s.name} เดคหมด! ความเหนื่อยล้าทำร้ายเอง ${dmg} ดาเมจ`);
    return;
  }
  const id = s.deck.shift()!;
  s.deckCount = s.deck.length;
  s.hand.push({ uid: `${key}-${s.uid}-${state.turnNo}-${s.hand.length}-${Math.floor(rngNext(state) * 1e6)}`, templateId: id });
}

export function effAtk(s: BattleSide): number {
  return s.stats.atk + s.statuses.filter((x) => x.kind === 'atkUp').reduce((a, x) => a + x.value, 0);
}

export function effMatk(s: BattleSide): number {
  return s.stats.matk + s.statuses.filter((x) => x.kind === 'matkUp').reduce((a, x) => a + x.value, 0);
}

/** ประมาณดาเมจหลังหักลดการป้องกัน (ใช้ทั้งในเอนจิ้นและ AI) */
export function estimateDamage(power: number, atk: number, def: number): number {
  return Math.max(1, Math.round(power + atk - def * 0.6));
}

function applyDamage(state: BattleState, target: BattleSide, amount: number, source: string): void {
  let dmg = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
    if (absorbed > 0) log(state, 'sys', `🛡️ ${target.name} เกราะดูดซับ ${absorbed} ดาเมจ`);
  }
  if (dmg > 0) {
    target.hp -= dmg;
    log(state, 'sys', `💥 ${source} สร้าง ${dmg} ดาเมจให้ ${target.name} (เหลือ ${Math.max(0, target.hp)})`);
  }
}

function heal(state: BattleState, s: BattleSide, amount: number): void {
  const before = s.hp;
  s.hp = Math.min(s.maxHp, s.hp + amount);
  const gained = s.hp - before;
  if (gained > 0) log(state, 'sys', `💚 ${s.name} ฟื้นฟู ${gained} HP (เหลือ ${s.hp})`);
}

function finish(state: BattleState, winner: 'a' | 'b', reason: string): void {
  if (state.phase === 'finished') return;
  state.phase = 'finished';
  state.winner = winner;
  state.endReason = reason;
  log(state, 'sys', `🏁 ${side(state, winner).name} เป็นผู้ชนะ! (${reason})`);
}

function checkDeath(state: BattleState): boolean {
  if (state.a.hp <= 0) {
    finish(state, 'b', 'HP หมด');
    return true;
  }
  if (state.b.hp <= 0) {
    finish(state, 'a', 'HP หมด');
    return true;
  }
  return false;
}

/** ใช้แทนการเทียบ state.phase ตรง ๆ เพราะ TS จะ narrow ทะลุหลัง function call */
export function isFinished(state: BattleState): boolean {
  return (state.phase as string) !== 'playing';
}

// ---------------------------------------------------------------------------
// เริ่มเทิร์น
// ---------------------------------------------------------------------------

export function startTurn(state: BattleState): void {
  if (isFinished(state)) return;
  const key = state.active;
  const s = side(state, key);
  state.turnNo += 1;

  // รับ 3 ชาร์ด + รีเซ็ตจำนวนการ์ดโจมตีของเทิร์นใหม่
  s.attackPlayed = false;
  s.placedThisTurn = false;
  s.shards += 3;
  log(state, key, `🔽 เทิร์นที่ ${state.turnNo}: ${s.name} ได้รับ 3 ชาร์ด`);

  // ฟื้น hp/มานา/กำลังต่อเทิร์น — ตามสเตตัส regen ของแต่ละค่าทั้งหมด
  const hpGain = Math.min(s.maxHp - s.hp, s.stats.hpRegen);
  const manaGain = Math.min(s.stats.manaMax - s.mana, s.stats.manaRegen);
  const stamGain = Math.min(s.stats.stamMax - s.stam, s.stats.stamRegen);
  s.hp += hpGain;
  s.mana += manaGain;
  s.stam += stamGain;
  log(state, key, `✨ ${s.name} ฟื้น ❤️${hpGain} 🔵${manaGain} ⚡${stamGain}`);

  // พิษกัดก่อน แล้วนับถอยหลังสถานะ
  for (const fx of [...s.statuses]) {
    if (fx.kind === 'poison') {
      s.hp -= fx.value;
      log(state, 'sys', `☠️ ${s.name} ได้รับพิษ ${fx.value} ดาเมจ (เหลือ ${Math.max(0, s.hp)})`);
    }
    fx.turns -= 1;
  }
  const expired = s.statuses.filter((x) => x.turns <= 0);
  if (expired.length > 0) log(state, 'sys', `✨ สถานะของ ${s.name} หมดอายุ`);
  s.statuses = s.statuses.filter((x) => x.turns > 0);

  checkDeath(state);
  if (isFinished(state)) return;

  // สัตว์เลี้ยงโจมตี
  const foe = side(state, other(key));
  for (const pet of s.pets) {
    if (foe.hp <= 0) break;
    applyDamage(state, foe, Math.max(1, Math.round(pet.atk - foe.stats.def * 0.2)), `🐾 ${pet.name} ของ ${s.name}`);
  }
  checkDeath(state);
  if (isFinished(state)) return;

  // จั่ว 1 การ์ด
  drawCard(state, key);
  checkDeath(state);
  // ไม่จำกัดจำนวนเทิร์น — เกมจบจาก HP หมด/ยอมแพ้/fatigue เท่านั้น
}

// ---------------------------------------------------------------------------
// เล่นการ์ด
// ---------------------------------------------------------------------------

export interface CanPlayResult {
  ok: boolean;
  reason?: string;
}

/** การ์ดปฏิกิริยา (ใช้ได้แม้ไม่ใช่เทิร์นตัวเอง) — สกิลป้องกันโล่ */
export function isReactionCard(t: CardTemplate): boolean {
  return t.group === 'skill' && t.skill?.kind === 'shield';
}

export function canPlayCard(state: BattleState, actor: 'a' | 'b', handUid: string): CanPlayResult {
  if (state.phase === 'finished') return { ok: false, reason: 'การต่อสู้จบแล้ว' };
  const s0 = side(state, actor);
  const hc0 = s0.hand.find((h) => h.uid === handUid);
  const reactionOk = state.active !== actor && hc0?.templateId != null && isReactionCard(cardById(hc0.templateId));
  if (state.active !== actor && !reactionOk) return { ok: false, reason: 'ไม่ใช่เทิร์นของคุณ (เฉพาะสกิลป้องกันโล่เท่านั้นที่ใช้ตอนศัตรูเล่นเทิร์นได้)' };
  const s = side(state, actor);
  const hc = s.hand.find((h) => h.uid === handUid);
  if (!hc || hc.templateId == null) return { ok: false, reason: 'ไม่พบการ์ดในมือ' };
  const t = cardById(hc.templateId);
  if (t.shardCost <= 0) return { ok: false, reason: 'การ์ดนี้เล่นในสนามไม่ได้' };
  if (t.group === 'pet' && s.pets.length >= MAX_PETS) return { ok: false, reason: 'สัตว์เลี้ยงบนสนามเต็มแล้ว' };
  if (t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic') && s.attackPlayed) {
    return { ok: false, reason: 'ใช้การ์ดโจมตีได้ 1 ใบต่อเทิร์นเท่านั้น' };
  }
  const cost = resourceCost(t);
  if (s.shards < cost.shard) return { ok: false, reason: 'ชาร์ดไม่พอ' };
  if (s.mana < cost.mana) return { ok: false, reason: 'มานาไม่พอ' };
  if (s.stam < cost.stam) return { ok: false, reason: 'กำลังไม่พอ' };
  return { ok: true };
}

export function playCard(state: BattleState, actor: 'a' | 'b', handUid: string): CanPlayResult {
  const check = canPlayCard(state, actor, handUid);
  if (!check.ok) return check;

  const s = side(state, actor);
  const foe = side(state, other(actor));
  const idx = s.hand.findIndex((h) => h.uid === handUid);
  const hc = s.hand[idx];
  const t = cardById(hc.templateId!);
  const cost = resourceCost(t);
  s.shards -= cost.shard;
  s.mana -= cost.mana;
  s.stam -= cost.stam;
  s.hand.splice(idx, 1);
  s.usedCards.push(hc.templateId!);
  if (t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic')) {
    s.attackPlayed = true;
  }

  if (t.group === 'skill' && t.skill) {
    const sk = t.skill;
    switch (sk.kind) {
      case 'physical': {
        const dmg = estimateDamage(sk.power, effAtk(s), foe.stats.def);
        const variance = 0.9 + rngNext(state) * 0.2;
        applyDamage(state, foe, Math.max(1, Math.round(dmg * variance)), `🗡️ ${s.name} ใช้ ${t.name}`);
        break;
      }
      case 'magic': {
        const dmg = estimateDamage(sk.power, effMatk(s), foe.stats.mdef);
        const variance = 0.9 + rngNext(state) * 0.2;
        applyDamage(state, foe, Math.max(1, Math.round(dmg * variance)), `✨ ${s.name} ร่าย ${t.name}`);
        break;
      }
      case 'heal':
        heal(state, s, sk.power + Math.round(effMatk(s) * 0.3));
        log(state, actor, `💖 ${s.name} ใช้ ${t.name}`);
        break;
      case 'shield':
        s.shield += sk.power;
        const react = state.active !== actor ? ' (ตั้งรับระหว่างศัตรูโจมตี!)' : '';
        log(state, actor, `🛡️ ${s.name} ใช้ ${t.name} ได้เกราะ ${sk.power} จุด${react}`);
        break;
      case 'buff_atk':
        s.statuses.push({ kind: 'atkUp', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `📢 ${s.name} ใช้ ${t.name} โจมตี +${sk.power}`);
        break;
      case 'buff_matk':
        s.statuses.push({ kind: 'matkUp', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `🔮 ${s.name} ใช้ ${t.name} เวท +${sk.power}`);
        break;
      case 'poison':
        foe.statuses.push({ kind: 'poison', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `☠️ ${s.name} ใช้ ${t.name} ทำให้ ${foe.name} ติดพิษ`);
        break;
    }
  } else if (t.group === 'consumable' && t.consumable) {
    const c = t.consumable;
    log(state, actor, `${t.emoji} ${s.name} ใช้ ${t.name}`);
    if (c.heal) heal(state, s, c.heal);
    if (c.mana) {
      s.mana = Math.min(s.stats.manaMax, s.mana + c.mana);
      log(state, 'sys', `🔵 ${s.name} ฟื้นมานา ${c.mana} จุด`);
    }
    if (c.stam) {
      s.stam = Math.min(s.stats.stamMax, s.stam + c.stam);
      log(state, 'sys', `🟠 ${s.name} ฟื้นกำลัง ${c.stam} จุด`);
    }
    if (c.atkBuff) s.statuses.push({ kind: 'atkUp', value: c.atkBuff, turns: c.buffTurns ?? 3 });
    if (c.matkBuff) s.statuses.push({ kind: 'matkUp', value: c.matkBuff, turns: c.buffTurns ?? 3 });
  } else if (t.group === 'pet' && t.pet) {
    s.pets.push({
      uid: hc.uid,
      templateId: t.id,
      name: t.name,
      emoji: t.emoji,
      atk: t.pet.atk,
      hp: t.pet.hp,
    });
    log(state, actor, `🐾 ${s.name} อัญเชิญ ${t.name}!`);
  }

  checkDeath(state);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// จบเทิร์น
// ---------------------------------------------------------------------------
// หมอบการ์ดลงช่อง / เปิดการ์ดหมอบ / ทิ้งการ์ด
// ---------------------------------------------------------------------------

/** หมอบการ์ดจากมือลงช่องบนกระดาน (face-down) — ฟรี จำกัด 1 ครั้ง/เทิร์น */
export function placeCardToSlot(state: BattleState, actor: 'a' | 'b', handUid: string, slotIndex?: number): CanPlayResult {
  if (isFinished(state)) return { ok: false, reason: 'การต่อสู้จบแล้ว' };
  if (state.active !== actor) return { ok: false, reason: 'หมอบการ์ดได้เฉพาะเทิร์นของคุณ' };
  const s = side(state, actor);
  if (s.placedThisTurn) return { ok: false, reason: 'หมอบการ์ดได้ 1 ครั้งต่อเทิร์น' };
  const idx = s.hand.findIndex((h) => h.uid === handUid);
  if (idx < 0) return { ok: false, reason: 'ไม่พบการ์ดในมือ' };
  const hc = s.hand[idx];
  if (hc.templateId == null) return { ok: false, reason: 'ไม่พบการ์ดในมือ' };
  const t = cardById(hc.templateId);
  if (t.shardCost <= 0) return { ok: false, reason: 'การ์ดนี้หมอบไม่ได้' };
  // หาช่องว่าง (ถ้าไม่ระบุช่อง)
  let slot = slotIndex;
  if (slot == null || slot < 0 || slot >= SLOTS_COUNT || s.slots[slot] != null) {
    slot = s.slots.findIndex((x) => x == null);
    if (slot < 0) return { ok: false, reason: 'ช่องวางการ์ดเต็มแล้ว (5 ช่อง)' };
  }
  s.hand.splice(idx, 1);
  s.slots[slot] = { uid: hc.uid, templateId: hc.templateId, placedTurn: state.turnNo };
  s.placedThisTurn = true;
  log(state, actor, `📋 ${s.name} หมอบการ์ด 1 ใบลงช่องที่ ${slot + 1}`);
  return { ok: true };
}

/** เปิดการ์ดหมอบ = จ่ายค่าตามการ์ด + เอฟเฟกต์ทำงาน (เหมือนเล่นจากมือ) */
export function openSlotCard(state: BattleState, actor: 'a' | 'b', slotIndex: number): CanPlayResult {
  if (isFinished(state)) return { ok: false, reason: 'การต่อสู้จบแล้ว' };
  const s = side(state, actor);
  const sc = s.slots[slotIndex];
  if (!sc || !sc.templateId) return { ok: false, reason: 'ช่องนี้ว่าง' };
  const t = cardById(sc.templateId);
  // ช่วงเทิร์นศัตรู: เปิดได้เฉพาะสกิลโล่ (ตั้งรับ)
  if (state.active !== actor && !isReactionCard(t)) {
    return { ok: false, reason: 'ช่วงเทิร์นศัตรูเปิดได้เฉพาะการ์ดป้องกัน (โล่)' };
  }
  // จ่ายค่า
  const cost = resourceCost(t);
  if (s.shards < cost.shard) return { ok: false, reason: 'ชาร์ดไม่พอ' };
  if (s.mana < cost.mana) return { ok: false, reason: 'มานาไม่พอ' };
  if (s.stam < cost.stam) return { ok: false, reason: 'กำลังไม่พอ' };
  // จำกัดโจมตี 1 ใบ/เทิร์น
  if (t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic') && s.attackPlayed) {
    return { ok: false, reason: 'ใช้การ์ดโจมตีได้ 1 ใบต่อเทิร์นเท่านั้น' };
  }
  // ลบจากช่อง + จ่ายค่า
  s.slots[slotIndex] = null;
  s.usedCards.push(sc.templateId);
  s.shards -= cost.shard;
  s.mana -= cost.mana;
  s.stam -= cost.stam;
  if (t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic')) {
    s.attackPlayed = true;
  }
  const foe = side(state, other(actor));
  // --- apply effect (reuse playCard logic) ---
  const react = state.active !== actor ? ' (ตั้งรับ!)' : '';
  if (t.group === 'skill' && t.skill) {
    const sk = t.skill;
    switch (sk.kind) {
      case 'physical': {
        const dmg = estimateDamage(sk.power, effAtk(s), foe.stats.def);
        const variance = 0.9 + rngNext(state) * 0.2;
        applyDamage(state, foe, Math.max(1, Math.round(dmg * variance)), `🗡️ ${s.name} เปิดการ์ด ${t.name}${react}`);
        break;
      }
      case 'magic': {
        const dmg = estimateDamage(sk.power, effMatk(s), foe.stats.mdef);
        const variance = 0.9 + rngNext(state) * 0.2;
        applyDamage(state, foe, Math.max(1, Math.round(dmg * variance)), `✨ ${s.name} เปิดการ์ด ${t.name}${react}`);
        break;
      }
      case 'heal':
        heal(state, s, sk.power + Math.round(effMatk(s) * 0.3));
        log(state, actor, `💖 ${s.name} เปิดการ์ด ${t.name}${react}`);
        break;
      case 'shield':
        s.shield += sk.power;
        log(state, actor, `🛡️ ${s.name} เปิดการ์ด ${t.name} ได้เกราะ ${sk.power} จุด${react}`);
        break;
      case 'buff_atk':
        s.statuses.push({ kind: 'atkUp', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `📢 ${s.name} เปิดการ์ด ${t.name} โจมตี +${sk.power}${react}`);
        break;
      case 'buff_matk':
        s.statuses.push({ kind: 'matkUp', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `🔮 ${s.name} เปิดการ์ด ${t.name} เวท +${sk.power}${react}`);
        break;
      case 'poison':
        foe.statuses.push({ kind: 'poison', value: sk.power, turns: sk.duration ?? 3 });
        log(state, actor, `☠️ ${s.name} เปิดการ์ด ${t.name} ทำให้ ${foe.name} ติดพิษ${react}`);
        break;
    }
  } else if (t.group === 'consumable' && t.consumable) {
    const c = t.consumable;
    log(state, actor, `${t.emoji} ${s.name} เปิดการ์ด ${t.name}${react}`);
    if (c.heal) heal(state, s, c.heal);
    if (c.mana) { s.mana = Math.min(s.stats.manaMax, s.mana + c.mana); log(state, 'sys', `🔵 ${s.name} ฟื้นมานา ${c.mana} จุด`); }
    if (c.stam) { s.stam = Math.min(s.stats.stamMax, s.stam + c.stam); log(state, 'sys', `🟠 ${s.name} ฟื้นกำลัง ${c.stam} จุด`); }
    if (c.atkBuff) s.statuses.push({ kind: 'atkUp', value: c.atkBuff, turns: c.buffTurns ?? 3 });
    if (c.matkBuff) s.statuses.push({ kind: 'matkUp', value: c.matkBuff, turns: c.buffTurns ?? 3 });
  } else if (t.group === 'pet' && t.pet) {
    s.pets.push({ uid: sc.uid, templateId: t.id, name: t.name, emoji: t.emoji, atk: t.pet.atk, hp: t.pet.hp });
    log(state, actor, `🐾 ${s.name} เปิดการ์ดเรียก ${t.name}!${react}`);
  }
  checkDeath(state);
  return { ok: true };
}

/** นำการ์ดที่ใช้แล้วทั้งหมดกลับเข้าเดค — ใช้ 10 ชาร์ด */
export function reuseDeck(state: BattleState, actor: 'a' | 'b'): CanPlayResult {
  if (isFinished(state)) return { ok: false, reason: 'การต่อสู้จบแล้ว' };
  if (state.active !== actor) return { ok: false, reason: 'ใช้ได้เฉพาะเทิร์นของคุณ' };
  const s = side(state, actor);
  if (s.shards < REUSE_DECK_COST) return { ok: false, reason: `ชาร์ดไม่พอ (ต้องใช้ ${REUSE_DECK_COST} ชาร์ด)` };
  if (s.usedCards.length === 0) return { ok: false, reason: 'ยังไม่มีการ์ดที่ใช้ไปแล้ว' };
  const returned = s.usedCards.splice(0);
  // สุ่มก่อนใส่เดค
  for (let i = returned.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(state) * (i + 1));
    [returned[i], returned[j]] = [returned[j], returned[i]];
  }
  s.deck.push(...returned);
  s.deckCount = s.deck.length;
  s.shards -= REUSE_DECK_COST;
  log(state, actor, `♻️ ${s.name} ใช้ ${REUSE_DECK_COST} ชาร์ดนำการ์ด ${returned.length} ใบกลับเข้าเดค!`);
  return { ok: true };
}

export function endTurn(state: BattleState): CanPlayResult {
  if (state.phase === 'finished') return { ok: false, reason: 'การต่อสู้จบแล้ว' };
  state.active = other(state.active);
  startTurn(state);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ซ่อนข้อมูลของฝ่ายตรงข้ามก่อนส่งให้ client
// ---------------------------------------------------------------------------

export function sanitizeState(state: BattleState, viewer: 'a' | 'b'): BattleState {
  const clone: BattleState = structuredClone(state);
  const hidden = viewer === 'a' ? clone.b : clone.a;
  hidden.hand = hidden.hand.map((h) => ({ uid: h.uid, templateId: null }));
  hidden.deck = [];
  hidden.slots = hidden.slots.map((s) => (s ? { ...s, templateId: null } : null));
  return clone;
}
