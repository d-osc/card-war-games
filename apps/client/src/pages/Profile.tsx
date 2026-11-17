import { useState } from 'react';
import { ALLOCATABLE_STATS, STAT_NAME_TH } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO } from '../dto';
import Icon from '../components/Icon';

const PER_POINT: Record<string, { label: string; amount: number }> = {
  hp: { label: ' พลังชีวิต', amount: 10 },
  hpRegen: { label: ' ฟื้นพลังชีวิต/เทิร์น', amount: 1 },
  atk: { label: ' โจมตี', amount: 2 },
  def: { label: ' ป้องกัน', amount: 2 },
  matk: { label: ' เวทมนต์', amount: 2 },
  mdef: { label: ' ต้านเวท', amount: 2 },
  spd: { label: ' ความเร็ว', amount: 1 },
  luck: { label: ' โชค', amount: 1 },
  manaMax: { label: ' มานาสูงสุด', amount: 6 },
  stamMax: { label: ' กำลังสูงสุด', amount: 6 },
};

export default function ProfilePage() {
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  if (!character) return null;

  async function allocate(stat: string) {
    setBusy(true);
    try {
      const res = await api<{ character: CharacterDTO }>('/api/stats/allocate', { method: 'POST', body: { stat, points: 1 } });
      setCharacter(res.character);
      showToast(`ลงแต้ม ${STAT_NAME_TH[stat as keyof typeof STAT_NAME_TH]} แล้ว`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ลงแต้มไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid">
      <div className="panel hero-card">
        <div className="hero-emoji"><Icon name="profile" size={52} /></div>
        <div className="info">
          <div className="name">{character.name} <span style={{ color: 'var(--gold)' }}>Lv.{character.level}</span></div>
          <div className="sub">
             เรตติ้ง {character.rating} ·  {character.wins}ชนะ {character.losses}แพ้ ·  ผ่านดันเจี้ยนชั้น {character.highestFloor}/5
          </div>
          <div className="hero-vitals">
            <div className="bar hp"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, (character.hp / character.stats.hp) * 100))}%` }} /><span className="bar-num">{character.hp}/{character.stats.hp}</span></div>
            <div className="bar mana"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, (character.mana / character.stats.manaMax) * 100))}%` }} /><span className="bar-num">{character.mana}/{character.stats.manaMax}</span></div>
            <div className="bar stam"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, (character.stam / character.stats.stamMax) * 100))}%` }} /><span className="bar-num">{character.stam}/{character.stats.stamMax}</span></div>
          </div>
          <div className="sub" style={{ marginBottom: 0 }}>สไตล์การเล่นขึ้นกับเดค อุปกรณ์ และแต้มสเตตัสที่คุณเลือกเอง — ใน battle ฟื้นต่อเทิร์นตามสเตตัส · นอก battle ฟื้น ❤️ตามสถิติ 🔵1 ⚡1 ต่อรอบ รอบละ 60 − (⏩×2) นาที (ต่ำสุด 10)</div>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
           สเตตัสรวม <span className="hint">รวมอุปกรณ์ที่สวมใส่ทั้งหมด</span>
        </div>
        <div className="stat-grid">
          <div className="stat-cell"><span className="cell-label"><Icon name="heal" size={14} /> พลังชีวิต</span><b>{character.stats.hp}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="buffAtk" size={14} /> ฟื้น HP/เทิร์น</span><b>+{character.stats.hpRegen}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="buffAtk" size={14} /> โจมตี</span><b>{character.stats.atk}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="shield" size={14} /> ป้องกัน</span><b>{character.stats.def}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="magic" size={14} /> เวทมนต์</span><b>{character.stats.matk}</b></div>
          <div className="stat-cell"><span> ต้านเวท</span><b>{character.stats.mdef}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="spd" size={14} /> ความเร็ว</span><b>{character.stats.spd}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="gem" size={14} /> โชค</span><b>+{character.stats.luck}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="mana" size={14} /> มานา / ฟื้นต่อเทิร์น</span><b>{character.stats.manaMax} / +{character.stats.manaRegen}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="energy" size={14} /> กำลัง / ฟื้นต่อเทิร์น</span><b>{character.stats.stamMax} / +{character.stats.stamRegen}</b></div>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
           ลงแต้มสเตตัส <span className="hint">มีอยู่ {character.statPoints} แต้ม</span>
        </div>
        {character.statPoints === 0 && <div className="empty">ไม่มีแต้มคงเหลือ — เลเวลอัปเพื่อรับเพิ่ม (เลเวลละ 3 แต้ม)</div>}
        <div className="page-grid">
          {ALLOCATABLE_STATS.map((stat) => (
            <div key={stat} className="alloc-row">
              <span className="label">{PER_POINT[stat].label} +{PER_POINT[stat].amount}/แต้ม</span>
              <button className="btn sm primary" disabled={busy || character.statPoints <= 0} onClick={() => void allocate(stat)}>+1</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
