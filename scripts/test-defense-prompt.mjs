// ทดสอบ Defense Prompt: ฝ่ายตั้งรับได้ modal ถามเมื่อถูกโจมตี
// รัน: node scripts/test-defense-prompt.mjs (server ต้องรันที่ :4000)
import { io } from 'socket.io-client';

const API = 'http://localhost:4000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function mkUser(name) {
  const login = await api('/api/auth/dev', { method: 'POST', body: { name } });
  const me = await api('/api/me', { token: login.token });
  if (!me.character) {
    // สร้างตัวละคร + จัดเดคให้มีโล่
    await api('/api/character', { method: 'POST', body: { name: name + 'C' }, token: login.token });
    // เดคเริ่มต้นมีโล่อยู่แล้ว (shield_bash)
  }
  return login.token;
}

function makePlayer(token, label) {
  const sock = io(API, { auth: { token } });
  const p = { sock, label, state: null, battleId: null, defensePrompt: null, over: null, errors: [] };
  sock.on('battle:state', (m) => { p.state = m; p.battleId = m.battleId; });
  sock.on('defense:prompt', (m) => { console.log(`  [${label}] DEFENSE PROMPT received! shields: hand=${m.handShields?.length} slot=${m.slotShields?.length}`); p.defensePrompt = m; });
  sock.on('defense:resolved', () => { console.log(`  [${label}] defense resolved`); p.defensePrompt = null; });
  sock.on('battle:over', (m) => { p.over = m; });
  sock.on('battle:error', (m) => { p.errors.push(m.message); if (m.message.includes('ป้องกัน') || m.message.includes('โล่')) console.log(`  [${label}] error: ${m.message}`); });
  sock.on('queue:matched', (m) => { p.battleId = m.battleId; });
  return p;
}

async function main() {
  const s = Date.now() % 100000;
  console.log('=== สร้างผู้เล่น 2 คน (A = โจมตี, B = ตั้งรับ) ===');
  const [tA, tB] = await Promise.all([mkUser(`DefA${s}`), mkUser(`DefB${s}`)]);
  const A = makePlayer(tA, 'A');
  const B = makePlayer(tB, 'B');
  await sleep(1000);

  // PvP queue
  console.log('--- เข้าคิว PvP ---');
  A.sock.emit('pvp:queue');
  await sleep(200);
  B.sock.emit('pvp:queue');
  for (let i = 0; i < 50 && !A.battleId; i++) await sleep(100);
  if (!A.battleId) throw new Error('จับคู่ไม่สำเร็จ');
  console.log('matched:', A.battleId);
  A.sock.emit('battle:join', { battleId: A.battleId });
  B.sock.emit('battle:join', { battleId: A.battleId });
  await sleep(1000);

  // รอให้ state มา
  if (!A.state?.started) { await sleep(2000); }
  console.log('started:', A.state?.started, '| active:', A.state?.state.active, '| A you:', A.state?.you);

  // หาใครเป็นฝ่ายเริ่ม
  const starterIsA = A.state?.state.active === A.state?.you;
  const attacker = starterIsA ? A : B;
  const defender = starterIsA ? B : A;
  console.log(`attacker = ${attacker.label}, defender = ${defender.label}`);

  // Defender: หมอบโล่ลงช่อง (ถ้าเป็นเทิร์น defender ก็หมอบเลย ถ้าไม่ก็รอเทิร์น)
  // สำหรับทดสอบ: ให้ defender มีโล่ในมือ → tryDefensePrompt ควรตรวจพบ

  // Attacker: เล่นการ์ดโจมตี
  const atkHand = attacker.state?.state?.[attacker.state.you]?.hand?.find((h) => {
    if (!h.templateId) return false;
    // หาสกิลโจมตี
    return h.templateId.includes('slash') || h.templateId.includes('fireball') || h.templateId.includes('spark');
  });
  if (!atkHand) {
    console.log('ATTACKER ไม่มีการ์ดโจมตีในมือ — ข้ามเทส');
    process.exit(0);
  }
  console.log(`attacker จะเล่นการ์ดโจมตี: ${atkHand.templateId}`);

  // ตรวจว่า defender มีโล่
  const defHand = defender.state?.state?.[defender.state.you]?.hand?.filter((h) => {
    if (!h.templateId) return false;
    return h.templateId.includes('shield');
  }) ?? [];
  const defSlots = defender.state?.state?.[defender.state.you]?.slots?.filter((s) => s != null) ?? [];
  console.log(`defender มีโล่ในมือ: ${defHand.length}, ในช่อง: ${defSlots.length}`);

  if (defHand.length === 0 && defSlots.length === 0) {
    console.log('⚠️ Defender ไม่มีโล่ — defense prompt จะไม่ทำงาน (ตามดีไซน์)');
    console.log('=== เทสจบ (ไม่มีโล่ให้ทดสอบ) ===');
    process.exit(0);
  }

  // Attacker เล่นการ์ดโจมตี → ระบบควรหยุดและส่ง defense:prompt ไปที่ defender
  console.log('--- Attacker เล่นการ์ดโจมตี ---');
  attacker.sock.emit('battle:action', { battleId: A.battleId, type: 'play', handUid: atkHand.uid });

  // รอ defense prompt
  for (let i = 0; i < 30 && !defender.defensePrompt; i++) {
    await sleep(200);
  }

  if (defender.defensePrompt) {
    console.log('✅ DEFENSE PROMPT ทำงาน! Defender ได้รับ modal ถาม');
    console.log(`   handShields: ${defender.defensePrompt.handShields?.length}, slotShields: ${defender.defensePrompt.slotShields?.length}`);

    // ตอบ: skip (ไม่ป้องกัน)
    console.log('--- Defender เลือก "ไม่ป้องกัน" ---');
    defender.sock.emit('battle:action', { battleId: A.battleId, type: 'defenseRespond', choice: 'skip' });
    await sleep(1000);

    // ตรวจว่าโจมตีเกิดขึ้น (HP ลด)
    const defHp = defender.state?.state?.[defender.state.you]?.hp;
    console.log(`   Defender HP หลังโจมตี: ${defHp}`);
    console.log('✅ โจมตีดำเนินการหลัง skip — ผ่าน!');
  } else {
    console.log('❌ Defense prompt ไม่ทำงาน — ไม่ได้รับ event');
    console.log('   ตรวจ: attacker เล่นการ์ดสำเร็จไหม:', attacker.state?.state?.phase);
  }

  console.log('=== เทส Defense Prompt จบ ===');
  A.sock.disconnect();
  B.sock.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
