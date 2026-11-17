// สคริปต์ทดสอบ battle จริงผ่าน Socket.io: PvP 2 บอท + PvE กับมอนสเตอร์
// วิธีใช้: (server ต้องรันอยู่ที่ :4000) node scripts/test-battle.mjs
import { io } from 'socket.io-client';

const API = 'http://localhost:4000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
  return data;
}

async function createUser(name) {
  const login = await api('/api/auth/dev', { method: 'POST', body: { name } });
  const token = login.token;
  const me = await api('/api/me', { token });
  if (!me.character) {
    await api('/api/character', { method: 'POST', body: { name: name + 'Char', classId: 'swordsman' }, token });
  }
  return token;
}

function makePlayer(token, label) {
  const sock = io(API, { auth: { token } });
  const p = { sock, label, state: null, over: null, rewards: null, battleId: null, errors: [] };
  sock.on('battle:state', (m) => { p.state = m; p.battleId = m.battleId; });
  sock.on('battle:over', (m) => { p.over = m; });
  sock.on('battle:rewards', (m) => { p.rewards = m; });
  sock.on('battle:error', (m) => p.errors.push(m.message));
  return p;
}

async function waitConnected(p) {
  for (let i = 0; i < 50; i++) {
    if (p.sock.connected) return;
    await sleep(100);
  }
  throw new Error(`${p.label} connect ไม่ได้`);
}

/** เล่นเทิร์นอัตโนมัติ: ลองเล่นการ์ดทีละใบ (server จะ reject ถ้าเล่นไม่ได้) แล้วจบเทิร์น */
async function autoTurn(p) {
  const st = p.state;
  if (!st || !st.started || st.state.phase !== 'playing') return;
  const me = st.you === 'a' ? st.state.a : st.state.b;
  const isMyTurn = st.state.active === st.you;
  if (!isMyTurn) return;
  for (const h of [...me.hand]) {
    const before = p.state;
    if (before.state.phase !== 'playing' || before.state.active !== st.you) break;
    p.sock.emit('battle:action', { battleId: p.battleId, type: 'play', handUid: h.uid });
    await sleep(260);
  }
  const cur = p.state;
  if (cur && cur.state.phase === 'playing' && cur.state.active === st.you) {
    p.sock.emit('battle:action', { battleId: p.battleId, type: 'endTurn' });
    await sleep(350);
  }
}

async function runBattle(players, maxMs = 150_000) {
  const t0 = Date.now();
  let lastLog = 0;
  while (Date.now() - t0 < maxMs) {
    if (players.some((p) => p.over)) break;
    for (const p of players) await autoTurn(p);
    await sleep(200);
    if (Date.now() - lastLog > 3000) {
      lastLog = Date.now();
      const s = players[0].state;
      if (s) {
        console.log(`  [${Math.round((Date.now() - t0) / 1000)}s] turn ${s.state.turnNo} active=${s.state.active} hp a=${s.state.a.hp}/${s.state.a.maxHp} b=${s.state.b.hp}/${s.state.b.maxHp} started=${s.started} errors=${players[0].errors.length}`);
      }
    }
  }
  return players.every((p) => p.over);
}

async function main() {
  const suffix = Date.now() % 100000;
  console.log('=== สร้างผู้เล่นทดสอบ 2 คน ===');
  const [t1, t2] = await Promise.all([createUser(`BotA${suffix}`), createUser(`BotB${suffix}`)]);
  const A = makePlayer(t1, 'A');
  const B = makePlayer(t2, 'B');
  await Promise.all([waitConnected(A), waitConnected(B)]);
  console.log('connected ✔');

  // ---------------- PvP ----------------
  console.log('=== PvP: เข้าคิวทั้งสองฝ่าย ===');
  let matched = 0;
  A.sock.on('queue:matched', (m) => { matched++; A.battleId = m.battleId; });
  B.sock.on('queue:matched', (m) => { matched++; B.battleId = m.battleId; });
  A.sock.emit('pvp:queue');
  await sleep(150);
  B.sock.emit('pvp:queue');
  for (let i = 0; i < 50 && matched < 2; i++) await sleep(100);
  if (matched < 2) throw new Error('จับคู่ไม่สำเร็จ');
  console.log('matched ✔', A.battleId);
  A.sock.emit('battle:join', { battleId: A.battleId });
  B.sock.emit('battle:join', { battleId: A.battleId });
  await sleep(600);
  console.log('PvP started ✔ — turn', A.state?.state.turnNo, 'A deck', A.state?.state.a.deck.length, 'cards, hand', A.state?.state.a.hand.length);

  const pvpDone = await runBattle([A, B]);
  if (!pvpDone) throw new Error('PvP ไม่จบภายในเวลา');
  console.log(`PvP จบ ✔ ผู้ชนะ: ${A.over.winner} เหตุ: ${A.over.reason}`);
  const meA = await api('/api/me', { token: t1 });
  console.log('A rating หลังแข่ง:', meA.character.rating, 'สถิติ', meA.character.wins + 'W/' + meA.character.losses + 'L');
  const meB = await api('/api/me', { token: t2 });
  console.log('B rating หลังแข่ง:', meB.character.rating, 'สถิติ', meB.character.wins + 'W/' + meB.character.losses + 'L');

  // ---------------- PvE ----------------
  console.log('=== PvE: ท้าดันเจี้ยนชั้น 1 ===');
  A.over = null; A.state = null; A.rewards = null;
  A.sock.emit('pve:start', { floor: 1 });
  for (let i = 0; i < 50 && !A.state; i++) await sleep(100);
  if (!A.state) throw new Error('เริ่ม PvE ไม่สำเร็จ: ' + A.errors.join(', '));
  const monsterName = A.state.state.b.name;
  console.log(`PvE started ✔ vs ${monsterName}`);
  const pveDone = await runBattle([A]);
  if (!pveDone) throw new Error('PvE ไม่จบภายในเวลา');
  console.log(`PvE จบ ✔ ผู้ชนะ: ${A.over.winner} เหตุ: ${A.over.reason}`);
  if (A.rewards) {
    console.log('รางวัล:', 'gold', A.rewards.gold, 'xp', A.rewards.xp, 'การ์ด drop:', A.rewards.cards?.length ?? 0, 'ใบ, highestFloor:', A.rewards.character.highestFloor);
  }

  console.log('=== ทุกการทดสอบผ่าน ✔ ===');
  A.sock.disconnect();
  B.sock.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
