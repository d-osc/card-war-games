// ===========================================================================
// Card War — Battle Manager
// ดูแล battle แบบ real-time: คิว PvP, PvE ดันเจี้ยน, turn timer,
// AI คุมมอนสเตอร์/ผู้เล่นที่หลุด, รางวัล + Elo
// ===========================================================================
import { Server, Socket } from 'socket.io';
import {
  aiPickAction, BattleState, createBattle, DECK_MIN, endTurn, isFinished, isReactionCard, HERO_EMOJI, monsterForFloor, MonsterDef, openSlotCard, placeCardToSlot, playCard,
  PVP_TURN_MS, ELO_K, reuseDeck, sanitizeState, SideDef, Stats, cardById,
} from '@cardwar/shared';
import { prisma } from '../db';
import { AppError } from '../errors';
import { buildMeCharacter, computeStats, grantGold, grantXp, syncManaStam } from '../services/characters';
import { mintCard, requireDeck } from '../services/inventory';
import { onQuestEvent } from '../services/quests';
import { recordLedger } from '../services/ledger';

interface Loadout {
  userId: number;
  name: string;
  emoji: string;
  level: number;
  stats: Stats;
  deck: string[];
  rating: number;
  /** สัตว์เลี้ยงที่สวมใส่ — เข้าสนามอัตโนมัติ */
  pets: { templateId: string; name: string; emoji: string; atk: number; hp: number }[];
  /** มานา/กำลัง/hp ตอนเข้าสนาม (ติดตัวจากนอกสนาม) */
  mana: number;
  stam: number;
  hp: number;
}

interface SideSlot {
  userId: number | null; // pve ฝั่ง b เป็นมอนสเตอร์ → null
  socketId: string | null;
  connected: boolean;
}

interface PendingAttack {
  attacker: 'a' | 'b';
  handUid: string;
  defenderSocketId: string;
  timeout: NodeJS.Timeout;
}

interface Runtime {
  id: string;
  mode: 'pvp' | 'pve' | 'challenge'; // challenge = ท้าเดคผู้เล่นคนอื่น (AI คุมฝ่ายตั้งรับ)
  state: BattleState;
  a: SideSlot;
  b: SideSlot;
  floor: number;
  monster: MonsterDef | null;
  turnTimer: NodeJS.Timeout | null;
  turnToken: number;
  turnEndsAt: number;
  started: boolean;
  aiRunning: boolean;
  dcTimers: { a: NodeJS.Timeout | null; b: NodeJS.Timeout | null };
  rewardSent: boolean;
  createdAt: number;
  pendingAttack: PendingAttack | null;
}

interface SocketData {
  userId: number;
}

function sideDefFrom(l: Loadout): SideDef {
  return {
    uid: `u${l.userId}`, name: l.name, emoji: l.emoji, level: l.level, stats: l.stats, deck: l.deck,
    pets: l.pets, startMana: l.mana, startStam: l.stam, startHp: l.hp,
  };
}

function monsterSideDef(m: MonsterDef): SideDef {
  return { uid: `m_${m.id}`, name: m.name, emoji: m.emoji, level: m.level, stats: m.stats, deck: m.deck, isMonster: true };
}

export class BattleManager {
  private io!: Server;
  private battles = new Map<string, Runtime>();
  private queue = new Map<number, { socketId: string; loadout: Loadout }>();
  private rooms = new Map<string, { hostSocketId: string; hostLoadout: Loadout; createdAt: number }>();
  private socketBattle = new Map<string, { battleId: string; side: 'a' | 'b' }>();
  private idCounter = 0;

  init(io: Server): void {
    this.io = io;
  }

  // -----------------------------------------------------------------------
  // โหลดข้อมูลผู้เล่นก่อนเข้าต่อสู้
  // -----------------------------------------------------------------------

  private async getLoadout(userId: number): Promise<Loadout> {
    const char = await prisma.character.findUnique({ where: { userId } });
    if (!char) throw new AppError('ไม่พบตัวละคร กรุณาสร้างตัวละครก่อน');
    const deck = await requireDeck(userId);
    const equipped = await prisma.cardInstance.findMany({ where: { ownerId: userId, status: 'EQUIPPED' } });
    const stats = computeStats(char, equipped);
    // สัตว์เลี้ยงที่สวมใส่ (slot='pet') เข้าสนามอัตโนมัติ — ไม่ต้องลงเดค
    const pets = equipped
      .map((inst) => cardById(inst.templateId))
      .filter((t) => t.group === 'pet' && t.pet)
      .map((t) => ({ templateId: t.id, name: t.name, emoji: t.emoji, atk: t.pet!.atk, hp: t.pet!.hp }));
    // มานา/กำลัง/hp ติดตัวจากนอกสนาม (ซิงก์การฟื้น 1/ชม. ก่อนเข้า)
    const rested = await syncManaStam(char);
    return {
      userId, name: char.name, emoji: HERO_EMOJI, level: char.level, stats, deck, rating: char.rating, pets,
      mana: Math.max(0, rested.mana), stam: Math.max(0, rested.stam), hp: Math.max(1, rested.hp),
    };
  }

  // -----------------------------------------------------------------------
  // PvP queue
  // -----------------------------------------------------------------------

  async joinQueue(socket: Socket): Promise<void> {
    const userId = (socket.data as SocketData).userId;
    try {
      const loadout = await this.getLoadout(userId);
      // ถ้ามีคนรออยู่แล้ว (ไม่ใช่ตัวเอง) จับคู่ทันทีเลือกคนที่เรตติ้งใกล้ที่สุด
      const waiting = [...this.queue.entries()].filter(([uid]) => uid !== userId);
      if (waiting.length > 0) {
        waiting.sort((x, y) => Math.abs(x[1].loadout.rating - loadout.rating) - Math.abs(y[1].loadout.rating - loadout.rating));
        const [oppId, opp] = waiting[0];
        this.queue.delete(oppId);
        this.queue.delete(userId);
        this.createPvpBattle(loadout, opp.loadout, socket.id, opp.socketId);
        return;
      }
      this.queue.set(userId, { socketId: socket.id, loadout });
      socket.emit('queue:joined', { size: this.queue.size });
    } catch (e) {
      socket.emit('queue:error', { message: e instanceof Error ? e.message : 'เข้าคิวไม่สำเร็จ' });
    }
  }

  cancelQueue(socket: Socket): void {
    const userId = (socket.data as SocketData).userId;
    this.queue.delete(userId);
    socket.emit('queue:cancelled', {});
  }

  private createPvpBattle(a: Loadout, b: Loadout, aSock: string, bSock: string): void {
    const id = `pvp_${Date.now()}_${this.idCounter++}`;
    const first: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
    const state = createBattle(sideDefFrom(a), sideDefFrom(b), 'pvp', first, (Math.random() * 2 ** 31) | 0);
    const rt: Runtime = {
      id, mode: 'pvp', state,
      a: { userId: a.userId, socketId: null, connected: false },
      b: { userId: b.userId, socketId: null, connected: false },
      floor: 0, monster: null,
      turnTimer: null, turnToken: 0, turnEndsAt: 0,
      started: false, aiRunning: false,
      dcTimers: { a: null, b: null },
      rewardSent: false,
      createdAt: Date.now(),
      pendingAttack: null,
    };
    this.battles.set(id, rt);
    this.io.to(aSock).emit('queue:matched', { battleId: id });
    this.io.to(bSock).emit('queue:matched', { battleId: id });
    // กันเคสจับคู่แล้วไม่เข้าหน้า battle — ยกเลิกถ้าไม่เริ่มใน 90 วิ
    setTimeout(() => {
      const r = this.battles.get(id);
      if (r && !r.started) {
        this.battles.delete(id);
      }
    }, 90_000);
  }

  // -----------------------------------------------------------------------
  // PvE (ดันเจี้ยน)
  // -----------------------------------------------------------------------

  async startPve(socket: Socket, floor: number): Promise<void> {
    const userId = (socket.data as SocketData).userId;
    try {
      const char = await prisma.character.findUnique({ where: { userId } });
      if (!char) throw new AppError('ไม่พบตัวละคร');
      if (floor < 1 || floor > 5) throw new AppError('ชั้นดันเจี้ยนไม่ถูกต้อง');
      if (floor > char.highestFloor + 1) throw new AppError(`ต้องผ่านชั้น ${char.highestFloor} ก่อนจึงจะท้าชั้นนี้ได้`);
      const loadout = await this.getLoadout(userId);
      const monster = monsterForFloor(floor);
      const id = `pve_${Date.now()}_${this.idCounter++}`;
      const first: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
      const state = createBattle(sideDefFrom(loadout), monsterSideDef(monster), 'pve', first, (Math.random() * 2 ** 31) | 0);
      const rt: Runtime = {
        id, mode: 'pve', state,
        a: { userId, socketId: null, connected: false },
        b: { userId: null, socketId: null, connected: true },
        floor, monster,
        turnTimer: null, turnToken: 0, turnEndsAt: 0,
        started: false, aiRunning: false,
        dcTimers: { a: null, b: null },
        rewardSent: false,
        createdAt: Date.now(),
        pendingAttack: null,
      };
      this.battles.set(id, rt);
      socket.emit('pve:started', { battleId: id });
      this.attach(socket, rt, 'a');
    } catch (e) {
      socket.emit('battle:error', { message: e instanceof Error ? e.message : 'เริ่มดันเจี้ยนไม่สำเร็จ' });
    }
  }

  // -----------------------------------------------------------------------
  // ห้อง 1v1 — สร้างห้อง ส่งโค้ดให้เพื่อน เข้าร่วมแล้วสู้กันแบบ real-time
  // -----------------------------------------------------------------------

  private static ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  private genRoomCode(): string {
    let code = '';
    for (let i = 0; i < 5; i++) code += BattleManager.ROOM_ALPHABET[Math.floor(Math.random() * BattleManager.ROOM_ALPHABET.length)];
    return this.rooms.has(code) ? this.genRoomCode() : code;
  }

  private removeRoomsOf(socketId: string): void {
    for (const [code, r] of this.rooms) {
      if (r.hostSocketId === socketId) this.rooms.delete(code);
    }
  }

  async createRoom(socket: Socket): Promise<void> {
    const userId = (socket.data as SocketData).userId;
    try {
      const loadout = await this.getLoadout(userId);
      this.removeRoomsOf(socket.id); // ปิดห้องเก่าของตัวเองก่อน
      const code = this.genRoomCode();
      const createdAt = Date.now();
      this.rooms.set(code, { hostSocketId: socket.id, hostLoadout: loadout, createdAt });
      socket.emit('room:created', { code });
      // ห้องหมดอายุใน 2 นาที
      setTimeout(() => {
        const r = this.rooms.get(code);
        if (r && r.createdAt === createdAt) {
          this.rooms.delete(code);
          this.io.to(r.hostSocketId).emit('room:expired', { code });
        }
      }, 120_000);
    } catch (e) {
      socket.emit('room:error', { message: e instanceof Error ? e.message : 'สร้างห้องไม่สำเร็จ' });
    }
  }

  cancelRoom(socket: Socket): void {
    this.removeRoomsOf(socket.id);
    socket.emit('room:cancelled', {});
  }

  async joinRoom(socket: Socket, rawCode: string): Promise<void> {
    const userId = (socket.data as SocketData).userId;
    const code = (rawCode ?? '').trim().toUpperCase();
    try {
      const room = this.rooms.get(code);
      if (!room) throw new AppError('ไม่พบห้องนี้ — เช็คโค้ดกับเพื่อนอีกครั้ง (ห้องอยู่ได้ 2 นาที)');
      if (room.hostSocketId === socket.id) throw new AppError('นี่คือห้องของคุณเอง — รอเพื่อนใส่โค้ด');
      const loadout = await this.getLoadout(userId);
      this.rooms.delete(code);
      this.createPvpBattle(room.hostLoadout, loadout, room.hostSocketId, socket.id);
    } catch (e) {
      socket.emit('room:error', { message: e instanceof Error ? e.message : 'เข้าร่วมห้องไม่สำเร็จ' });
    }
  }

  // -----------------------------------------------------------------------
  // Challenge — ท้าประลองเดคของผู้เล่นคนอื่น (AI คุมฝ่ายตั้งรับ แบบดันเจี้ยน)
  // ไม่คิด Elo/wins/losses เพราะอีกฝ่ายไม่ได้เล่นเอง — ได้แค่ทอง+XP
  // -----------------------------------------------------------------------

  async startChallenge(socket: Socket, opponentUserId: number): Promise<void> {
    const userId = (socket.data as SocketData).userId;
    try {
      const loadout = await this.getLoadout(userId);
      let opponentId = opponentUserId;
      if (!opponentId || opponentId === userId) {
        // หาคู่อัตโนมัติ — ผู้เล่นที่มีเดคพร้อมสู้ เรตติ้งใกล้เราที่สุด (ไม่ต้องออนไลน์)
        const rows = await prisma.character.findMany({ take: 80 });
        const deckCounts = await prisma.cardInstance.groupBy({ by: ['ownerId'], where: { status: 'IN_DECK' }, _count: { _all: true } });
        const deckMap = new Map(deckCounts.map((d) => [d.ownerId, d._count._all]));
        const pool = rows.filter((c) => c.userId !== userId && (deckMap.get(c.userId) ?? 0) >= DECK_MIN);
        if (pool.length === 0) throw new AppError('ยังไม่มีผู้เล่นอื่นที่มีเดคพร้อมสู้ — ชวนเพื่อนมาเล่นก่อน');
        pool.sort((x, y) => Math.abs(x.rating - loadout.rating) - Math.abs(y.rating - loadout.rating));
        opponentId = pool[Math.floor(Math.random() * Math.min(3, pool.length))].userId; // สุ่มจาก 3 อันดับใกล้สุด
      }
      const opponent = await this.getLoadout(opponentId);
      const id = `cha_${Date.now()}_${this.idCounter++}`;
      const first: 'a' | 'b' = Math.random() < 0.5 ? 'a' : 'b';
      const state = createBattle(sideDefFrom(loadout), sideDefFrom(opponent), 'challenge', first, (Math.random() * 2 ** 31) | 0);
      const rt: Runtime = {
        id, mode: 'challenge', state,
        a: { userId, socketId: null, connected: false },
        b: { userId: opponentUserId, socketId: null, connected: true },
        floor: 0, monster: null,
        turnTimer: null, turnToken: 0, turnEndsAt: 0,
        started: false, aiRunning: false,
        dcTimers: { a: null, b: null },
        rewardSent: false,
        createdAt: Date.now(),
        pendingAttack: null,
      };
      this.battles.set(id, rt);
      socket.emit('challenge:started', { battleId: id });
      this.attach(socket, rt, 'a');
    } catch (e) {
      socket.emit('battle:error', { message: e instanceof Error ? e.message : 'ท้าประลองไม่สำเร็จ' });
    }
  }

  // -----------------------------------------------------------------------
  // join / attach
  // -----------------------------------------------------------------------

  joinBattle(socket: Socket, battleId: string): void {
    const userId = (socket.data as SocketData).userId;
    const rt = this.battles.get(battleId);
    if (!rt) {
      socket.emit('battle:error', { message: 'ไม่พบการต่อสู้นี้ (อาจจบไปแล้ว)' });
      return;
    }
    let side: 'a' | 'b' | null = null;
    if (rt.a.userId === userId) side = 'a';
    else if (rt.b.userId === userId) side = 'b';
    if (!side) {
      socket.emit('battle:error', { message: 'คุณไม่ได้อยู่ในการต่อสู้นี้' });
      return;
    }
    this.attach(socket, rt, side);
  }

  private attach(socket: Socket, rt: Runtime, side: 'a' | 'b'): void {
    const slot = side === 'a' ? rt.a : rt.b;
    slot.socketId = socket.id;
    slot.connected = true;
    // ยกเลิกตัวจับเวลายอมแพ้จากการหลุด
    const dcKey = side as 'a' | 'b';
    if (rt.dcTimers[dcKey]) {
      clearTimeout(rt.dcTimers[dcKey]!);
      rt.dcTimers[dcKey] = null;
    }
    this.socketBattle.set(socket.id, { battleId: rt.id, side });
    // PvP เริ่มจับเวลาเมื่อทั้งสองฝ่ายเข้าหน้า battle แล้ว / PvE เริ่มทันที
    // (ตั้ง started ก่อน broadcast ไม่งั้น client จะเห็น started=false ค้าง)
    const bothIn = rt.a.socketId != null && (rt.mode !== 'pvp' || rt.b.socketId != null);
    const justStarted = bothIn && !rt.started;
    if (justStarted) rt.started = true;
    this.broadcast(rt);
    if (justStarted) {
      this.armTurnTimer(rt);
      this.postTurn(rt);
    }
  }

  // -----------------------------------------------------------------------
  // action จากผู้เล่น
  // -----------------------------------------------------------------------

  handleAction(socket: Socket, msg: { battleId: string; type: string; handUid?: string; slotIndex?: number; choice?: string }): void {
    const userId = (socket.data as SocketData).userId;
    const rt = this.battles.get(msg.battleId);
    if (!rt) {
      socket.emit('battle:error', { message: 'ไม่พบการต่อสู้นี้' });
      return;
    }
    let side: 'a' | 'b' | null = null;
    if (rt.a.userId === userId) side = 'a';
    else if (rt.b.userId === userId) side = 'b';
    if (!side) return;
    const slot = side === 'a' ? rt.a : rt.b;
    slot.socketId = socket.id;

    if (msg.type === 'surrender') {
      if (!isFinished(rt.state)) {
        rt.state.phase = 'finished';
        rt.state.winner = side === 'a' ? 'b' : 'a';
        rt.state.endReason = 'ยอมจำนน';
      }
      this.broadcast(rt);
      this.finishBattle(rt);
      return;
    }

    if (isFinished(rt.state)) {
      socket.emit('battle:error', { message: 'การต่อสู้จบแล้ว' });
      return;
    }
    if (!rt.started) {
      socket.emit('battle:error', { message: 'รออีกฝ่ายเข้าสนามก่อน' });
      return;
    }
    const notMyTurn = rt.state.active !== side;
    if (notMyTurn && msg.type !== 'defenseRespond') {
      // ช่วงเทิร์นศัตรู: อนุญาตเฉพาะ "เล่น/เปิดสกิลป้องกันโล่" (ตั้งรับ) — endTurn/place และการ์ดอื่นยังต้องรอเทิร์นตัวเอง
      if (msg.type === 'play' && msg.handUid) {
        const hand = (side === 'a' ? rt.state.a : rt.state.b).hand.find((h) => h.uid === msg.handUid);
        if (!hand?.templateId || !isReactionCard(cardById(hand.templateId))) {
          socket.emit('battle:error', { message: 'ช่วงเทิร์นศัตรูใช้ได้เฉพาะสกิลป้องกัน (โล่) เท่านั้น' });
          return;
        }
      } else if (msg.type === 'open' && msg.slotIndex != null) {
        const sc = (side === 'a' ? rt.state.a : rt.state.b).slots[msg.slotIndex];
        if (!sc?.templateId || !isReactionCard(cardById(sc.templateId))) {
          socket.emit('battle:error', { message: 'ช่วงเทิร์นศัตรูเปิดได้เฉพาะการ์ดป้องกัน (โล่)' });
          return;
        }
      } else {
        socket.emit('battle:error', { message: 'ยังไม่ใช่เทิร์นของคุณ (ช่วงนี้ใช้ได้เฉพาะสกิลป้องกันโล่จากมือหรือการ์ดหมอบ)' });
        return;
      }
    }

    if (msg.type === 'play' && msg.handUid) {
      if (this.tryDefensePrompt(rt, side, msg.handUid, socket)) return;
      const playedTid = this.handTemplateId(rt, side, msg.handUid);
      const result = playCard(rt.state, side, msg.handUid);
      if (!result.ok) {
        socket.emit('battle:error', { message: result.reason });
        return;
      }
      this.emitPlayedCard(rt, playedTid, side);
      this.broadcast(rt);
      if (isFinished(rt.state)) this.finishBattle(rt);
    } else if (msg.type === 'defenseRespond') {
      this.handleDefenseRespond(socket, msg);
    } else if (msg.type === 'endTurn') {
      endTurn(rt.state);
      this.broadcast(rt);
      this.armTurnTimer(rt);
      if (isFinished(rt.state)) {
        this.finishBattle(rt);
        return;
      }
      this.postTurn(rt);
    } else if (msg.type === 'place' && msg.handUid != null) {
      const result = placeCardToSlot(rt.state, side, msg.handUid, msg.slotIndex);
      if (!result.ok) {
        socket.emit('battle:error', { message: result.reason });
        return;
      }
      this.broadcast(rt);
    } else if (msg.type === 'open' && msg.slotIndex != null) {
      const result = openSlotCard(rt.state, side, msg.slotIndex);
      if (!result.ok) {
        socket.emit('battle:error', { message: result.reason });
        return;
      }
      this.broadcast(rt);
      if (isFinished(rt.state)) this.finishBattle(rt);
    } else if (msg.type === 'reuseDeck') {
      const result = reuseDeck(rt.state, side);
      if (!result.ok) {
        socket.emit('battle:error', { message: result.reason });
        return;
      }
      this.broadcast(rt);
    }
  }

  // -----------------------------------------------------------------------
  // turn timer + AI
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Defense Prompt — หยุดการโจมตีเพื่อถามฝ่ายตั้งรับ
  // -----------------------------------------------------------------------

  /** ตรวจว่าการ์ดที่จะเล่นเป็นโจมตี + ฝ่ายตั้งรับมีโล่ → ส่ง prompt แล้ว return true (หยุดการเล่นชั่วคราว) */
  private tryDefensePrompt(rt: Runtime, attacker: 'a' | 'b', handUid: string, socket: Socket): boolean {
    if (rt.pendingAttack) return true; // มี pending อยู่แล้ว — บล็อก action ชั่วคราว
    const s = attacker === 'a' ? rt.state.a : rt.state.b;
    const hc = s.hand.find((h) => h.uid === handUid);
    if (!hc?.templateId) return false;
    const t = cardById(hc.templateId);
    const isAttack = t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic');
    if (!isAttack) return false;

    const defender: 'a' | 'b' = attacker === 'a' ? 'b' : 'a';
    const dSide = defender === 'a' ? rt.state.a : rt.state.b;
    const dSlot = defender === 'a' ? rt.a : rt.b;

    // PvE/Challenge: ฝ่าย b เป็น AI ไม่ถาม (AI ไม่ใช้โล่แบบ interactive)
    if (rt.mode !== 'pvp' && defender === 'b') return false;
    if (!dSlot.socketId || !dSlot.connected) return false;

    // หาการ์ดโล่ที่ใช้ได้ (ในมือ + ในช่อง)
    const handShields = dSide.hand.filter((h) => {
      if (!h.templateId) return false;
      const ht = cardById(h.templateId);
      return isReactionCard(ht);
    }).map((h) => ({ uid: h.uid, templateId: h.templateId!, source: 'hand' as const }));

    const slotShields = dSide.slots
      .map((sc, idx) => {
        if (!sc?.templateId) return null;
        const st = cardById(sc.templateId);
        if (!isReactionCard(st)) return null;
        return { uid: sc.uid, templateId: sc.templateId, source: 'slot' as const, slotIndex: idx };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (handShields.length === 0 && slotShields.length === 0) return false;

    // หยุดเทิร์นไทเมอร์ชั่วคราว
    if (rt.turnTimer) clearTimeout(rt.turnTimer);
    rt.turnToken += 1; // invalidate existing timer

    const timeout = setTimeout(() => {
      this.resolvePendingAttack(rt, 'skip');
    }, 12_000);

    rt.pendingAttack = { attacker, handUid, defenderSocketId: dSlot.socketId, timeout };

    this.io.to(dSlot.socketId).emit('defense:prompt', {
      battleId: rt.id,
      handShields,
      slotShields,
      timeoutMs: 12_000,
    });

    // แจ้งฝ่ายโจมตีว่ากำลังรอการตัดสินใจ
    if (socket.id !== dSlot.socketId) {
      socket.emit('defense:waiting', { battleId: rt.id });
    }
    return true;
  }

  /** AI โจมตี → ตรวจว่าผู้เล่นมีโล่ → ถ้ามีส่ง defense prompt (ไม่มี attacker socket) */
  private tryAiDefensePrompt(rt: Runtime, attacker: 'a' | 'b', handUid: string): boolean {
    if (rt.pendingAttack) return true;
    const s = attacker === 'a' ? rt.state.a : rt.state.b;
    const hc = s.hand.find((h) => h.uid === handUid);
    if (!hc?.templateId) return false;
    const t = cardById(hc.templateId);
    const isAttack = t.group === 'skill' && (t.skill?.kind === 'physical' || t.skill?.kind === 'magic');
    if (!isAttack) return false;

    const defender: 'a' | 'b' = attacker === 'a' ? 'b' : 'a';
    const dSide = defender === 'a' ? rt.state.a : rt.state.b;
    const dSlot = defender === 'a' ? rt.a : rt.b;

    // AI ไม่มี socket — ผู้เล่นต้องเป็น defender เท่านั้น
    if (!dSlot.socketId || !dSlot.connected) return false;

    const handShields = dSide.hand.filter((h) => {
      if (!h.templateId) return false;
      return isReactionCard(cardById(h.templateId));
    }).map((h) => ({ uid: h.uid, templateId: h.templateId!, source: 'hand' as const }));

    const slotShields = dSide.slots
      .map((sc, idx) => {
        if (!sc?.templateId) return null;
        if (!isReactionCard(cardById(sc.templateId))) return null;
        return { uid: sc.uid, templateId: sc.templateId, source: 'slot' as const, slotIndex: idx };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (handShields.length === 0 && slotShields.length === 0) return false;

    if (rt.turnTimer) clearTimeout(rt.turnTimer);
    rt.turnToken += 1;

    const timeout = setTimeout(() => {
      this.resolvePendingAttack(rt, 'skip');
    }, 12_000);

    rt.pendingAttack = { attacker, handUid, defenderSocketId: dSlot.socketId, timeout };

    this.io.to(dSlot.socketId).emit('defense:prompt', {
      battleId: rt.id,
      handShields,
      slotShields,
      timeoutMs: 12_000,
    });

    return true;
  }

  private handleDefenseRespond(socket: Socket, msg: { battleId?: string; type?: string; choice?: string; handUid?: string; slotIndex?: number }): void {
    const rt = this.battles.get(msg.battleId ?? '');
    if (!rt || !rt.pendingAttack) return;
    if (socket.id !== rt.pendingAttack.defenderSocketId) return;

    const choice = msg.choice ?? 'skip';
    if (choice === 'skip') {
      this.resolvePendingAttack(rt, 'skip');
    } else if (choice === 'useHand' && msg.handUid) {
      // เล่นโล่จากมือก่อน แล้วค่อยให้โจมตีไป
      const defender = rt.pendingAttack.attacker === 'a' ? 'b' : 'a';
      playCard(rt.state, defender, msg.handUid);
      this.broadcast(rt);
      this.resolvePendingAttack(rt, 'proceed');
    } else if (choice === 'useSlot' && msg.slotIndex != null) {
      const defender = rt.pendingAttack.attacker === 'a' ? 'b' : 'a';
      openSlotCard(rt.state, defender, msg.slotIndex);
      this.broadcast(rt);
      this.resolvePendingAttack(rt, 'proceed');
    }
  }

  private resolvePendingAttack(rt: Runtime, mode: 'skip' | 'proceed'): void {
    const pa = rt.pendingAttack;
    if (!pa) return;
    clearTimeout(pa.timeout);
    rt.pendingAttack = null;

    // แจ้งทั้งสองฝ่ายว่า prompt จบแล้ว
    const defenderSlot = pa.attacker === 'a' ? rt.b : rt.a;
    if (defenderSlot.socketId) {
      this.io.to(defenderSlot.socketId).emit('defense:resolved', { battleId: rt.id });
    }
    const attackerSlot = pa.attacker === 'a' ? rt.a : rt.b;
    if (attackerSlot.socketId) {
      this.io.to(attackerSlot.socketId).emit('defense:resolved', { battleId: rt.id });
    }

    if (mode === 'proceed') {
      // โล่ถูกเล่นแล้ว — ตอนนี้ execute การโจมตี
      const atkTid = this.handTemplateId(rt, pa.attacker, pa.handUid);
      playCard(rt.state, pa.attacker, pa.handUid);
      this.emitPlayedCard(rt, atkTid, pa.attacker);
      this.broadcast(rt);
      if (isFinished(rt.state)) {
        this.finishBattle(rt);
        return;
      }
    } else {
      const atkTid = this.handTemplateId(rt, pa.attacker, pa.handUid);
      playCard(rt.state, pa.attacker, pa.handUid);
      this.emitPlayedCard(rt, atkTid, pa.attacker);
      this.broadcast(rt);
      if (isFinished(rt.state)) {
        this.finishBattle(rt);
        return;
      }
    }

    // รีสตาร์ทเทิร์นไทเมอร์
    this.armTurnTimer(rt);
    this.postTurn(rt);
  }

  private isAiControlled(rt: Runtime, side: 'a' | 'b'): boolean {
    if (isFinished(rt.state)) return false;
    if (rt.mode !== 'pvp') return side === 'b';
    const slot = side === 'a' ? rt.a : rt.b;
    return !slot.connected;
  }

  private armTurnTimer(rt: Runtime): void {
    if (rt.turnTimer) clearTimeout(rt.turnTimer);
    const token = ++rt.turnToken;
    rt.turnEndsAt = Date.now() + PVP_TURN_MS;
    rt.turnTimer = setTimeout(() => {
      if (rt.turnToken !== token || isFinished(rt.state)) return;
      endTurn(rt.state);
      this.broadcast(rt);
      if (isFinished(rt.state)) {
        this.finishBattle(rt);
        return;
      }
      this.armTurnTimer(rt);
      this.postTurn(rt);
    }, PVP_TURN_MS);
  }

  private postTurn(rt: Runtime): void {
    if (isFinished(rt.state)) {
      this.finishBattle(rt);
      return;
    }
    if (this.isAiControlled(rt, rt.state.active)) {
      this.runAi(rt);
    }
  }

  private runAi(rt: Runtime): void {
    if (rt.aiRunning) return;
    rt.aiRunning = true;
    const step = (): void => {
      if (isFinished(rt.state)) {
        rt.aiRunning = false;
        this.broadcast(rt);
        this.finishBattle(rt);
        return;
      }
      const side = rt.state.active;
      if (!this.isAiControlled(rt, side)) {
        rt.aiRunning = false;
        return;
      }
      const action = aiPickAction(rt.state, side);
      if (action.type === 'endTurn') {
        endTurn(rt.state);
        this.broadcast(rt);
        this.armTurnTimer(rt);
        rt.aiRunning = false;
        this.postTurn(rt);
        return;
      }
      // AI รีไซเคิลการ์ด — นำการ์ดที่ใช้แล้วกลับเข้าเดค
      if (action.type === 'reuseDeck') {
        const result = reuseDeck(rt.state, side);
        if (result.ok) {
          this.broadcast(rt);
        }
        // รีไซเคิลแล้ว (หรือทำไม่ได้) → ไป step ถัดไป
        setTimeout(step, 600);
        return;
      }
      // ตรวจ defense prompt ก่อน AI เล่นการ์ดโจมตี — ถ้าผู้เล่นมีโล่ หยุดเพื่อถาม
      if (this.tryAiDefensePrompt(rt, side, action.handUid)) {
        rt.aiRunning = false; // หยุด AI loop — resolvePendingAttack จะเล่นการ์ดแล้วเรียก postTurn รีสตาร์ท
        return;
      }
      const aiTid = this.handTemplateId(rt, side, action.handUid);
      playCard(rt.state, side, action.handUid);
      this.emitPlayedCard(rt, aiTid, side);
      this.broadcast(rt);
      if (isFinished(rt.state)) {
        rt.aiRunning = false;
        this.finishBattle(rt);
        return;
      }
      setTimeout(step, 900);
    };
    setTimeout(step, 900);
  }

  // -----------------------------------------------------------------------
  // broadcast
  // -----------------------------------------------------------------------

  /** ส่งการ์ดที่เพิ่งเล่นไปแสดงบนจอใหญ่ + countdown */
  private emitPlayedCard(rt: Runtime, templateId: string, by: 'a' | 'b'): void {
    if (!templateId) return;
    const msg = { battleId: rt.id, templateId, by };
    if (rt.a.socketId) this.io.to(rt.a.socketId).emit('battle:playedCard', msg);
    if (rt.b.socketId) this.io.to(rt.b.socketId).emit('battle:playedCard', msg);
  }

  /** ดึง templateId จากมือก่อนเล่น */
  private handTemplateId(rt: Runtime, side: 'a' | 'b', handUid: string): string {
    const s = side === 'a' ? rt.state.a : rt.state.b;
    const hc = s.hand.find((h) => h.uid === handUid);
    return hc?.templateId ?? '';
  }

  private broadcast(rt: Runtime): void {
    if (rt.a.socketId) {
      this.io.to(rt.a.socketId).emit('battle:state', {
        battleId: rt.id,
        you: 'a',
        state: sanitizeState(rt.state, 'a'),
        turnEndsAt: rt.turnEndsAt,
        started: rt.started,
      });
    }
    if (rt.b.socketId) {
      this.io.to(rt.b.socketId).emit('battle:state', {
        battleId: rt.id,
        you: 'b',
        state: sanitizeState(rt.state, 'b'),
        turnEndsAt: rt.turnEndsAt,
        started: rt.started,
      });
    }
  }

  // -----------------------------------------------------------------------
  // จบเกม + รางวัล
  // -----------------------------------------------------------------------

  private async finishBattle(rt: Runtime): Promise<void> {
    if (rt.rewardSent) return;
    rt.rewardSent = true;
    if (rt.turnTimer) clearTimeout(rt.turnTimer);
    rt.dcTimers.a && clearTimeout(rt.dcTimers.a);
    rt.dcTimers.b && clearTimeout(rt.dcTimers.b);

    // hp/มานา/กำลังที่เหลือตอนจบสนาม ติดตัวกลับออกไป — เริ่มนับการฟื้นนอกสนาม (1/ชม.) จากตอนนี้
    // (hp ต่ำสุด 1 เพื่อไม่ให้ติดสถานะ 0 นอกสนาม)
    const now = new Date();
    if (rt.a.userId) {
      await prisma.character.updateMany({
        where: { userId: rt.a.userId },
        data: { hp: Math.max(1, Math.floor(rt.state.a.hp)), mana: Math.max(0, Math.floor(rt.state.a.mana)), stam: Math.max(0, Math.floor(rt.state.a.stam)), regenAt: now },
      });
    }
    // challenge: อีกฝ่ายเป็น AI — ห้ามเขียน hp/มานาของเจ้าของเดคจริง
    if (rt.b.userId && rt.mode !== 'challenge') {
      await prisma.character.updateMany({
        where: { userId: rt.b.userId },
        data: { hp: Math.max(1, Math.floor(rt.state.b.hp)), mana: Math.max(0, Math.floor(rt.state.b.mana)), stam: Math.max(0, Math.floor(rt.state.b.stam)), regenAt: now },
      });
    }

    const winner = rt.state.winner;
    try {
      if (rt.mode === 'pve') {
        await this.settlePve(rt, winner === 'a');
      } else if (rt.mode === 'challenge') {
        await this.settleChallenge(rt, winner === 'a');
      } else if (winner) {
        await this.settlePvp(rt, winner);
      }
    } catch (e) {
      console.error('finishBattle error', e);
    }

    // ส่งผลให้ทุกฝ่ายที่ยังต่ออยู่
    const over: Record<string, unknown> = {
      battleId: rt.id,
      winner,
      reason: rt.state.endReason,
    };
    if (rt.a.socketId) this.io.to(rt.a.socketId).emit('battle:over', { ...over, youWon: winner === 'a' });
    if (rt.b.socketId) this.io.to(rt.b.socketId).emit('battle:over', { ...over, youWon: winner === 'b' });

    this.broadcast(rt);
    setTimeout(() => this.battles.delete(rt.id), 15_000);
  }

  private async settlePve(rt: Runtime, playerWon: boolean): Promise<void> {
    const userId = rt.a.userId;
    if (!userId || !rt.monster) return;
    const char = await prisma.character.findUnique({ where: { userId } });
    if (!char) return;

    let gold = 0;
    let xp = 0;
    const droppedCards: string[] = [];
    if (playerWon) {
      const m = rt.monster;
      gold = m.goldMin + Math.floor(Math.random() * (m.goldMax - m.goldMin + 1));
      xp = m.xp;
      for (const drop of m.drops) {
        if (Math.random() < drop.chance) droppedCards.push(drop.templateId);
      }
      await prisma.character.update({ where: { id: char.id }, data: { highestFloor: Math.max(char.highestFloor, rt.floor) } });
      await onQuestEvent(userId, 'CLEAR_FLOOR', 1, { floor: rt.floor });
    } else {
      xp = Math.floor(rt.monster.xp * 0.25);
    }

    await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + gold } });
    await recordLedger({ type: 'DUNGEON_REWARD', userId, gold, meta: { floor: rt.floor, won: playerWon, drops: droppedCards } });
    for (const templateId of droppedCards) {
      await mintCard(templateId, userId, 'DUNGEON_REWARD', { floor: rt.floor });
    }
    await grantXp(char, xp);

    const refreshed = await prisma.character.findUnique({ where: { userId } });
    if (refreshed && rt.a.socketId) {
      this.io.to(rt.a.socketId).emit('battle:rewards', {
        gold, xp, cards: droppedCards, character: await buildMeCharacter(refreshed),
      });
    }
  }

  /** ท้าประลองเดคผู้เล่น (AI คุมแทน) — ผู้ท้าได้ทอง+XP ตามผล ไม่กระทบ Elo/สถิติของอีกฝ่าย */
  private async settleChallenge(rt: Runtime, playerWon: boolean): Promise<void> {
    const userId = rt.a.userId;
    if (!userId) return;
    const char = await prisma.character.findUnique({ where: { userId } });
    if (!char) return;
    const gold = playerWon ? 25 : 5;
    const xp = playerWon ? 30 + char.level * 3 : 10;
    await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold + gold } });
    await recordLedger({ type: 'PVP_REWARD', userId, gold, meta: { challenge: true, opponent: rt.b.userId ?? 0, won: playerWon } });
    await grantXp(char, xp);
    const refreshed = await prisma.character.findUnique({ where: { userId } });
    if (refreshed && rt.a.socketId) {
      this.io.to(rt.a.socketId).emit('battle:rewards', {
        gold, xp, cards: [], character: await buildMeCharacter(refreshed),
      });
    }
  }

  private async settlePvp(rt: Runtime, winner: 'a' | 'b'): Promise<void> {
    const loser: 'a' | 'b' = winner === 'a' ? 'b' : 'a';
    const winnerId = (winner === 'a' ? rt.a : rt.b).userId;
    const loserId = (winner === 'a' ? rt.b : rt.a).userId;
    if (!winnerId || !loserId) return;
    const winnerChar = await prisma.character.findUnique({ where: { userId: winnerId } });
    const loserChar = await prisma.character.findUnique({ where: { userId: loserId } });
    if (!winnerChar || !loserChar) return;

    // Elo
    const ea = 1 / (1 + 10 ** ((loserChar.rating - winnerChar.rating) / 400));
    const delta = Math.round(ELO_K * (1 - ea));
    const newWinnerRating = Math.max(100, winnerChar.rating + delta);
    const newLoserRating = Math.max(100, loserChar.rating - delta);

    const winnerGold = 40;
    const loserGold = 10;
    const winnerXp = 40 + winnerChar.level * 5;
    const loserXp = 15;

    await prisma.$transaction([
      prisma.character.update({
        where: { id: winnerChar.id },
        data: { rating: newWinnerRating, wins: { increment: 1 }, gold: winnerChar.gold + winnerGold },
      }),
      prisma.character.update({
        where: { id: loserChar.id },
        data: { rating: newLoserRating, losses: { increment: 1 }, gold: loserChar.gold + loserGold },
      }),
      prisma.pvpBattle.create({
        data: { aId: rt.a.userId ?? 0, bId: rt.b.userId ?? 0, winnerId, ratingDelta: delta },
      }),
    ]);
    await recordLedger({ type: 'PVP_REWARD', userId: winnerId, gold: winnerGold, meta: { rating: newWinnerRating, delta } });
    await recordLedger({ type: 'PVP_REWARD', userId: loserId, gold: loserGold, meta: { rating: newLoserRating, delta: -delta } });
    await grantXp(winnerChar, winnerXp);
    await grantXp(loserChar, loserXp);
    await onQuestEvent(winnerId, 'WIN_PVP', 1);

    const send = async (userId: number, slot: SideSlot): Promise<void> => {
      if (!slot.socketId) return;
      const c = await prisma.character.findUnique({ where: { userId } });
      if (!c) return;
      this.io.to(slot.socketId).emit('battle:rewards', {
        gold: userId === winnerId ? winnerGold : loserGold,
        xp: userId === winnerId ? winnerXp : loserXp,
        cards: [],
        ratingDelta: userId === winnerId ? delta : -delta,
        newRating: c.rating,
        character: await buildMeCharacter(c),
      });
    };
    await send(winnerId, winner === 'a' ? rt.a : rt.b);
    await send(loserId, winner === 'a' ? rt.b : rt.a);
  }

  // -----------------------------------------------------------------------
  // disconnect
  // -----------------------------------------------------------------------

  handleDisconnect(socket: Socket): void {
    this.queue.delete((socket.data as SocketData).userId);
    this.removeRoomsOf(socket.id);
    const entry = this.socketBattle.get(socket.id);
    this.socketBattle.delete(socket.id);
    if (!entry) return;
    const rt = this.battles.get(entry.battleId);
    if (!rt) return;
    const slot = entry.side === 'a' ? rt.a : rt.b;
    if (slot.socketId === socket.id) {
      slot.socketId = null;
      slot.connected = false;
    }
    if (isFinished(rt.state)) return;

    // อีกฝ่ายได้รับแจ้ง + ถ้าหลุดนาน 30 วิ ถือว่ายอมแพ้
    const otherSide: 'a' | 'b' = entry.side === 'a' ? 'b' : 'a';
    const otherSlot = otherSide === 'a' ? rt.a : rt.b;
    if (otherSlot.socketId && rt.mode === 'pvp') {
      this.io.to(otherSlot.socketId).emit('battle:opponent_dc', {});
    }
    rt.dcTimers[entry.side] = setTimeout(() => {
      const r = this.battles.get(rt.id);
      if (!r || isFinished(r.state)) return;
      const s = entry.side === 'a' ? r.a : r.b;
      if (!s.connected) {
        r.state.phase = 'finished';
        r.state.winner = otherSide;
        r.state.endReason = 'ผู้เล่นหลุดการเชื่อมต่อ';
        this.broadcast(r);
        this.finishBattle(r);
      }
    }, 30_000);
    // ถ้าถึงเทิร์นฝ่ายที่หลุดแล้ว ให้ AI รุดต่อชั่วคราว
    this.postTurn(rt);
  }
}

export const battleManager = new BattleManager();
