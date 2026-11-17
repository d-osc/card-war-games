import { useEffect, useState } from 'react';
import { cardById, QUEST_COOLDOWN_MS } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { QuestDTO } from '../dto';
import Icon from '../components/Icon';

function useCountdown() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return Date.now();
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const QUEST_ICON: Record<string, string> = {
  GATHER_MINE: 'mine',
  GATHER_FOREST: 'forest',
  WIN_PVP: 'pvp',
  CLEAR_FLOOR: 'dungeon',
  CRAFT: 'craft',
  GACHA: 'gacha',
};

export default function QuestsPage() {
  const quests = useStore((s) => s.quests);
  const setQuests = useStore((s) => s.setQuests);
  const now = useCountdown();

  useEffect(() => {
    const load = () => void api<{ quests: QuestDTO[] }>('/api/quests').then((r) => setQuests(r.quests)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [setQuests]);

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 0 }}>
         ระบบสุ่มเควสต์ให้ 3 ชิ้นเสมอ — ทำสำเร็จรับรางวัลทันที ช่องนั้นจะคูลดาวน์ 1 ชั่วโมง แล้วสุ่มเควสต์ใหม่ให้
      </p>
      <div className="page-grid">
        {quests.map((q) => {
          const active = q.status === 'ACTIVE';
          const cdLeft = q.cooldownUntil ? new Date(q.cooldownUntil).getTime() - now : 0;
          return (
            <div key={q.id} className={`quest-card${active ? '' : ' cooldown'}`}>
              <div className="q-ico"><Icon name={QUEST_ICON[q.type] ?? 'quests'} size={26} /></div>
              <div className="q-main">
                <div className="name">{q.name}{q.type === 'CLEAR_FLOOR' ? ` ชั้น ${q.target}` : ''}</div>
                {active ? (
                  <>
                    <div className="bar xp"><div className="fill" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }} /></div>
                    <div className="bar-label">
                      <span>{q.type === 'CLEAR_FLOOR' ? `ต้องพิชิตชั้น ${q.target} (สูงกว่าก็ได้)` : `ความคืบหน้า ${q.progress}/${q.target}`}</span>
                    </div>
                  </>
                ) : (
                  <div className="bar-label">
                    <span>ทำสำเร็จแล้ว! สุ่มเควสต์ใหม่ในอีก {fmt(cdLeft)}</span>
                  </div>
                )}
              </div>
              <div className="q-rewards">
                <span> {q.rewardGold}</span>
                <span> {q.rewardXp}</span>
                {q.rewardCard && <span> {cardById(q.rewardCard).emoji} {cardById(q.rewardCard).name}</span>}
              </div>
            </div>
          );
        })}
        {quests.length === 0 && <div className="empty">กำลังสุ่มเควสต์…</div>}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
        คูลดาวน์ {QUEST_COOLDOWN_MS / 60000} นาทีต่อช่อง · ความคืบหนับอัปเดตอัตโนมัติจากกิจกรรมจริงในเกม
      </p>
    </div>
  );
}
