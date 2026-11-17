// ทดสอบ Defense Prompt ใน PvE: หมอบโล่ → จบเทิร์น → มอนสเตอร์โจมตี → ต้องเห็น modal
import { io } from 'socket.io-client';
const API = 'http://localhost:4000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  return res.json().catch(() => ({}));
}

async function main() {
  const s = Date.now() % 100000;
  // สร้าง user ใหม่
  const login = await api('/api/auth/dev', { method: 'POST', body: { name: `DefModal${s}` } });
  const token = login.token;
  await api('/api/character', { method: 'POST', body: { name: `DefHero${s}` }, token });

  const sock = io(API, { auth: { token } });
  const p = { state: null, battleId: null, defensePrompt: null, resolved: false, errors: [] };
  sock.on('battle:state', (m) => { p.state = m; p.battleId = m.battleId; });
  sock.on('defense:prompt', (m) => { console.log('🛡️ DEFENSE PROMPT!', JSON.stringify({ hand: m.handShields?.length, slot: m.slotShields?.length })); p.defensePrompt = m; });
  sock.on('defense:resolved', () => { console.log('✅ defense resolved'); p.resolved = true; });
  sock.on('pve:started', (m) => { p.battleId = m.battleId; });

  await sleep(1000);
  console.log('--- เริ่ม PvE ชั้น 1 ---');
  sock.emit('pve:start', { floor: 1 });
  await sleep(2000);

  if (!p.state?.started) { await sleep(2000); }
  const me = p.state?.you === 'a' ? p.state.state.a : p.state.state.b;
  const myTurn = p.state?.state.active === p.state?.you;
  console.log(`started: ${p.state?.started} | you: ${p.state?.you} | myTurn: ${myTurn} | hand: ${me?.hand?.length}`);

  // ถ้าเทิร์นเรา: หมอบโล่ (ถ้ามี) หรือเล่นการ์ดอื่นแล้วจบเทิร์น
  if (myTurn) {
    // หาการ์ดโล่ในมือ
    const shieldHand = me.hand.find(h => h.templateId?.includes('shield'));
    if (shieldHand) {
      console.log('พบการ์ดโล่ในมือ — หมอบลงช่อง');
      sock.emit('battle:action', { battleId: p.battleId, type: 'place', handUid: shieldHand.uid });
      await sleep(500);
    } else {
      console.log('ไม่มีโล่ในมือ — หาจากเดค...');
      // จบเทิร์นเลย รอจั่วโล่
    }
    console.log('จบเทิร์น — รอมอนสเตอร์เล่น');
    sock.emit('battle:action', { battleId: p.battleId, type: 'endTurn' });
  }

  // รอมอนสเตอร์เล่นและ defense prompt
  console.log('รอ defense prompt...');
  for (let i = 0; i < 60 && !p.defensePrompt; i++) {
    await sleep(500);
    // ถ้ากลับมาเป็นเทิร์นเราแล้วไม่มี prompt — จบเทิร์นอีก
    if (p.state?.state.active === p.state?.you && !p.defensePrompt && i > 10) {
      // หาโล่อีก
      const me2 = p.state.you === 'a' ? p.state.state.a : p.state.state.b;
      const sh = me2.hand.find(h => h.templateId?.includes('shield'));
      if (sh && !me2.placedThisTurn) {
        console.log('พบโล่ในมือรอบใหม่ — หมอบ');
        sock.emit('battle:action', { battleId: p.battleId, type: 'place', handUid: sh.uid });
        await sleep(500);
      }
      sock.emit('battle:action', { battleId: p.battleId, type: 'endTurn' });
    }
  }

  if (p.defensePrompt) {
    console.log('✅ DEFENSE MODAL ขึ้นแล้ว!');
    console.log(`   ตัวเลือก: มือ ${p.defensePrompt.handShields?.length} ใบ, ช่อง ${p.defensePrompt.slotShields?.length} ใบ`);
    // เลือกไม่ป้องกัน
    sock.emit('battle:action', { battleId: p.battleId, type: 'defenseRespond', choice: 'skip' });
    await sleep(1000);
    console.log(`   หลัง skip: HP = ${p.state?.you === 'a' ? p.state.state.a.hp : p.state.state.b.hp}`);
  } else {
    console.log('❌ ไม่ได้รับ defense prompt ภายใน 30 วิ');
    // ตรวจ log
    const logs = p.state?.state?.log?.slice(-5) || [];
    console.log('   ล่าสุด:', logs.map(l => l.text.slice(0, 50)));
  }

  sock.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
