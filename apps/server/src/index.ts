import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { Server as SocketServer } from 'socket.io';
import { registerRoutes } from './routes';
import { loadCustomTemplates } from './services/admin';
import { JWT_SECRET, verifyToken } from './auth';
import { AppError } from './errors';
import { battleManager } from './battle/manager';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(fastifyJwt, { secret: JWT_SECRET });
  await app.register(fastifyCors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    const status = err instanceof AppError ? err.status : ((err as { statusCode?: number }).statusCode ?? 500);
    if (status >= 500) app.log.error(err);
    reply.code(status).send({ error: err.message });
  });

  await registerRoutes(app);

  // โหลดการ์ด custom ที่แอดมินสร้าง (เก็บใน DB) เข้า registry ก่อนเปิดรับ request
  const customLoaded = await loadCustomTemplates();
  if (customLoaded > 0) console.log(`🃏 โหลดการ์ด custom ${customLoaded} ใบจากฐานข้อมูล`);

  // ถ้า build client แล้ว ให้เสิร์ฟจาก server ตัวเดียว (production/PWA)
  const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: clientDist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
        reply.code(404).send({ error: 'ไม่พบ path นี้' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  await app.listen({ port: PORT, host: HOST });
  console.log(`🚀 Card War server: http://localhost:${PORT}`);

  // ------------------------------------------------------------- socket.io
  const io = new SocketServer(app.server, {
    cors: { origin: true },
  });
  battleManager.init(io);

  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string) ?? '';
    try {
      const payload = verifyToken(app, token);
      socket.data.userId = payload.uid;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('pvp:queue', () => void battleManager.joinQueue(socket));
    socket.on('pvp:cancel', () => battleManager.cancelQueue(socket));
    socket.on('pvp:challenge', (msg: { userId?: number }) => void battleManager.startChallenge(socket, msg?.userId ?? 0));
    socket.on('room:create', () => void battleManager.createRoom(socket));
    socket.on('room:join', (msg: { code?: string }) => void battleManager.joinRoom(socket, msg?.code ?? ''));
    socket.on('room:cancel', () => battleManager.cancelRoom(socket));
    socket.on('pve:start', (msg: { floor?: number }) => void battleManager.startPve(socket, msg?.floor ?? 1));
    socket.on('battle:join', (msg: { battleId?: string }) => battleManager.joinBattle(socket, msg?.battleId ?? ''));
    socket.on('battle:action', (msg: { battleId?: string; type?: string; handUid?: string; slotIndex?: number; choice?: string }) =>
      battleManager.handleAction(socket, {
        battleId: msg?.battleId ?? '',
        type: msg?.type ?? '',
        handUid: msg?.handUid,
        slotIndex: msg?.slotIndex,
        choice: msg?.choice,
      }));
    socket.on('disconnect', () => battleManager.handleDisconnect(socket));
  });

  // Sweeper: ประมูล/ขายตรงที่หมดเวลา — จัดการปิดรายการโดยไม่ต้องรอใครมากดหน้า
  const { settleExpiredAuctions, sweepExpiredDirectSales } = await import('./services/market');
  setInterval(() => {
    void settleExpiredAuctions().catch((e) => app.log.warn(`auction sweep: ${String(e)}`));
    void sweepExpiredDirectSales().catch((e) => app.log.warn(`direct sweep: ${String(e)}`));
  }, 30_000);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
