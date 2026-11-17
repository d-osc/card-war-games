// ===========================================================================
// E2E เฟส 2 — ประมูล / ขายตรง / เพื่อน+DM / กิลด์+แชท / เควสต์ผู้เล่น
// ใช้กับ dev server ที่รันอยู่ (default http://localhost:4000)
//   node scripts/e2e-phase2.mjs
//   BASE_URL=http://localhost:9999 node scripts/e2e-phase2.mjs
// หมายเหตุ: สคริปต์จัดการ fixture เอง (สร้างผู้เล่นทดสอบ + ปรับทองให้พอเข้าเงื่อนไข)
// ===========================================================================
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4000';
// fixture เชื่อม DB เดียวกับเซิร์ฟเวอร์: ถ้าตั้ง DATABASE_URL (เช่น รันกับ PostgreSQL) ใช้ค่านั้น
// ไม่งั้นใช้ SQLite dev.db ตามค่าเริ่มต้น (ต้อง generate prisma client ให้ตรง provider ก่อน — scripts/use-db.mjs)
const dbUrl = process.env.DATABASE_URL ?? (() => {
  const dbFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'server', 'prisma', 'dev.db');
  return `file:${dbFile.replace(/\\/g, '/')}`;
})();
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(method, url, { token, body } = {}) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** ค่าธรรมเนียมตลาด — สูตรเดียวกับ shared/marketFee */
const mfee = (x) => Math.max(5, Math.ceil(x * 0.05));

async function login(name) {
  const { status, data } = await api('POST', '/api/auth/dev', { body: { name } });
  if (status !== 200) throw new Error(`login ${name} ล้มเหลว: ${JSON.stringify(data)}`);
  return data;
}

async function me(token) {
  const { data } = await api('GET', '/api/me', { token });
  return data;
}

async function inventory(token) {
  const { data } = await api('GET', '/api/inventory', { token });
  return data.cards;
}

const SUFFIX = String(Date.now()).slice(-5); // กันชื่อชนกับรอบทดสอบก่อน

async function main() {
  // ---------------------------------------------------------- fixture: ผู้เล่น
  const userA = await login('decktester');
  const userB = await login(`e2eb${SUFFIX}`);
  const tokA = userA.token;
  const tokB = userB.token;

  // สร้างตัวละครถ้ายังไม่มี (A ด้วย — กรณีรันกับ DB ใหม่เช่น PostgreSQL)
  let meA = await me(tokA);
  if (!meA.character) {
    const r = await api('POST', '/api/character', { token: tokA, body: { name: 'DeckTest' } });
    check('fixture: สร้างตัวละคร A', r.status === 200, JSON.stringify(r.data).slice(0, 80));
    meA = await me(tokA);
  }
  let meB = await me(tokB);
  if (!meB.character) {
    const r = await api('POST', '/api/character', { token: tokB, body: { name: `E2EB${SUFFIX}` } });
    check('fixture: สร้างตัวละคร B', r.status === 200, JSON.stringify(r.data).slice(0, 80));
    meB = await me(tokB);
  }
  const charAName = meA.character.name;
  const charBName = meB.character.name;
  const userIdB = userB.user.id;

  // ปรับทองให้พอทดสอบทุกขั้น (กิลด์ 1000 / เควสต์ / ประมูล)
  const GOLD = 6000;
  await prisma.character.updateMany({ where: { userId: meA.user.id }, data: { gold: GOLD } });
  await prisma.character.updateMany({ where: { userId: userIdB }, data: { gold: GOLD } });

  // การ์ด INVENTORY ของ A สำหรับตลาด (ต้องเป็น INVENTORY เท่านั้น) — ถ้าไม่พอ mint เพิ่มเป็น fixture
  const NEED = 7;
  let cardsA = (await inventory(tokA)).filter((c) => c.status === 'INVENTORY');
  if (cardsA.length < NEED) {
    const missing = NEED - cardsA.length;
    for (let i = 0; i < missing; i++) {
      await prisma.cardInstance.create({ data: { templateId: 'potion_hp', ownerId: meA.user.id, status: 'INVENTORY' } });
      await prisma.cardTemplate.update({ where: { id: 'potion_hp' }, data: { minted: { increment: 1 } } });
    }
    cardsA = (await inventory(tokA)).filter((c) => c.status === 'INVENTORY');
  }
  check('fixture: A มีการ์ดในคลังพอสำหรับทดสอบ', cardsA.length >= NEED, `มี ${cardsA.length} ใบ`);

  const [aucCard, aucCancelCard, directCard, directCancelCard, questPayoutDummy] = cardsA;
  const bp = (c) => c.card.basePrice;

  // ============================================================ 1) ประมูล
  console.log('\n── ประมูล ──');
  const fee = mfee(bp(aucCard));
  const goldBefore = GOLD;
  const auc = await api('POST', '/api/market/auctions/create', {
    token: tokA,
    body: { serial: aucCard.id, startPrice: bp(aucCard), buyoutPrice: bp(aucCard) * 3, hours: 6 },
  });
  check('ประมูล: ตั้งประมูลสำเร็จ', auc.status === 200, `id=${auc.data.auction?.id}`);
  check('ประมูล: หักค่าธรรมเนียม 5%', auc.data.character?.gold === goldBefore - fee, `เหลือ ${auc.data.character?.gold}`);

  const list = await api('GET', '/api/market/auctions', { token: tokB });
  const mine1 = list.data.auctions.find((x) => x.id === auc.data.auction.id);
  check('ประมูล: ปรากฏในรายการ', !!mine1, mine1 ? `${mine1.card.name} start=${mine1.startPrice}` : 'ไม่พบ');

  // B เสนอราคา
  const bidAmt = bp(aucCard) + 50;
  const bid = await api('POST', `/api/market/auctions/${auc.data.auction.id}/bid`, { token: tokB, body: { amount: bidAmt } });
  check('ประมูล: B เสนอราคาสำเร็จ (วางประกัน)', bid.status === 200 && bid.data.character?.gold === GOLD - bidAmt, `เหลือ ${bid.data.character?.gold}`);

  // ผู้ขายยกเลิกไม่ได้เมื่อมีคนบิด
  const cancelShouldFail = await api('POST', `/api/market/auctions/${auc.data.auction.id}/cancel`, { token: tokA });
  check('ประมูล: ยกเลิกไม่ได้เมื่อมีผู้เสนอราคา', cancelShouldFail.status === 400, cancelShouldFail.data?.error ?? '');

  // B buyout — ได้การ์ด คืนเงินวางประกัน ผู้ขายได้เงินหัก fee
  const buyoutPrice = bp(aucCard) * 3;
  const bo = await api('POST', `/api/market/auctions/${auc.data.auction.id}/buyout`, { token: tokB, body: {} });
  const goldBAfterBuyout = GOLD - bidAmt + bidAmt - buyoutPrice; // คืน bid แล้วจ่าย buyout
  check('ประมูล: B ซื้อทันทีสำเร็จ', bo.status === 200, bo.data?.message ?? bo.data?.error);
  check('ประมูล: ยอดทอง B ถูกต้อง (คืนวางประกัน-จ่ายซื้อ)', bo.data.character?.gold === goldBAfterBuyout, `จริง ${bo.data.character?.gold} คาด ${goldBAfterBuyout}`);
  const cardsB = await inventory(tokB);
  check('ประมูล: การ์ดย้ายไปคลัง B', cardsB.some((c) => c.id === aucCard.id && c.status === 'INVENTORY'));
  const meAafter = await me(tokA);
  check('ประมูล: ผู้ขายได้เงินหักค่าธรรมเนียม', meAafter.character.gold === (GOLD - fee) + (buyoutPrice - mfee(buyoutPrice)), `จริง ${meAafter.character.gold}`);

  // ตั้งอีกใบแล้วยกเลิก (ไม่มีคนบิด → ยกเลิกได้ ค่าธรรมเนียมไม่คืน)
  const auc2 = await api('POST', '/api/market/auctions/create', {
    token: tokA, body: { serial: aucCancelCard.id, startPrice: bp(aucCancelCard), buyoutPrice: null, hours: 6 },
  });
  if (auc2.status !== 200) check('ประมูล: ตั้งประมูลใบที่สอง (ทดสอบยกเลิก)', false, JSON.stringify(auc2.data));
  const cancelOk = await api('POST', `/api/market/auctions/${auc2.data.auction?.id}/cancel`, { token: tokA });
  const cardsA2 = await inventory(tokA);
  check('ประมูล: ยกเลิกสำเร็จ (ไม่มีบิด) การ์ดกลับคลัง', cancelOk.status === 200 && cardsA2.some((c) => c.id === aucCancelCard.id && c.status === 'INVENTORY'));

  // ============================================================ 2) ขายตรง
  console.log('\n── ขายตรง ──');
  const userC = await login(`e2ec${SUFFIX}`); // คนนอก — ต้องมองไม่เห็นข้อเสนอ
  const tokC = userC.token;
  const dsFee = mfee(bp(directCard));
  const goldApreDS = (await me(tokA)).character.gold;
  const ds = await api('POST', '/api/market/direct/create', {
    token: tokA, body: { serial: directCard.id, targetName: charBName, price: bp(directCard) },
  });
  check('ขายตรง: ตั้งขายถึง B สำเร็จ', ds.status === 200, `id=${ds.data.sale?.id} target=${ds.data.sale?.targetName}`);
  check('ขายตรง: หักค่าธรรมเนียม', ds.data.character?.gold === goldApreDS - dsFee, `เหลือ ${ds.data.character?.gold} คาด ${goldApreDS - dsFee}`);

  const dsListB = await api('GET', '/api/market/direct', { token: tokB });
  check('ขายตรง: B เห็นข้อเสนอ', dsListB.data.sales.some((s) => s.id === ds.data.sale.id));
  const dsListC = await api('GET', '/api/market/direct', { token: tokC });
  check('ขายตรง: คนนอก (C) มองไม่เห็นข้อเสนอ', !dsListC.data.sales.some((s) => s.id === ds.data.sale.id));

  const goldApre = (await me(tokA)).character.gold;
  const dsBuy = await api('POST', `/api/market/direct/${ds.data.sale.id}/buy`, { token: tokB, body: {} });
  check('ขายตรง: B ซื้อสำเร็จ', dsBuy.status === 200, dsBuy.data?.message ?? dsBuy.data?.error);
  check('ขายตรง: ผู้ขายได้เงินหัก fee', (await me(tokA)).character.gold === goldApre + (bp(directCard) - mfee(bp(directCard))));
  check('ขายตรง: การ์ดย้ายเจ้าของ', (await inventory(tokB)).some((c) => c.id === directCard.id));

  // ตั้งแล้วยกเลิก
  const ds2 = await api('POST', '/api/market/direct/create', {
    token: tokA, body: { serial: directCancelCard.id, targetName: charBName, price: bp(directCancelCard) },
  });
  if (ds2.status !== 200) check('ขายตรง: ตั้งใบที่สอง (ทดสอบยกเลิก)', false, JSON.stringify(ds2.data));
  const dsCancel = await api('POST', `/api/market/direct/${ds2.data.sale?.id}/cancel`, { token: tokA });
  check('ขายตรง: ยกเลิกสำเร็จ การ์ดกลับคลัง', dsCancel.status === 200 && (await inventory(tokA)).some((c) => c.id === directCancelCard.id));

  // ============================================================ 3) เพื่อน + DM
  console.log('\n── เพื่อน + DM ──');
  const fr = await api('POST', '/api/social/friends/request', { token: tokB, body: { targetName: charAName } });
  check('เพื่อน: B ส่งคำขอถึง A', fr.status === 200, fr.data?.message ?? fr.data?.error);

  const friendsA = await api('GET', '/api/social/friends', { token: tokA });
  const pending = friendsA.data.incoming.find((f) => f.name === charBName) ?? null;
  check('เพื่อน: A เห็นคำขอค้างรับ', !!pending, `friendshipId=${pending?.friendshipId ?? 'ไม่พบ'} incoming=${friendsA.data.incoming?.length ?? 0}`);
  const accept = await api('POST', '/api/social/friends/respond', { token: tokA, body: { friendshipId: pending.friendshipId, accept: true } });
  check('เพื่อน: A ตอบรับสำเร็จ', accept.status === 200);

  const dm1 = await api('POST', '/api/social/messages/send', { token: tokA, body: { toUserId: userIdB, text: 'สวัสดีจาก A' } });
  const dm2 = await api('POST', '/api/social/messages/send', { token: tokB, body: { toUserId: meA.user.id, text: 'รับทราบจาก B' } });
  check('DM: ส่งข้อความทั้งสองทาง', dm1.status === 200 && dm2.status === 200, dm1.data?.error ?? dm2.data?.error ?? '');

  const convA = await api('GET', `/api/social/messages/${userIdB}`, { token: tokA });
  check('DM: A อ่านบทสนทนาได้ครบ', convA.data.messages.some((m) => m.text === 'สวัสดีจาก A') && convA.data.messages.some((m) => m.text === 'รับทราบจาก B'), `${convA.data.messages.length} ข้อความ`);
  const inboxB = await api('GET', '/api/social/inbox', { token: tokB });
  check('DM: inbox B มีข้อความใหม่', inboxB.data.unread >= 1 || inboxB.data.inbox.length >= 1);

  const remove = await api('POST', '/api/social/friends/remove', { token: tokA, body: { friendshipId: pending.friendshipId } });
  check('เพื่อน: ลบเพื่อน (cleanup)', remove.status === 200);

  // ============================================================ 4) กิลด์ + แชท
  console.log('\n── กิลด์ + แชท ──');
  // A อาจติดกิลด์เก่า → ออกให้เป็นอิสระก่อน
  const myG = await api('GET', '/api/guilds/mine', { token: tokA });
  if (myG.data.guild) await api('POST', '/api/guilds/leave', { token: tokA });

  const gname = `E2E${SUFFIX}`;
  const goldApreG = (await me(tokA)).character.gold;
  const gc = await api('POST', '/api/guilds/create', { token: tokA, body: { name: gname, emblem: '⚔️', description: 'กิลด์ทดสอบ E2E' } });
  check('กิลด์: A สร้างสำเร็จ (จ่าย 1000)', gc.status === 200 && gc.data.character?.gold === goldApreG - 1000, `เหลือ ${gc.data.character?.gold} / ${goldApreG}`);
  const guildId = gc.data.guild?.id;

  const gj = await api('POST', `/api/guilds/${guildId}/join`, { token: tokB });
  check('กิลด์: B เข้าร่วมสำเร็จ', gj.status === 200 && gj.data.guild?.members?.length === 2, gj.data?.message ?? gj.data?.error);

  const c1 = await api('POST', '/api/guilds/messages/send', { token: tokA, body: { text: 'ยินดีต้อนรับสู่กิลด์' } });
  const c2 = await api('POST', '/api/guilds/messages/send', { token: tokB, body: { text: 'ขอบคุณหัวกิลด์' } });
  check('กิลด์แชท: ส่งได้ทั้งสองคน', c1.status === 200 && c2.status === 200);
  const gmsg = await api('GET', '/api/guilds/messages', { token: tokB });
  check('กิลด์แชท: B อ่านเห็นข้อความของ A', gmsg.data.messages.some((m) => m.text === 'ยินดีต้อนรับสู่กิลด์'), `${gmsg.data.messages.length} ข้อความ`);

  const kick = await api('POST', '/api/guilds/kick', { token: tokA, body: { targetUserId: userIdB } });
  check('กิลด์: หัวกิลด์ไล่สมาชิกได้', kick.status === 200);
  const gAll = await api('GET', '/api/guilds');
  check('กิลด์: ข้อมูลสาธารณะ (ลิสต์กิลด์)', Array.isArray(gAll.data.guilds));
  // cleanup: A ออกจากกิลด์ (คนสุดท้าย → ยุบอัตโนมัติ)
  await api('POST', '/api/guilds/leave', { token: tokA });

  // ============================================================ 5) เควสต์ผู้เล่น
  console.log('\n── เควสต์ผู้เล่น ──');
  // B ต้องมีการ์ด 'potion_hp' ในคลัง — หยิบจากเดคออกมา
  let cardsB2 = await inventory(tokB);
  let potion = cardsB2.find((c) => c.templateId === 'potion_hp' && c.status === 'INVENTORY');
  if (!potion) {
    const inDeck = cardsB2.find((c) => c.templateId === 'potion_hp' && c.status === 'IN_DECK');
    if (inDeck) {
      await api('POST', `/api/cards/${inDeck.id}/action`, { token: tokB, body: { action: 'removeDeck' } });
      cardsB2 = await inventory(tokB);
      potion = cardsB2.find((c) => c.templateId === 'potion_hp' && c.status === 'INVENTORY');
    }
  }
  if (!potion) {
    // mint potion_hp ให้ A (ถ้ายังไม่มี) แล้วขายตรงต่อให้ B ราคา basePrice
    let pA = (await inventory(tokA)).find((c) => c.templateId === 'potion_hp' && c.status === 'INVENTORY');
    if (!pA) {
      await prisma.cardInstance.create({ data: { templateId: 'potion_hp', ownerId: meA.user.id, status: 'INVENTORY' } });
      await prisma.cardTemplate.update({ where: { id: 'potion_hp' }, data: { minted: { increment: 1 } } });
      pA = (await inventory(tokA)).find((c) => c.templateId === 'potion_hp' && c.status === 'INVENTORY');
    }
    const dsq = await api('POST', '/api/market/direct/create', { token: tokA, body: { serial: pA.id, targetName: charBName, price: pA.card.basePrice } });
    await api('POST', `/api/market/direct/${dsq.data.sale.id}/buy`, { token: tokB, body: {} });
    cardsB2 = await inventory(tokB);
    potion = cardsB2.find((c) => c.id === pA.id && c.status === 'INVENTORY');
  }
  check('เควสต์: fixture — B มี potion_hp ในคลัง', !!potion, `serial=${potion?.id}`);

  const baseHp = potion.card.basePrice;
  const reward = baseHp + 15;
  const qfee = Math.ceil(reward * 1 * 0.1);
  const goldApreQ = (await me(tokA)).character.gold;
  const q = await api('POST', '/api/pquests/create', { token: tokA, body: { templateId: 'potion_hp', quantity: 1, goldPerUnit: reward } });
  check('เควสต์: A ตั้งเควสต์สำเร็จ (ฝากรางวัล+ค่าธรรมเนียม)', q.status === 200 && q.data.character?.gold === goldApreQ - reward - qfee, `id=${q.data.quest?.id} เหลือ ${q.data.character?.gold}`);

  const questId = q.data.quest.id;
  const openList = await api('GET', '/api/pquests', { token: tokB });
  check('เควสต์: ปรากฏในกระดานเควสต์', openList.data.quests.some((x) => x.id === questId));

  const goldBpreD = (await me(tokB)).character.gold;
  const dv = await api('POST', `/api/pquests/${questId}/deliver`, { token: tokB, body: { serials: [potion.id] } });
  check('เควสต์: B ส่งมอบสำเร็จได้รางวัล', dv.status === 200 && dv.data.character?.gold === goldBpreD + reward, dv.data?.message ?? dv.data?.error);
  check('เควสต์: การ์ดถึงมือผู้ตั้ง', (await inventory(tokA)).some((c) => c.id === potion.id));
  const mineQ = await api('GET', '/api/pquests/mine', { token: tokA });
  const doneQ = mineQ.data.quests.find((x) => x.id === questId);
  check('เควสต์: สถานะเควสต์เสร็จ (delivered ครบ)', !!doneQ && (doneQ.delivered >= doneQ.quantity || doneQ.status !== 'OPEN'), `status=${doneQ?.status} ${doneQ?.delivered}/${doneQ?.quantity}`);

  // ตั้งอีกอันแล้วยกเลิก → คืนเงินรางวัลคงเหลือ
  const q2 = await api('POST', '/api/pquests/create', { token: tokA, body: { templateId: 'potion_hp', quantity: 1, goldPerUnit: reward } });
  const goldApreC = (await me(tokA)).character.gold;
  const qc = await api('POST', `/api/pquests/${q2.data.quest.id}/cancel`, { token: tokA });
  check('เควสต์: ยกเลิกคืนเงินรางวัล (เสียค่าธรรมเนียม)', qc.status === 200 && qc.data.character?.gold === goldApreC + reward, `คืนถึง ${qc.data.character?.gold}`);

  // ============================================================ สรุป
  const failed = results.filter((r) => !r.ok);
  console.log(`\n════════ สรุป E2E เฟส 2: ${results.length - failed.length}/${results.length} ผ่าน ════════`);
  if (failed.length > 0) {
    console.log('รายการที่ไม่ผ่าน:');
    failed.forEach((f) => console.log(`  ❌ ${f.name} — ${f.detail}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error('E2E ล้มเหลวก่อนครบกระบวนการ:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
