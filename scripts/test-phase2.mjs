// ทดสอบ REST flow เฟส 2: ตลาด (ประมูล+ขายตรง) / เพื่อน+แชท / กิลด์ / เควสต์ผู้เล่น / แอดมิน
// ใช้: node scripts/test-phase2.mjs (server ต้องรันอยู่ที่ :4000)
const API = 'http://localhost:4000';

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
  return data;
}

async function mkUser(name, classId = 'mage') {
  const login = await api('/api/auth/dev', { method: 'POST', body: { name } });
  const token = login.token;
  const me = await api('/api/me', { token });
  if (!me.character) {
    await api('/api/character', { method: 'POST', body: { name: name + 'C', classId }, token });
  }
  return { token, name };
}

async function gold(token) {
  const me = await api('/api/me', { token });
  return me.character.gold;
}

// หาการ์ดในคลังตาม templateId
async function findCard(token, templateId, status = 'INVENTORY') {
  const inv = await api('/api/inventory', { token });
  return inv.cards.find((c) => c.templateId === templateId && c.status === status);
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('  ✔', msg);
}

async function main() {
  const s = Date.now() % 100000;
  const A = await mkUser(`MktA${s}`, 'swordsman');
  const B = await mkUser(`MktB${s}`, 'mage');
  console.log('ผู้เล่นพร้อม: MktA (ขาย) / MktB (ซื้อ)');

  // ให้ B มีทองเยอะ (ไม่มีเช็ด — ใช้กาชาให้การ์ด แล้วขายคืนสะสม? ใช้วิธีตรง: ทดสอบด้วยราคาถูก)
  // หาการ์ดวัสดุจากเดคเริ่มต้นของ A — ไม่มี วัสดุในเดค → ใช้ potion จากเดค: ถอดจากเดคก่อน
  const potion = await findCard(A.token, 'potion_hp', 'IN_DECK');
  assert(potion != null, 'A มีการ์ดยาในเดค (จะถอดมาขาย)');
  await api(`/api/cards/${potion.id}/action`, { method: 'POST', body: { action: 'removeDeck' }, token: A.token });
  const potionInv = await findCard(A.token, 'potion_hp', 'INVENTORY');
  assert(potionInv != null, 'ถอดการ์ดออกจากเดคเรียบร้อย');

  // ---------------- ประมูล ----------------
  console.log('--- ประมูล ---');
  const gA0 = await gold(A.token), gB0 = await gold(B.token);
  // B ตั้งประมูลขายให้ A เสนอ (ตั้งโดย A, B เสนอ)
  const created = await api('/api/market/auctions/create', {
    method: 'POST', token: A.token,
    body: { serial: potionInv.id, startPrice: 50, buyoutPrice: 400, hours: 6 },
  });
  assert(created.auction.id > 0, `ตั้งประมูลสำเร็จ (ค่าธรรมเนียม ${gA0 - created.character.gold} ทอง)`);
  assert(gA0 - created.character.gold === 5, 'ค่าธรรมเนียมตั้งประมูล = 5 ทอง (5% ขั้นต่ำ)');

  // ราคาต่ำกว่าฐาน → ต้องถูกปฏิเสธ
  const p2 = await findCard(A.token, 'potion_hp', 'AUCTION').catch(() => null);
  assert(p2 == null, 'การ์ดที่ประมูลอยู่หาในคลัง INVENTORY ไม่ได้แล้ว (สถานะ AUCTION)');
  let lowBidRejected = false;
  try {
    await api(`/api/market/auctions/${created.auction.id}/bid`, { method: 'POST', token: B.token, body: { amount: 40 } });
  } catch (e) {
    lowBidRejected = e.message.includes('อย่างน้อย');
  }
  assert(lowBidRejected, 'เสนอราคาต่ำกว่าขั้นต่ำถูกปฏิเสธ');

  const bid1 = await api(`/api/market/auctions/${created.auction.id}/bid`, { method: 'POST', token: B.token, body: { amount: 50 } });
  assert(gB0 - bid1.character.gold === 50, 'B เสนอ 50 ทอง — เงินถูกวางประกันทันที');

  // A พยายามเสนอการ์ดตัวเอง → ปฏิเสธ
  let selfRejected = false;
  try {
    await api(`/api/market/auctions/${created.auction.id}/bid`, { method: 'POST', token: A.token, body: { amount: 100 } });
  } catch {
    selfRejected = true;
  }
  assert(selfRejected, 'เจ้าของประมูลการ์ดตัวเองไม่ได้');

  // ซื้อทันที 400
  const gA1 = await gold(A.token);
  const buyout = await api(`/api/market/auctions/${created.auction.id}/buyout`, { method: 'POST', token: B.token });
  const gB1 = buyout.character.gold;
  const gA2 = await gold(A.token);
  assert(gB1 === gB0 - 400 + 0, `B จ่ายซื้อทันที 400 (B: ${gB0} → ${gB1})`);
  assert(gA2 - gA1 === 400 - 20, `A ได้เงินหลังหักค่าธรรมเนียม 5% (+${gA2 - gA1})`);
  const bought = await findCard(B.token, 'potion_hp', 'INVENTORY');
  assert(bought != null, 'การ์ดยาไปอยู่ในคลังของ B แล้ว');

  // ---------------- ขายตรง ----------------
  console.log('--- ขายตรง ---');
  // A ขายการ์ดยาอีกใบจากเดคให้ B ระบุตัว
  const potion2 = await findCard(A.token, 'potion_hp', 'IN_DECK');
  await api(`/api/cards/${potion2.id}/action`, { method: 'POST', body: { action: 'removeDeck' }, token: A.token });
  const potion2Inv = await findCard(A.token, 'potion_hp', 'INVENTORY');
  const meB = await api('/api/me', { token: B.token });
  const sale = await api('/api/market/direct/create', {
    method: 'POST', token: A.token,
    body: { serial: potion2Inv.id, targetName: meB.character.name, price: 80 },
  });
  assert(sale.sale.isForMe === false && sale.sale.price === 80, 'ตั้งขายตรงระบุผู้เล่นสำเร็จ');

  // B2 (คนอื่น) มองไม่เห็น
  const C = await mkUser(`MktC${s}`, 'archer');
  const cSales = await api('/api/market/direct', { token: C.token });
  assert(cSales.sales.length === 0, 'คนอื่น (ไม่ใช่ผู้รับ/ผู้ขาย) มองไม่เห็นรายการขายตรง');

  // B ซื้อ
  const gA3 = await gold(A.token);
  const buyRes = await api(`/api/market/direct/${sale.sale.id}/buy`, { method: 'POST', token: B.token });
  const gA4 = await gold(A.token);
  assert(gA4 - gA3 === 80 - 5, `A ได้เงินหักค่าธรรมเนียม (+${gA4 - gA3})`);
  assert(buyRes.character.gold < gB1 - 80 + 1, 'B จ่ายเงินซื้อสำเร็จ');

  // ---------------- เพื่อน + แชท ----------------
  console.log('--- เพื่อน + แชท ---');
  const meA = await api('/api/me', { token: A.token });
  await api('/api/social/friends/request', { method: 'POST', token: A.token, body: { targetName: meB.character.name } });
  let bFriends = await api('/api/social/friends', { token: B.token });
  assert(bFriends.incoming.length === 1, 'B ได้รับคำขอเป็นเพื่อน');
  await api('/api/social/friends/respond', { method: 'POST', token: B.token, body: { friendshipId: bFriends.incoming[0].friendshipId, accept: true } });
  bFriends = await api('/api/social/friends', { token: B.token });
  assert(bFriends.friends.length === 1, 'ตอบรับเป็นเพื่อนสำเร็จ');
  const aUserId = bFriends.friends[0].userId; // มุมมองของ B: เพื่อนคือ A

  const aFriends = await api('/api/social/friends', { token: A.token });
  const bUserId = aFriends.friends[0].userId; // มุมมองของ A: เพื่อนคือ B
  await api('/api/social/messages/send', { method: 'POST', token: A.token, body: { toUserId: bUserId, text: 'สวัสดี! ขอแลกการ์ดมั้ย' } });
  const conv = await api(`/api/social/messages/${aUserId}`, { token: B.token });
  assert(conv.messages.length === 1 && conv.messages[0].text.includes('สวัสดี'), 'ส่ง+อ่านข้อความสำเร็จ');
  // คนไม่ใช่เพื่อนส่งไม่ได้
  let strangerBlocked = false;
  const cFriends = await api('/api/social/friends', { token: C.token });
  void cFriends;
  try {
    await api('/api/social/messages/send', { method: 'POST', token: C.token, body: { toUserId: bFriends.friends[0].userId, text: 'spam' } });
  } catch (e) {
    strangerBlocked = e.message.includes('เพื่อน');
  }
  assert(strangerBlocked, 'คนที่ไม่ใช่เพื่อนส่งข้อความไม่ได้');

  // ---------------- กิลด์ ----------------
  console.log('--- กิลด์ ---');
  const gBefore = await gold(A.token);
  let guildCreated = null;
  try {
    guildCreated = await api('/api/guilds/create', { method: 'POST', token: A.token, body: { name: `Phoenix${s}`, emblem: '🔥', description: 'กิลด์ทดสอบ' } });
  } catch (e) {
    throw new Error('สร้างกิลด์ไม่ได้: ' + e.message);
  }
  assert(gBefore - guildCreated.character.gold === 1000, 'ค่าสร้างกิลด์ 1000 ทองถูกหัก');
  await api(`/api/guilds/${guildCreated.guild.id}/join`, { method: 'POST', token: B.token });
  const bGuild = await api('/api/guilds/mine', { token: B.token });
  assert(bGuild.guild.members.length === 2, 'B เข้าร่วมกิลด์ สมาชิก = 2');
  await api('/api/guilds/messages/send', { method: 'POST', token: B.token, body: { text: 'หวัดดีทุกคน' } });
  const gChat = await api('/api/guilds/messages', { token: A.token });
  assert(gChat.messages.length === 1, 'แชทกิลด์ทำงาน');
  // ไล่สมาชิก (leader = A)
  await api('/api/guilds/kick', { method: 'POST', token: A.token, body: { targetUserId: bGuild.guild.members.find((m) => m.userName === meB.character.name).userId } });
  const aGuild2 = await api('/api/guilds/mine', { token: A.token });
  assert(aGuild2.guild.members.length === 1, 'หัวกิลด์ไล่สมาชิกสำเร็จ');

  // ---------------- เควสต์ผู้เล่น ----------------
  console.log('--- เควสต์ผู้เล่น ---');
  // C (เงินไม่โดนใช้) ตั้งเควสต์ขอ "แร่ทองแดง" 3 ใบ ราคา 25/ใบ (ราคาฐาน 16 → ผ่าน)
  const goldC5 = await gold(C.token);
  const quest = await api('/api/pquests/create', {
    method: 'POST', token: C.token,
    body: { templateId: 'ore_copper', quantity: 3, goldPerUnit: 25 },
  });
  assert(goldC5 - quest.character.gold === 75 + 8, 'หักเงินฝาก 75 + ค่าธรรมเนียม 8 ทอง');

  // B ขุดแร่ให้ได้แร่ทองแดง ≥ 1 ใบ (ขุดซ้ำจนได้)
  let tries = 0;
  let found = null;
  while (!found && tries < 25) {
    tries++;
    await api('/api/gather', { method: 'POST', token: B.token, body: { zone: 'mine' } }).catch(() => {});
    found = await findCard(B.token, 'ore_copper', 'INVENTORY');
  }
  assert(found != null, `B ขุดเจอแร่ทองแดง (ครั้งที่ ${tries})`);

  const goldB5 = await gold(B.token);
  const deliver = await api(`/api/pquests/${quest.quest.id}/deliver`, {
    method: 'POST', token: B.token, body: { serials: [found.id] },
  });
  assert(deliver.payout === 25, `B ส่งมอบ 1 ใบ ได้รางวัล 25 ทอง (คืบหน้า ${deliver.delivered}/3)`);
  const gotCard = await findCard(C.token, 'ore_copper', 'INVENTORY');
  assert(gotCard != null && gotCard.id === found.id, 'การ์ดโอนถึงผู้ตั้งเควสต์ (serial ตรงกัน)');

  // C ยกเลิก → คืนเงินคงเหลือ 50
  const goldC6 = await gold(C.token);
  const cancel = await api(`/api/pquests/${quest.quest.id}/cancel`, { method: 'POST', token: C.token });
  const goldC7 = await gold(C.token);
  assert(goldC7 - goldC6 === 50, 'ยกเลิกเควสต์ คืนเงินฝากคงเหลือ 50 ทอง (25×2)');
  void goldB5; void cancel;

  // ---------------- แอดมิน ----------------
  console.log('--- แอดมิน ---');
  let forbidden = false;
  try {
    await api('/api/admin/stats', { token: A.token });
  } catch {
    forbidden = true;
  }
  assert(forbidden, 'ผู้เล่นทั่วไปเข้า API แอดมินไม่ได้ (403)');

  console.log('=== ทุกการทดสอบเฟส 2 ผ่าน ✔ ===');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
