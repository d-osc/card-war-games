// ===========================================================================
// Routes เฟส 2 — ตลาดการ์ด / โซเชียล / กิลด์ / เควสต์ผู้เล่น / แอดมิน
// ===========================================================================
import { FastifyInstance } from 'fastify';
import { AUCTION_DURATIONS_H, allTemplates } from '@cardwar/shared';
import { prisma } from './db';
import { AppError } from './errors';
import { authenticate, reqUser } from './auth';
import { buildMeCharacter, requireCharacter } from './services/characters';
import * as market from './services/market';
import * as social from './services/social';
import * as guilds from './services/guilds';
import * as pquests from './services/pquests';
import * as admin from './services/admin';

async function freshChar(userId: number) {
  return { char: await requireCharacter(userId) };
}

/** สร้างข้อมูลตัวละครล่าสุด "หลัง" ทำรายการเสร็จ (กันค่า gold เก่า) */
async function meNow(userId: number) {
  return buildMeCharacter(await requireCharacter(userId));
}

export async function registerPhase2Routes(app: FastifyInstance): Promise<void> {
  // ------------------------------------------------------------- ตลาด: ประมูล
  app.get('/api/market/auctions', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { auctions: await market.listAuctions(user.id) };
  });

  app.post('/api/market/auctions/create', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { serial, startPrice, buyoutPrice, hours } = (req.body ?? {}) as {
      serial?: number; startPrice?: number; buyoutPrice?: number | null; hours?: number;
    };
    const { char } = await freshChar(user.id);
    const auction = await market.createAuction(char, serial ?? 0, startPrice ?? 0, buyoutPrice ?? null, hours ?? 6);
    return { auction, character: await meNow(user.id), durations: AUCTION_DURATIONS_H };
  });

  app.post('/api/market/auctions/:id/bid', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { amount } = (req.body ?? {}) as { amount?: number };
    const { char } = await freshChar(user.id);
    const result = await market.bidAuction(char, id, amount ?? 0);
    return { ...result, character: await meNow(user.id) };
  });

  app.post('/api/market/auctions/:id/buyout', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    await market.buyoutAuction(char, id);
    return { message: 'ซื้อสำเร็จ! การ์ดเข้าคลังแล้ว', character: await meNow(user.id) };
  });

  app.post('/api/market/auctions/:id/cancel', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    await market.cancelAuction(char, id);
    return { message: 'ยกเลิกการประมูลแล้ว (ค่าธรรมเนียมไม่คืน)', character: await meNow(user.id) };
  });

  // ------------------------------------------------------------- ตลาด: ขายตรง
  app.get('/api/market/direct', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { sales: await market.listDirectSales(user.id) };
  });

  app.post('/api/market/direct/create', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { serial, targetName, price } = (req.body ?? {}) as { serial?: number; targetName?: string; price?: number };
    const { char } = await freshChar(user.id);
    const sale = await market.createDirectSale(char, serial ?? 0, targetName ?? '', price ?? 0);
    return { sale, character: await meNow(user.id) };
  });

  app.post('/api/market/direct/:id/buy', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    await market.buyDirectSale(char, id);
    return { message: 'ซื้อสำเร็จ! การ์ดเข้าคลังแล้ว', character: await meNow(user.id) };
  });

  app.post('/api/market/direct/:id/cancel', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    await market.cancelDirectSale(char, id);
    return { message: 'ยกเลิกรายการขายตรงแล้ว (ค่าธรรมเนียมไม่คืน)', character: await meNow(user.id) };
  });

  // ------------------------------------------------------------------ โซเชียล
  app.get('/api/social/friends', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return await social.listFriends(user.id);
  });

  app.post('/api/social/friends/request', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { targetName } = (req.body ?? {}) as { targetName?: string };
    if (!targetName?.trim()) throw new AppError('กรุณาระบุชื่อผู้เล่น');
    const message = await social.sendFriendRequest(user.id, targetName.trim());
    return { message };
  });

  app.post('/api/social/friends/respond', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { friendshipId, accept } = (req.body ?? {}) as { friendshipId?: number; accept?: boolean };
    await social.respondFriendRequest(user.id, friendshipId ?? 0, accept !== false);
    return { message: accept !== false ? 'เป็นเพื่อนกันแล้ว!' : 'ปฏิเสธคำขอแล้ว' };
  });

  app.post('/api/social/friends/remove', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { friendshipId } = (req.body ?? {}) as { friendshipId?: number };
    await social.removeFriend(user.id, friendshipId ?? 0);
    return { message: 'ลบเพื่อนแล้ว' };
  });

  app.get('/api/social/inbox', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { inbox: await social.inbox(user.id), unread: await social.unreadCount(user.id) };
  });

  app.get('/api/social/messages/:withUserId', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const withUserId = Number((req.params as { withUserId: string }).withUserId);
    if (!Number.isFinite(withUserId)) throw new AppError('ระบุผู้รับไม่ถูกต้อง');
    return { messages: await social.conversation(user.id, withUserId) };
  });

  app.post('/api/social/messages/send', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { toUserId, text } = (req.body ?? {}) as { toUserId?: number; text?: string };
    await social.sendMessage(user.id, toUserId ?? 0, text ?? '');
    return { ok: true };
  });

  // -------------------------------------------------------------------- กิลด์
  app.get('/api/guilds/mine', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { guild: await guilds.myGuild(user.id) };
  });

  app.get('/api/guilds', async () => ({ guilds: await guilds.listGuilds() }));

  app.post('/api/guilds/create', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { name, emblem, description } = (req.body ?? {}) as { name?: string; emblem?: string; description?: string };
    const { char } = await freshChar(user.id);
    await guilds.createGuild(char, name ?? '', emblem ?? '⚔️', description ?? '');
    return { message: 'สร้างกิลด์สำเร็จ!', guild: await guilds.myGuild(user.id), character: await meNow(user.id) };
  });

  app.post('/api/guilds/:id/join', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    await guilds.joinGuild(char, id);
    return { message: 'เข้าร่วมกิลด์แล้ว', guild: await guilds.myGuild(user.id) };
  });

  app.post('/api/guilds/leave', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    await guilds.leaveGuild(user.id);
    return { message: 'ออกจากกิลด์แล้ว' };
  });

  app.post('/api/guilds/kick', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { targetUserId } = (req.body ?? {}) as { targetUserId?: number };
    await guilds.kickMember(user.id, targetUserId ?? 0);
    return { message: 'ไล่สมาชิกออกแล้ว', guild: await guilds.myGuild(user.id) };
  });

  app.get('/api/guilds/messages', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { messages: await guilds.guildMessages(user.id) };
  });

  app.post('/api/guilds/messages/send', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { text } = (req.body ?? {}) as { text?: string };
    const { char } = await freshChar(user.id);
    await guilds.sendGuildMessage(char, text ?? '');
    return { ok: true };
  });

  // ----------------------------------------------------------- เควสต์ผู้เล่นสร้าง
  app.get('/api/pquests', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { quests: await pquests.listPlayerQuests(user.id, false) };
  });

  app.get('/api/pquests/mine', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    return { quests: await pquests.listPlayerQuests(user.id, true) };
  });

  app.post('/api/pquests/create', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const { templateId, quantity, goldPerUnit, xpPerUnit } = (req.body ?? {}) as { templateId?: string; quantity?: number; goldPerUnit?: number; xpPerUnit?: number };
    const { char } = await freshChar(user.id);
    const quest = await pquests.createPlayerQuest(char, templateId ?? '', quantity ?? 1, goldPerUnit ?? 0, xpPerUnit ?? 0);
    return { quest, character: await meNow(user.id) };
  });

  app.post('/api/pquests/:id/deliver', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { serials } = (req.body ?? {}) as { serials?: number[] };
    const { char } = await freshChar(user.id);
    const result = await pquests.deliverPlayerQuest(char, id, serials ?? []);
    return { message: `ส่งมอบสำเร็จ ได้รางวัล ${result.payout} ทอง${result.xpGained > 0 ? ` + ${result.xpGained} XP` : ''}`, ...result, character: await meNow(user.id) };
  });

  app.post('/api/pquests/:id/cancel', { preHandler: authenticate }, async (req) => {
    const user = reqUser(req);
    const id = Number((req.params as { id: string }).id);
    const { char } = await freshChar(user.id);
    const r = await pquests.cancelPlayerQuest(char, id);
    return { message: r.refund > 0 ? `ยกเลิกเควสต์แล้ว คืนทอง ${r.refund}` : 'ยกเลิกเควสต์แล้ว', character: await meNow(user.id) };
  });

  // ------------------------------------------------------------------- แอดมิน
  app.get('/api/admin/stats', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    return await admin.adminStats();
  });

  app.get('/api/admin/ledger', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    const q = req.query as { limit?: string; type?: string };
    return { entries: await admin.adminLedger(Number(q.limit ?? 100) || 100, q.type) };
  });

  app.get('/api/admin/players', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    const q = req.query as { search?: string };
    return { players: await admin.adminPlayers(q.search ?? '') };
  });

  // ------- Admin Manager: จัดการผู้เล่นรายคน -------
  app.get('/api/admin/player/:userId', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    const userId = Number((req.params as { userId: string }).userId);
    return { player: await admin.playerDetail(userId) };
  });

  app.post('/api/admin/player/:userId/gold', { preHandler: authenticate }, async (req) => {
    const me = reqUser(req);
    admin.assertAdmin(me);
    const userId = Number((req.params as { userId: string }).userId);
    const { gold } = (req.body ?? {}) as { gold?: number };
    return await admin.setPlayerGold(me.id, userId, gold ?? 0);
  });

  app.post('/api/admin/player/:userId/rating', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    const userId = Number((req.params as { userId: string }).userId);
    const { rating } = (req.body ?? {}) as { rating?: number };
    return await admin.setPlayerRating(userId, rating ?? 1000);
  });

  app.post('/api/admin/cards', { preHandler: authenticate }, async (req) => {
    const me = reqUser(req);
    admin.assertAdmin(me);
    const body = (req.body ?? {}) as admin.CreateCardInput & { mintCount?: number };
    const t = await admin.createCustomCard(me.id, body);
    // ออกการ์ดให้ตัวแอดมินเองทันทีตามจำนวนที่ระบุ (ถ้า > 0)
    let mintedToSelf = 0;
    const count = Math.max(0, Math.min(50, Math.floor(body.mintCount ?? 0)));
    if (count > 0) {
      await requireCharacter(me.id); // ตรวจว่าแอดมินมีตัวละคร
      const { mintCard } = await import('./services/inventory');
      for (let i = 0; i < count; i++) {
        await mintCard(t.id, me.id, 'ADMIN_ADJUST', { by: me.id, reason: 'createCard' });
      }
      mintedToSelf = count;
    }
    return { card: t, mintedToSelf };
  });

  // อัปโหลดภาพอาร์ตการ์ด (base64 JSON — เขียนลง client/public/card-art)
  app.post('/api/admin/upload-card-art', { preHandler: authenticate, bodyLimit: 6 * 1024 * 1024 }, async (req) => {
    admin.assertAdmin(reqUser(req));
    const { dataBase64 } = (req.body ?? {}) as { dataBase64?: string };
    const m = /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,(.+)$/.exec(dataBase64 ?? '');
    if (!m) throw new AppError('รองรับเฉพาะไฟล์ภาพ png / jpg / webp / gif / svg');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1] === 'svg+xml' ? 'svg' : m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 100) throw new AppError('ไฟล์ภาพไม่ถูกต้อง');
    if (buf.length > 2_000_000) throw new AppError('ไฟล์ใหญ่เกิน (สูงสุด 2MB)');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(import.meta.dirname, '../../client/public/card-art');
    fs.mkdirSync(dir, { recursive: true });
    const name = `admin_${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return { path: `/card-art/${name}` };
  });

  app.get('/api/admin/cards', { preHandler: authenticate }, async (req) => {
    admin.assertAdmin(reqUser(req));
    return { cards: await admin.listCustomCards() };
  });

  app.get('/api/cards/custom', async () => {
    // public — client ดึงไป register ฝั่งตัวเองตอน boot
    const rows = await prisma.cardTemplate.findMany({ where: { id: { startsWith: admin.CUSTOM_PREFIX } } });
    return { cards: rows.map((r) => JSON.parse(r.data)) };
  });

  app.post('/api/admin/player/:userId/mint', { preHandler: authenticate }, async (req) => {
    const me = reqUser(req);
    admin.assertAdmin(me);
    const userId = Number((req.params as { userId: string }).userId);
    const { templateId, count } = (req.body ?? {}) as { templateId?: string; count?: number };
    return await admin.mintToPlayer(me.id, userId, templateId ?? '', count ?? 1);
  });

  // แค็ตตาล็อกสำหรับฟอร์มตั้งเควสต์ (เรียงตามกลุ่ม)
  app.get('/api/pquests/catalog', async () => ({
    templates: allTemplates().map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, rarity: t.rarity, basePrice: t.basePrice, group: t.group, category: t.category }))
      .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)),
  }));
}
