import { Link } from 'react-router-dom';
import { useStore } from '../stores';
import Icon from '../components/Icon';
import { QUEST_NAME_TH } from '@cardwar/shared';

const QUICK_LINKS: { to: string; ico: string; label: string }[] = [
  { to: '/pvp', ico: 'pvp', label: 'ประลอง PvP' },
  { to: '/dungeon', ico: 'dungeon', label: 'ดันเจี้ยน' },
  { to: '/mine', ico: 'mine', label: 'เหมืองขุดแร่' },
  { to: '/forest', ico: 'forest', label: 'ป่า' },
  { to: '/shop', ico: 'shop', label: 'ร้านค้า/กาชา' },
  { to: '/market', ico: 'market', label: 'ตลาดการ์ด' },
  { to: '/craft', ico: 'craft', label: 'คราฟต์' },
  { to: '/inventory', ico: 'inventory', label: 'คลังการ์ด' },
  { to: '/deck', ico: 'deck', label: 'จัดเดค' },
  { to: '/quests', ico: 'quests', label: 'เควสต์' },
  { to: '/pquests', ico: 'pquests', label: 'เควสต์ผู้เล่น' },
  { to: '/social', ico: 'social', label: 'เพื่อน/แชท' },
  { to: '/guild', ico: 'guild', label: 'กิลด์' },
];

export default function DashboardPage() {
  const character = useStore((s) => s.character);
  const quests = useStore((s) => s.quests);
  if (!character) return null;

  const xpPct = Math.min(100, (character.xp / character.xpNext) * 100);
  const activeQuests = quests.filter((q) => q.status === 'ACTIVE');

  return (
    <div className="page-grid">
      <div className="panel hero-card">
        <div className="hero-emoji"><Icon name="profile" size={52} /></div>
        <div className="info">
          <div className="name">{character.name} <span style={{ color: 'var(--gold)' }}>Lv.{character.level}</span></div>
          <div className="sub"> เรตติ้ง {character.rating} ·  {character.wins}ช {character.losses}แพ้ ·  ผ่านชั้น {character.highestFloor}/5</div>
          <div className="bar xp lg">
            <div className="fill" style={{ width: `${xpPct}%` }} />
          </div>
          <div className="bar-label"><span>XP {character.xp}/{character.xpNext}</span>{character.statPoints > 0 && <span style={{ color: 'var(--gold)' }}>มี {character.statPoints} แต้มสเตตัส — ไปหน้าโปรไฟล์เพื่อลงแต้ม</span>}</div>
        </div>
      </div>

      <div className="panel">
        <div className="section-title"> สเตตัสรวม (รวมอุปกรณ์)<span className="hint"><Link to="/profile">ลงแต้มสเตตัส</Link></span></div>
        <div className="stat-grid">
          <div className="stat-cell"><span className="cell-label"><Icon name="heal" size={14} /> พลังชีวิต</span><b>{character.stats.hp}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="buffAtk" size={14} /> โจมตี</span><b>{character.stats.atk}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="shield" size={14} /> ป้องกัน</span><b>{character.stats.def}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="magic" size={14} /> เวทมนต์</span><b>{character.stats.matk}</b></div>
          <div className="stat-cell"><span>  ต้านเวท</span><b>{character.stats.mdef}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="spd" size={14} /> ความเร็ว</span><b>{character.stats.spd}</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="mana" size={14} /> มานา</span><b>{character.stats.manaMax} (+{character.stats.manaRegen}/เทิร์น)</b></div>
          <div className="stat-cell"><span className="cell-label"><Icon name="energy" size={14} /> กำลัง</span><b>{character.stats.stamMax} (+{character.stats.stamRegen}/เทิร์น)</b></div>
        </div>
      </div>

      {activeQuests.length > 0 && (
        <div className="panel">
          <div className="section-title"> เควสต์รายชั่วโมง<span className="hint"><Link to="/quests">ดูทั้งหมด</Link></span></div>
          <div className="page-grid">
            {activeQuests.map((q) => (
              <div key={q.id} className="quest-card">
                <div className="q-ico"><Icon name="quests" size={24} /></div>
                <div className="q-main">
                  <div className="name">{QUEST_NAME_TH[q.type]} {q.type === 'CLEAR_FLOOR' ? `ชั้น ${q.target}` : `${q.progress}/${q.target}`}</div>
                  <div className="bar xp"><div className="fill" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }} /></div>
                </div>
                <div className="q-rewards"><span> {q.rewardGold}</span><span> {q.rewardXp}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="section-title"> ไปผจญภัย</div>
        <div className="quick-links">
          {QUICK_LINKS.map((l) => (
            <Link key={l.to} to={l.to}><span className="ico"><Icon name={l.ico} size={26} /></span>{l.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}
