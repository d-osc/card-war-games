import { FastifyReply, FastifyRequest } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from './db';
import { AppError } from './errors';

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const JWT_SECRET = process.env.JWT_SECRET ?? 'cardwar-dev-secret-change-me';
/** อีเมล (หรือ dev:ชื่อ สำหรับ dev-login) ที่ได้สิทธิ์แอดมิน คั่นด้วย , */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** dev-login ใช้ได้เมื่อไม่ได้ตั้ง GOOGLE_CLIENT_ID (สำหรับพัฒนา/ทดสอบ) */
export const DEV_LOGIN_ENABLED = !GOOGLE_CLIENT_ID;

export interface JwtPayload {
  uid: number;
}

export function signToken(app: any, uid: number): string {
  return app.jwt.sign({ uid } satisfies JwtPayload);
}

export function verifyToken(app: any, token: string): JwtPayload {
  return app.jwt.verify(token) as JwtPayload;
}

const googleClient = new OAuth2Client();

export async function verifyGoogleCredential(credential: string): Promise<{ googleId: string; email: string | null; name: string; avatar: string | null }> {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID || undefined,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new AppError('Google token ไม่ถูกต้อง', 401);
  return {
    googleId: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? payload.email ?? 'ผู้เล่น',
    avatar: payload.picture ?? null,
  };
}

export async function findOrCreateUser(profile: { googleId: string; email: string | null; name: string; avatar: string | null }) {
  let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  const shouldBeAdmin = ADMIN_EMAILS.includes((profile.email ?? '').toLowerCase()) || ADMIN_EMAILS.includes(profile.googleId.toLowerCase());
  if (!user) {
    user = await prisma.user.create({
      data: { googleId: profile.googleId, email: profile.email, name: profile.name, avatar: profile.avatar, isAdmin: shouldBeAdmin },
    });
  } else if (user.name !== profile.name || user.avatar !== profile.avatar || (shouldBeAdmin && !user.isAdmin)) {
    // อัปเกรดเป็นแอดมินได้ตามรายชื่อ แต่ไม่ดาวน์เกรดสิทธิ์ที่ตั้งไว้ในฐานข้อมูลโดยตรง
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: profile.name, avatar: profile.avatar,
        ...(shouldBeAdmin && !user.isAdmin ? { isAdmin: true } : {}),
      },
    });
  }
  return user;
}

/** fastify preHandler — ตรวจ Bearer token */
export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    await reply.code(401).send({ error: 'กรุณาเข้าสู่ระบบ' });
    return;
  }
  try {
    const payload = verifyToken(req.server, token);
    const user = await prisma.user.findUnique({ where: { id: payload.uid } });
    if (!user) throw new Error('no user');
    (req as any).user = user;
  } catch {
    await reply.code(401).send({ error: 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
}

export function reqUser(req: FastifyRequest): { id: number; name: string; avatar: string | null; isAdmin: boolean } {
  return (req as any).user as { id: number; name: string; avatar: string | null; isAdmin: boolean };
}
