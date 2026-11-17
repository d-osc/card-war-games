import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DECK_MIN, DUNGEON_FLOORS } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import { getSocket } from '../socket';
import Icon from '../components/Icon';

const MONSTER_ICONS: Record<string, string> = {
  'สไลม์เขียว': 'slime',
  'ก็อบลินโจรป่า': 'goblin',
  'ราชาหมาป่า': 'wolf',
  'โกเลมหินโบราณ': 'golem',
  'มังกรเพลิง': 'dragon',
};

interface DungeonInfo {
  highestFloor: number;
  monsters: { floor: number; name: string; emoji: string; level: number; xp: number; goldMin: number; goldMax: number }[];
}

export default function DungeonPage() {
  const [info, setInfo] = useState<DungeonInfo | null>(null);
  const navigate = useNavigate();
  const showToast = useStore((s) => s.showToast);
  const character = useStore((s) => s.character);

  useEffect(() => {
    void api<DungeonInfo>('/api/dungeon').then(setInfo).catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onStarted = (msg: { battleId: string }) => {
      navigate(`/battle?b=${encodeURIComponent(msg.battleId)}`);
    };
    const onError = (msg: { message: string }) => showToast(msg.message);
    socket.on('pve:started', onStarted);
    socket.on('battle:error', onError);
    return () => {
      socket.off('pve:started', onStarted);
      socket.off('battle:error', onError);
    };
  }, [navigate, showToast]);

  function start(floor: number) {
    if (!character || character.deckCount < DECK_MIN) {
      showToast(`เดคต้องมีอย่างน้อย ${DECK_MIN} ใบก่อนลงดันเจี้ยน (ตอนนี้ ${character?.deckCount ?? 0})`);
      return;
    }
    getSocket().emit('pve:start', { floor });
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 0 }}>
         ดันเจี้ยน 5 ชั้น — มอนสเตอร์คุมด้วย AI ทุกตัว drop การ์ดตามอัตราที่ตั้งไว้ ผ่านชั้นเพื่อเปิดชั้นถัดไป
        {info && <> (สถิติ: ผ่านชั้นสูงสุด {info.highestFloor}/{DUNGEON_FLOORS})</>}
      </p>
      <div className="floor-grid">
        {(info?.monsters ?? []).map((m) => {
          const locked = info ? m.floor > info.highestFloor + 1 : true;
          const cleared = info ? m.floor <= info.highestFloor : false;
          return (
            <div key={m.floor} className={`floor-card${locked ? ' locked' : ''}`}>
              <div className="emoji">{MONSTER_ICONS[m.name] ? <Icon name={MONSTER_ICONS[m.name]} size={54} className="monster-art" /> : m.emoji}</div>
              <div style={{ fontWeight: 800 }}>ชั้น {m.floor} — {m.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Lv.{m.level} ·  {m.xp} XP ·  {m.goldMin}-{m.goldMax}</div>
              {cleared && <div style={{ color: 'var(--success)', fontSize: '0.78rem', fontWeight: 700 }}> เคยพิชิตแล้ว</div>}
              {locked ? (
                <button className="btn" disabled> ต้องผ่านชั้นก่อนหน้า</button>
              ) : (
                <button className="btn primary" onClick={() => start(m.floor)}> ท้าประลอง</button>
              )}
            </div>
          );
        })}
      </div>
      {!info && <div className="empty">กำลังโหลดข้อมูลดันเจี้ยน…</div>}
    </div>
  );
}
