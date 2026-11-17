import { FastifyInstance } from 'fastify';
import {
  cardById, CraftKey, DECK_MIN, GatherZone, GOLD_START, MONSTERS, STARTER_EQUIP, STARTER_TOOLS, STARTER_TEMPLATE_IDS,
} from '@cardwar/shared';
import { prisma } from './db';
import { AppError } from './errors';
import {
  authenticate, DEV_LOGIN_ENABLED, findOrCreateUser, GOOGLE_CLIENT_ID, reqUser, signToken, verifyGoogleCredential,
} from './auth';
import {
  allocateStatPoint, buildMeCharacter, requireCharacter, syncEnergy,
} from './services/characters';
import {
  addToDeck, applyRepairTool, destroyCard, equipCard, mintCard, payRepairTool, removeFromDeck, repairTool, sellToSystem, unequipCard, useOutOfBattle,
} from './services/inventory';
import { buyListing, gachaPull, listShop, listIap, purchaseIap } from './services/shop';
import { gatherReward, gatherStart } from './services/gathering';
import { craftAlchemy, craftBrew, craftCook, craftEquipment } from './services/craft';
import { ensureQuests, questView } from './services/quests';
import { recordLedger } from './services/ledger';
import { registerPhase2Routes } from './routes-phase2';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerPhase2Routes(app);
  // ------------------------------------------------------------------ auth
  app.get('/api/health', async () => ({ ok: true }));

  app.get('/api/auth/config', async () => ({
    googleClientId: GOOGLE_CLIENT_ID || null,
    devLogin: DEV_LOGIN_ENABLED,
  }));

  app.post('/api/auth/google', async (req, reply) => {
    const { credential } = (req.body ?? {}) as { credential?: string };
    if (!credential) throw new AppError('ไม่ได้ส่ง credential');
    if (!GOOGLE_CLIENT_ID) throw new AppError('เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID');
    const profile = await verifyGoogleCredential(credential);
    const user = await findOrCreateUser(profile);
    return { token: signToken(app, user.id), user: { id: user.id, name: user.name, avatar: user.avatar } };
  });

  app.post('/api/auth/dev', async (req) => {
    if (!DEV_LOGIN_ENABLED) throw new AppError('dev-login ใช้ได้เฉพาะตอนไม่ตั้ง GOOGLE_CLIENT_ID', 403);
    const { name } = (req.body ?? {}) as { name?: string };
    const clean = (name ?? '').trim().slice(0, 24);
    if (clean.length < 2) throw new AppError('กรุณาใส่ชื่ออย่างน้อย 2 ตัวอักษร');
    const user = await findOrCreateUser({ googleId: `dev:${clean}`, email: null, name: clean, avatar: null });
    return { token: signToken(app, user.id), user: { id: user.id, name: user.name, avatar: user.avatar } };
  });

  // ------------------------------------------------------------------ me
  app.get('/api/me', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const character = await prisma.character.findUnique({ where: { userId: user.id } });
    const quests = character ? (await ensureQuests(user.id, character.highestFloor)).map(questView) : [];
    return {
      user: { id: user.id, name: user.name, avatar: user.avatar, isAdmin: user.isAdmin },
      character: character ? await buildMeCharacter(character) : null,
      quests,
    };
  });

  // ------------------------------------------------------- สร้างตัวละคร
  app.post('/api/character', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const existing = await prisma.character.findUnique({ where: { userId: user.id } });
    if (existing) throw new AppError('คุณมีตัวละครอยู่แล้ว');
    const { name } = (req.body ?? {}) as { name?: string };
    const clean = (name ?? '').trim().slice(0, 20);
    if (clean.length < 2) throw new AppError('ชื่อตัวละครต้องยาว 2-20 ตัวอักษร');
    const nameTaken = await prisma.character.findFirst({ where: { name: clean } });
    if (nameTaken) throw new AppError('ชื่อตัวละครนี้ถูกใช้แล้ว (ชื่อต้องไม่ซ้ำเพื่อใช้ในระบบเพื่อน/ตลาด)');

    const char = await prisma.character.create({
      data: { userId: user.id, name: clean, gold: GOLD_START },
    });
    await recordLedger({ type: 'CHARACTER_CREATE', userId: user.id, gold: GOLD_START, meta: {} });

    // เดคเริ่มต้น 20 ใบ (สถานะ IN_DECK ทันที)
    for (const templateId of STARTER_TEMPLATE_IDS) {
      const inst = await mintCard(templateId, user.id, 'CHARACTER_CREATE', { kit: 'starter-deck' });
      await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'IN_DECK' } });
    }
    // อุปกรณ์เริ่มต้น (สวมใส่ทันที)
    for (const templateId of STARTER_EQUIP) {
      const inst = await mintCard(templateId, user.id, 'CHARACTER_CREATE', { kit: 'starter-equip' });
      await prisma.cardInstance.update({ where: { id: inst.id }, data: { status: 'EQUIPPED', slot: cardById(templateId).category } });
    }
    // เครื่องมือเริ่มต้น
    for (const templateId of STARTER_TOOLS) {
      await mintCard(templateId, user.id, 'CHARACTER_CREATE', { kit: 'starter-tools' });
    }

    return { character: await buildMeCharacter(char) };
  });

  // ------------------------------------------------------------------ คลังการ์ด
  app.get('/api/inventory', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const instances = await prisma.cardInstance.findMany({
      where: { ownerId: user.id, status: { in: ['INVENTORY', 'IN_DECK', 'EQUIPPED', 'SHOP'] } },
      orderBy: [{ status: 'asc' }, { id: 'desc' }],
    });
    return {
      cards: instances.map((i) => ({
        id: i.id,
        templateId: i.templateId,
        card: cardById(i.templateId),
        status: i.status,
        slot: i.slot,
        durability: i.durability,
      })),
    };
  });

  app.post('/api/cards/:serial/action', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const serial = Number((req.params as { serial: string }).serial);
    if (!Number.isFinite(serial)) throw new AppError('รหัสการ์ดไม่ถูกต้อง');
    const { action, hits } = (req.body ?? {}) as { action?: string; hits?: number };
    const char = await requireCharacter(user.id);

    let message = '';
    switch (action) {
      case 'equip':
        await equipCard(user.id, serial);
        message = 'สวมใส่แล้ว';
        break;
      case 'unequip':
        await unequipCard(user.id, serial);
        message = 'ถอดออกแล้ว';
        break;
      case 'addDeck':
        await addToDeck(user.id, serial);
        message = 'ใส่เดคแล้ว';
        break;
      case 'removeDeck':
        await removeFromDeck(user.id, serial);
        message = 'นำออกจากเดคแล้ว';
        break;
      case 'repair': {
        const r = await repairTool(user.id, serial, char, hits);
        message = `ตีซ่อมสำเร็จ +${r.gain} ความทนทาน (−${r.cost} ทอง) เหลือ ${r.durability}`;
        break;
      }
      case 'repairPay': {
        const r = await payRepairTool(user.id, serial, char);
        message = `จ่ายค่าซ่อม ${r.cost} ทองแล้ว — เริ่มตีได้เลย!`;
        break;
      }
      case 'repairApply': {
        const r = await applyRepairTool(user.id, serial, hits ?? 0);
        message = r.gain > 0
          ? `ตีซ่อมสำเร็จ +${r.gain} ความทนทาน (เหลือ ${r.durability})`
          : 'ตีไม่โดนเลย… ค่าซ่อมที่จ่ายไปเสียฟรี ลองใหม่อีกครั้ง';
        break;
      }
      case 'use': {
        const r = await useOutOfBattle(user.id, serial, char);
        message = `กินแล้ว ฟื้นพลังงาน ${r.energyGained} จุด`;
        break;
      }
      case 'sell': {
        const r = await sellToSystem(user.id, serial, char);
        message = `ขายคืนระบบได้ ${r.gold} ทอง (ระบบจะนำไปวางขายต่อ)`;
        break;
      }
      case 'destroy': {
        const r = await destroyCard(user.id, serial, char);
        message = r.refund > 0 ? `ทำลายการ์ดแล้ว ได้ทองคืน ${r.refund}` : 'ทำลายการ์ดแล้ว';
        break;
      }
      default:
        throw new AppError('คำสั่งไม่ถูกต้อง');
    }
    const fresh = await requireCharacter(user.id);
    return { message, character: await buildMeCharacter(fresh) };
  });

  // ------------------------------------------------------------------ ร้านค้า
  app.get('/api/shop/listings', async () => ({ listings: await listShop() }));

  // แพ็กพิเศษ (IAP) — รายการ + ซื้อ (dev: จำลองการชำระเงิน)
  app.get('/api/shop/iap', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { packages: await listIap(user.id) };
  });

  app.post('/api/shop/iap/purchase', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { packageId } = (req.body ?? {}) as { packageId?: string };
    const char = await requireCharacter(user.id);
    const result = await purchaseIap(char, packageId ?? '');
    const fresh = await requireCharacter(user.id);
    return {
      gold: result.gold,
      firstBonus: result.firstBonus,
      cards: result.cards.map((id) => cardById(id)),
      character: await buildMeCharacter(fresh),
    };
  });

  app.post('/api/shop/gacha', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { pulls, hits } = (req.body ?? {}) as { pulls?: number; hits?: number };
    const char = await requireCharacter(user.id);
    const result = await gachaPull(char, pulls ?? 1, hits ?? 0);
    const fresh = await requireCharacter(user.id);
    return {
      cards: result.cards.map((id) => cardById(id)),
      goldSpent: result.goldSpent,
      character: await buildMeCharacter(fresh),
    };
  });

  app.post('/api/shop/buy/:id', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const char = await requireCharacter(user.id);
    const result = await buyListing(char, id);
    const fresh = await requireCharacter(user.id);
    return { card: cardById(result.templateId), character: await buildMeCharacter(fresh) };
  });

  // ------------------------------------------------------------------ เก็บของ
  app.post('/api/gather/start', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { zone, activity } = (req.body ?? {}) as { zone?: GatherZone; activity?: 'wood' | 'harvest' };
    if (zone !== 'mine' && zone !== 'forest') throw new AppError('โซนไม่ถูกต้อง');
    const char = await requireCharacter(user.id);
    const r = await gatherStart(char, zone, activity ?? 'wood');
    const fresh = await requireCharacter(user.id);
    return { message: 'หักต้นทุนแล้ว — เริ่มขุดได้เลย!', toolTier: r.toolTier, character: await buildMeCharacter(fresh) };
  });

  app.post('/api/gather', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { zone, luck, activity } = (req.body ?? {}) as { zone?: GatherZone; luck?: number; activity?: 'wood' | 'harvest' };
    if (zone !== 'mine' && zone !== 'forest') throw new AppError('โซนไม่ถูกต้อง');
    const char = await requireCharacter(user.id);
    const result = await gatherReward(char, zone, luck ?? 0, activity ?? 'wood');
    const fresh = await requireCharacter(user.id);
    return { ...result, card: cardById(result.templateId), character: await buildMeCharacter(fresh) };
  });

  // ------------------------------------------------------------------ คราฟต์
  app.post('/api/craft/equipment', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { key, wood, ore, hits } = (req.body ?? {}) as { key?: CraftKey; wood?: number[]; ore?: number[]; hits?: number };
    if (!key) throw new AppError('เลือกประเภทที่จะคราฟต์ก่อน');
    const char = await requireCharacter(user.id);
    const result = await craftEquipment(char, key, wood ?? [], ore ?? [], hits ?? 0);
    const fresh = await requireCharacter(user.id);
    return { card: result.template, character: await buildMeCharacter(fresh) };
  });

  app.post('/api/craft/alchemy', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { serials, hits } = (req.body ?? {}) as { serials?: number[]; hits?: number };
    const char = await requireCharacter(user.id);
    const result = await craftAlchemy(char, serials ?? [], hits ?? 0);
    const fresh = await requireCharacter(user.id);
    return { card: result.template, character: await buildMeCharacter(fresh) };
  });

  app.post('/api/craft/brew', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { serials, hits } = (req.body ?? {}) as { serials?: number[]; hits?: number };
    const char = await requireCharacter(user.id);
    const result = await craftBrew(char, serials ?? [], hits ?? 0);
    const fresh = await requireCharacter(user.id);
    return { card: result.template, character: await buildMeCharacter(fresh) };
  });

  app.post('/api/craft/cook', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { serials, hits } = (req.body ?? {}) as { serials?: number[]; hits?: number };
    const char = await requireCharacter(user.id);
    const result = await craftCook(char, serials ?? [], hits ?? 0);
    const fresh = await requireCharacter(user.id);
    return { card: result.template, character: await buildMeCharacter(fresh) };
  });

  // ------------------------------------------------------------------ เควสต์
  app.get('/api/quests', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const char = await requireCharacter(user.id);
    const quests = await ensureQuests(user.id, char.highestFloor);
    return { quests: quests.map(questView) };
  });

  // ------------------------------------------------------------------ อันดับ
  // คู่ท้าประลอง — ผู้เล่นที่มีเดคพร้อมสู้ เรียงตามเรตติ้งใกล้เราที่สุด
  app.get('/api/pvp/opponents', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const me = await requireCharacter(user.id);
    const rows = await prisma.character.findMany({ take: 80 });
    const deckCounts = await prisma.cardInstance.groupBy({
      by: ['ownerId'],
      where: { status: 'IN_DECK' },
      _count: { _all: true },
    });
    const deckMap = new Map(deckCounts.map((d) => [d.ownerId, d._count._all]));
    const opponents = rows
      .filter((c) => c.userId !== user.id && (deckMap.get(c.userId) ?? 0) >= DECK_MIN)
      .map((c) => ({ userId: c.userId, name: c.name, level: c.level, rating: c.rating, wins: c.wins, losses: c.losses }))
      .sort((x, y) => Math.abs(x.rating - me.rating) - Math.abs(y.rating - me.rating))
      .slice(0, 12);
    return { opponents };
  });

  app.get('/api/leaderboard', async () => {
    const rows = await prisma.character.findMany({
      where: { wins: { gt: -1 } },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }],
      take: 20,
    });
    const withUser = await Promise.all(rows.map(async (c) => {
      const u = await prisma.user.findUnique({ where: { id: c.userId } });
      return {
        name: c.name,
        level: c.level,
        rating: c.rating,
        wins: c.wins,
        losses: c.losses,
        avatar: u?.avatar ?? null,
      };
    }));
    return { leaderboard: withUser };
  });

  // ------------------------------------------------------------------ สเตตัส
  app.post('/api/stats/allocate', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { stat, points } = (req.body ?? {}) as { stat?: string; points?: number };
    const char = await requireCharacter(user.id);
    await allocateStatPoint(char, stat ?? '', points ?? 1);
    const fresh = await requireCharacter(user.id);
    return { character: await buildMeCharacter(fresh) };
  });

  // ------------------------------------------------------------------ ดันเจี้ยน (ข้อมูล)
  app.get('/api/dungeon', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const char = await syncEnergy(await requireCharacter(user.id));
    return {
      highestFloor: char.highestFloor,
      monsters: MONSTERS.map((m) => ({
        floor: m.floor,
        name: m.name,
        emoji: m.emoji,
        level: m.level,
        xp: m.xp,
        goldMin: m.goldMin,
        goldMax: m.goldMax,
      })),
    };
  });
}
