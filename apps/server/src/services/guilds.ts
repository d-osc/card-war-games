// ===========================================================================
// กิลด์ — สร้าง (มีค่าธรรมเนียม), เข้าร่วม, ไล่สมาชิก, แชทกิลด์
// ===========================================================================
import { GUILD_CREATE_COST } from '@cardwar/shared';
import type { Character } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from '../errors';
import { recordLedger } from './ledger';

export interface GuildMemberView {
  userId: number;
  userName: string;
  role: string;
  level: number;
}

export interface GuildView {
  id: number;
  name: string;
  emblem: string;
  description: string;
  leaderName: string;
  memberCount: number;
  myRole?: string;
  members?: GuildMemberView[];
}

async function membersOf(guildId: number): Promise<GuildMemberView[]> {
  const rows = await prisma.guildMember.findMany({ where: { guildId }, orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }] });
  const out: GuildMemberView[] = [];
  for (const m of rows) {
    const c = await prisma.character.findUnique({ where: { userId: m.userId } });
    out.push({
      userId: m.userId,
      userName: m.userName,
      role: m.role,
      level: c?.level ?? 0,
    });
  }
  return out;
}

export async function myGuild(userId: number): Promise<GuildView | null> {
  const member = await prisma.guildMember.findFirst({ where: { userId } });
  if (!member) return null;
  const guild = await prisma.guild.findUnique({ where: { id: member.guildId } });
  if (!guild) return null;
  const leader = await prisma.guildMember.findFirst({ where: { guildId: guild.id, role: 'leader' } });
  return {
    id: guild.id,
    name: guild.name,
    emblem: guild.emblem,
    description: guild.description,
    leaderName: leader?.userName ?? '?',
    memberCount: await prisma.guildMember.count({ where: { guildId: guild.id } }),
    myRole: member.role,
    members: await membersOf(guild.id),
  };
}

export async function listGuilds(): Promise<GuildView[]> {
  const guilds = await prisma.guild.findMany({ orderBy: { name: 'asc' }, take: 50 });
  const out: GuildView[] = [];
  for (const g of guilds) {
    const leader = await prisma.guildMember.findFirst({ where: { guildId: g.id, role: 'leader' } });
    out.push({
      id: g.id,
      name: g.name,
      emblem: g.emblem,
      description: g.description,
      leaderName: leader?.userName ?? '?',
      memberCount: await prisma.guildMember.count({ where: { guildId: g.id } }),
    });
  }
  return out;
}

export async function createGuild(char: Character, name: string, emblem: string, description: string): Promise<void> {
  const clean = name.trim().slice(0, 24);
  if (clean.length < 3) throw new AppError('ชื่อกิลด์ต้องยาว 3-24 ตัวอักษร');
  const exists = await prisma.guild.findUnique({ where: { name: clean } });
  if (exists) throw new AppError('ชื่อกิลด์นี้ถูกใช้แล้ว');
  const already = await prisma.guildMember.findFirst({ where: { userId: char.userId } });
  if (already) throw new AppError('คุณมีกิลด์อยู่แล้ว (ออกก่อนจึงสร้างใหม่ได้)');
  if (char.gold < GUILD_CREATE_COST) throw new AppError(`ค่าสร้างกิลด์ ${GUILD_CREATE_COST} ทอง — ทองไม่พอ`);
  await prisma.character.update({ where: { id: char.id }, data: { gold: char.gold - GUILD_CREATE_COST } });
  const guild = await prisma.guild.create({
    data: { name: clean, emblem: (emblem || '⚔️').slice(0, 4), description: description.trim().slice(0, 200), leaderId: char.userId },
  });
  await prisma.guildMember.create({ data: { guildId: guild.id, userId: char.userId, userName: char.name, role: 'leader' } });
  await recordLedger({ type: 'GUILD_CREATE', userId: char.userId, gold: -GUILD_CREATE_COST, meta: { guildId: guild.id, name: clean } });
}

export async function joinGuild(char: Character, guildId: number): Promise<void> {
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) throw new AppError('ไม่พบกิลด์นี้');
  const already = await prisma.guildMember.findFirst({ where: { userId: char.userId } });
  if (already) throw new AppError('คุณอยู่กิลด์อื่นอยู่ (ออกก่อนจึงเข้ากิลด์ใหม่ได้)');
  const count = await prisma.guildMember.count({ where: { guildId } });
  if (count >= 30) throw new AppError('กิลด์นี้เต็ม (30 คน)');
  await prisma.guildMember.create({ data: { guildId, userId: char.userId, userName: char.name } });
}

export async function leaveGuild(userId: number): Promise<void> {
  const member = await prisma.guildMember.findFirst({ where: { userId } });
  if (!member) throw new AppError('คุณยังไม่มีกิลด์');
  const count = await prisma.guildMember.count({ where: { guildId: member.guildId } });
  if (member.role === 'leader' && count > 1) {
    throw new AppError('หัวกิลด์ออกไม่ได้ขณะมีสมาชิกเหลืออยู่ — ไล่สมาชิกออกก่อน หรือถ้าเป็นคนสุดท้ายกิลด์จะยุบอัตโนมัติ');
  }
  await prisma.guildMember.delete({ where: { id: member.id } });
  if (count === 1) {
    // คนสุดท้ายออก → ยุบกิลด์
    await prisma.guildMessage.deleteMany({ where: { guildId: member.guildId } });
    await prisma.guild.delete({ where: { id: member.guildId } });
  }
}

export async function kickMember(leaderId: number, targetUserId: number): Promise<void> {
  const leader = await prisma.guildMember.findFirst({ where: { userId: leaderId } });
  if (!leader || leader.role !== 'leader') throw new AppError('เฉพาะหัวกิลด์ที่ไล่สมาชิกได้');
  const target = await prisma.guildMember.findFirst({ where: { guildId: leader.guildId, userId: targetUserId } });
  if (!target) throw new AppError('ไม่พบสมาชิกคนนี้ในกิลด์');
  if (target.role === 'leader') throw new AppError('ไล่ตัวเองไม่ได้');
  await prisma.guildMember.delete({ where: { id: target.id } });
}

export interface GuildChatMessage {
  id: number;
  senderName: string;
  text: string;
  createdAt: string;
}

export async function guildMessages(userId: number): Promise<GuildChatMessage[]> {
  const member = await prisma.guildMember.findFirst({ where: { userId } });
  if (!member) throw new AppError('คุณยังไม่มีกิลด์');
  const rows = await prisma.guildMessage.findMany({
    where: { guildId: member.guildId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    senderName: m.senderName,
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  }));
}

export async function sendGuildMessage(char: Character, text: string): Promise<void> {
  const member = await prisma.guildMember.findFirst({ where: { userId: char.userId } });
  if (!member) throw new AppError('คุณยังไม่มีกิลด์');
  const clean = text.trim().slice(0, 500);
  if (!clean) throw new AppError('ข้อความว่าง');
  await prisma.guildMessage.create({ data: { guildId: member.guildId, senderId: char.userId, senderName: char.name, text: clean } });
}
