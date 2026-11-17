// ===========================================================================
// โซเชียล — เพื่อน + ข้อความส่วนตัว
// ===========================================================================
import { prisma } from '../db';
import { AppError } from '../errors';

export interface FriendInfo {
  friendshipId: number;
  userId: number;
  name: string;
  level: number;
  rating: number;
}

async function charLiteOf(userId: number): Promise<{ userId: number; name: string; level: number; rating: number } | null> {
  return prisma.character.findUnique({
    where: { userId },
    select: { userId: true, name: true, level: true, rating: true },
  });
}

export async function listFriends(userId: number): Promise<{
  friends: FriendInfo[];
  incoming: { friendshipId: number; name: string; level: number }[];
  outgoing: { friendshipId: number; name: string }[];
}> {
  const rels = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
  });
  const friends: FriendInfo[] = [];
  const incoming: { friendshipId: number; name: string; level: number }[] = [];
  const outgoing: { friendshipId: number; name: string }[] = [];
  for (const r of rels) {
    const otherId = r.requesterId === userId ? r.addresseeId : r.requesterId;
    const c = await charLiteOf(otherId);
    if (!c) continue;
    if (r.status === 'ACCEPTED') {
      friends.push({
        friendshipId: r.id,
        userId: c.userId,
        name: c.name,
        level: c.level,
        rating: c.rating,
      });
    } else if (r.addresseeId === userId) {
      incoming.push({ friendshipId: r.id, name: c.name, level: c.level });
    } else {
      outgoing.push({ friendshipId: r.id, name: c.name });
    }
  }
  return { friends, incoming, outgoing };
}

export async function sendFriendRequest(userId: number, targetName: string): Promise<string> {
  const target = await prisma.character.findFirst({ where: { name: targetName } });
  if (!target) throw new AppError(`ไม่พบผู้เล่นชื่อ "${targetName}"`);
  if (target.userId === userId) throw new AppError('เพิ่มตัวเองเป็นเพื่อนไม่ได้');
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.userId },
        { requesterId: target.userId, addresseeId: userId },
      ],
    },
  });
  if (existing) {
    if (existing.status === 'ACCEPTED') throw new AppError('คุณทั้งคู่เป็นเพื่อนกันอยู่แล้ว');
    if (existing.requesterId === userId) throw new AppError('ส่งคำขอไปแล้ว รอผู้เล่นอีกฝ่ายตอบรับ');
    // อีกฝ่ายขอเรามาก่อน → ตอบรับกลับทันที
    await prisma.friendship.update({ where: { id: existing.id }, data: { status: 'ACCEPTED' } });
    return 'เป็นเพื่อนกันแล้ว!';
  }
  await prisma.friendship.create({ data: { requesterId: userId, addresseeId: target.userId } });
  return 'ส่งคำขอเป็นเพื่อนแล้ว';
}

export async function respondFriendRequest(userId: number, friendshipId: number, accept: boolean): Promise<void> {
  const r = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!r || r.addresseeId !== userId || r.status !== 'PENDING') throw new AppError('ไม่พบคำขอนี้');
  if (accept) {
    await prisma.friendship.update({ where: { id: r.id }, data: { status: 'ACCEPTED' } });
  } else {
    await prisma.friendship.delete({ where: { id: r.id } });
  }
}

export async function removeFriend(userId: number, friendshipId: number): Promise<void> {
  const r = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!r || r.status !== 'ACCEPTED') throw new AppError('ไม่พบรายชื่อเพื่อนนี้');
  if (r.requesterId !== userId && r.addresseeId !== userId) throw new AppError('ไม่ใช่เพื่อนของคุณ');
  await prisma.friendship.delete({ where: { id: r.id } });
}

// ---------------------------------------------------------------------------
// ข้อความส่วนตัว
// ---------------------------------------------------------------------------

async function assertFriends(a: number, b: number): Promise<void> {
  const r = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
  if (!r) throw new AppError('ส่งข้อความได้เฉพาะเพื่อนที่ตอบรับแล้ว');
}

export interface InboxItem {
  userId: number;
  name: string;
  lastText: string;
  lastAt: string;
  unread: number;
}

export async function inbox(userId: number): Promise<InboxItem[]> {
  const msgs = await prisma.message.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const map = new Map<number, InboxItem>();
  for (const m of msgs) {
    const otherId = m.senderId === userId ? m.receiverId : m.senderId;
    const item = map.get(otherId);
    const unreadAdd = m.receiverId === userId && !m.readAt ? 1 : 0;
    if (!item) {
      const c = await charLiteOf(otherId);
      map.set(otherId, {
        userId: otherId,
        name: c?.name ?? `ผู้เล่น #${otherId}`,
        lastText: m.text.slice(0, 60),
        lastAt: m.createdAt.toISOString(),
        unread: unreadAdd,
      });
    } else {
      item.unread += unreadAdd;
    }
  }
  return [...map.values()];
}

export interface ChatMessage {
  id: number;
  fromMe: boolean;
  senderName: string;
  text: string;
  createdAt: string;
}

export async function conversation(userId: number, withUserId: number): Promise<ChatMessage[]> {
  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  // ของเก่าเกิน 100 ข้อความ ตัดเหลือ 100 ล่าสุด
  const sliced = rows.slice(-100);
  const other = await charLiteOf(withUserId);
  const out = sliced.map((m) => ({
    id: m.id,
    fromMe: m.senderId === userId,
    senderName: m.senderId === userId ? 'ฉัน' : (other?.name ?? '?'),
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  }));
  await prisma.message.updateMany({
    where: { senderId: withUserId, receiverId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return out;
}

export async function sendMessage(userId: number, toUserId: number, text: string): Promise<void> {
  const clean = text.trim().slice(0, 500);
  if (!clean) throw new AppError('ข้อความว่าง');
  if (toUserId === userId) throw new AppError('ส่งให้ตัวเองไม่ได้');
  await assertFriends(userId, toUserId);
  await prisma.message.create({ data: { senderId: userId, receiverId: toUserId, text: clean } });
}

export async function unreadCount(userId: number): Promise<number> {
  return prisma.message.count({ where: { receiverId: userId, readAt: null } });
}
