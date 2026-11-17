import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores';
import Icon from '../components/Icon';
import SwipeableContainer from '../components/SwipeableContainer';

// ===========================================================================
// Lobby — full-screen swipeable: 1 หน้า ต่อ 1 menu
// ===========================================================================

interface MenuEntry {
  to: string;
  icon: string;
  label: string;
  desc: string;
  desc2?: string;
  color?: string;
}

const MENUS: MenuEntry[] = [
  { to: '/pvp', icon: 'pvp', label: 'ประลอง PvP', desc: 'จับคู่แบบ Real-time', desc2: 'Elo Rating + ตารางอันดับ', color: '#f87171' },
  { to: '/dungeon', icon: 'dungeon', label: 'ดันเจี้ยน', desc: '5 ชั้น + มอนสเตอร์ AI', desc2: 'Drop การ์ดตามอัตรา', color: '#60a5fa' },
  { to: '/quests', icon: 'quests', label: 'เควสต์รายชั่วโมง', desc: 'สุ่มใหม่ทุกชั่วโมง', desc2: 'รางวัลทอง + XP + การ์ด', color: '#86efac' },
  { to: '/pquests', icon: 'pquests', label: 'เควสต์ผู้เล่น', desc: 'ตั้งรับซื้อการ์ด', desc2: 'ฝากรางวัล + ค่าธรรมเนียม', color: '#c084fc' },
  { to: '/inventory', icon: 'inventory', label: 'คลังการ์ด', desc: 'การ์ดทั้งหมดของคุณ', desc2: 'ใส่เดค + สวมใส่ + ขาย', color: '#f5b301' },
  { to: '/deck', icon: 'deck', label: 'เดค + อุปกรณ์', desc: 'จัดเดคไม่จำกัดใบ', desc2: 'สวมใส่อุปกรณ์ 9 ช่อง', color: '#38bdf8' },
  { to: '/mine', icon: 'mine', label: 'เหมืองขุดแร่', desc: 'ขุดหาการ์ดแร่', desc2: 'แร่ 80% + อัญมณี 20%', color: '#a78bfa' },
  { to: '/forest', icon: 'forest', label: 'ป่าลึก', desc: 'เก็บไม้ + สมุนไพร', desc2: 'โอกาสพบสัตว์เลี้ยง', color: '#3fb950' },
  { to: '/craft', icon: 'craft', label: 'โรงคราฟต์', desc: 'สร้างอุปกรณ์ + ยา + อาหาร', desc2: 'แร่แปรธาตุ + ปรุงยา + ทำอาหาร', color: '#f0883e' },
  { to: '/repair', icon: 'pickaxe', label: 'ร้านซ่อม', desc: 'ซ่อมเครื่องมือที่สึก', desc2: 'คืนความทนทานเต็ม', color: '#94a3b8' },
  { to: '/shop', icon: 'shop', label: 'ร้านค้า', desc: 'กาชา + มือสอง', desc2: 'สุ่มการ์ดใหม่ + ซื้อการ์ดผู้เล่น', color: '#f5b301' },
  { to: '/market', icon: 'market', label: 'ตลาดการ์ด', desc: 'ประมูล + ขายตรง', desc2: 'เสนอราคา + ระบุผู้เล่น', color: '#ec4899' },
  { to: '/social', icon: 'social', label: 'เพื่อน + แชท', desc: 'ส่งข้อความหากัน', desc2: 'เพิ่มเพื่อน + แชทสองต่อสอง', color: '#818cf8' },
  { to: '/guild', icon: 'guild', label: 'กิลด์', desc: 'รวมกลุ่มผู้เล่น', desc2: 'สร้าง + เข้าร่วม + แชทกิลด์', color: '#f5b301' },
  { to: '/profile', icon: 'profile', label: 'โปรไฟล์', desc: 'สเตตัส + ลงแต้ม', desc2: 'ออกจากระบบ', color: '#67e8f9' },
  { to: '/settings', icon: 'settings', label: 'ตั้งค่า', desc: 'ปรับการแสดงผล + ปุ่มลัด', desc2: 'ออกจากระบบ', color: '#94a3b8' },
];

function HeroPage() {
  const character = useStore((s) => s.character);
  if (!character) return null;
  const xpPct = Math.min(100, (character.xp / character.xpNext) * 100);
  const s = character.stats;
  return (
    <div className="lobby-single">
      <div className="lobby-hero">
        <div className="hero-emoji"><Icon name="profile" size={44} /></div>
        <div className="hero-info">
          <div className="hero-name">{character.name} <span className="lv">Lv.{character.level}</span></div>
          <div className="hero-sub">
            <span className="cell-label"><Icon name="gold" size={12} /> {character.gold.toLocaleString('th-TH')}</span>
            <span className="cell-label"><Icon name="trophy" size={12} /> {character.rating}</span>
          </div>
          <div className="bar xp"><div className="fill" style={{ width: `${xpPct}%` }} /></div>
          <div className="bar-label"><span>XP {character.xp}/{character.xpNext}</span>
            {character.statPoints > 0 && <span style={{ color: 'var(--gold)' }}>{character.statPoints} แต้ม</span>}
          </div>
        </div>
      </div>
      <div className="stat-grid" style={{ width: '100%', maxWidth: 360 }}>
        <div className="stat-cell"><span className="cell-label"><Icon name="heal" size={13} /> HP</span><b>{s.hp}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="buffAtk" size={13} /> ATK</span><b>{s.atk}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="magic" size={13} /> MATK</span><b>{s.matk}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="shield" size={13} /> DEF</span><b>{s.def}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="spd" size={13} /> SPD</span><b>{s.spd}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="mana" size={13} /> MP</span><b>{s.manaMax}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="check" size={13} /> ชนะ</span><b>{character.wins}</b></div>
        <div className="stat-cell"><span className="cell-label"><Icon name="cancel" size={13} /> แพ้</span><b>{character.losses}</b></div>
      </div>
      <div className="lobby-swipe-hint">
        <Icon name="cardPlay" size={14} /> ปัดซ้ายเพื่อดูเมนู →
      </div>
    </div>
  );
}

function MenuPage({ entry }: { entry: MenuEntry }) {
  const navigate = useNavigate();
  return (
    <div className="lobby-single">
      <div className="lobby-menu-icon" style={{ '--accent': entry.color ?? 'var(--gold)' } as React.CSSProperties}>
        <Icon name={entry.icon} size={72} />
      </div>
      <h2 className="lobby-menu-title">{entry.label}</h2>
      <p className="lobby-menu-desc">{entry.desc}</p>
      {entry.desc2 && <p className="lobby-menu-desc sub">{entry.desc2}</p>}
      <button className="btn primary big lobby-enter-btn" onClick={() => navigate(entry.to)}>
        เข้าสู่{entry.label}
      </button>
    </div>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const isAdmin = useStore((s) => s.user?.isAdmin);

  const pages = [
    { id: 'hero', label: 'ตัวละคร', icon: 'profile', content: <HeroPage /> },
    ...MENUS.map((entry) => ({
      id: entry.to,
      label: entry.label,
      icon: entry.icon,
      content: <MenuPage entry={entry} />,
    })),
  ];

  if (isAdmin) {
    pages.push({
      id: '/admin', label: 'แอดมิน', icon: 'admin',
      content: <MenuPage entry={{ to: '/admin', icon: 'admin', label: 'แผงแอดมิน', desc: 'สถิติระบบ + Ledger + ผู้เล่น', color: '#93c5fd' }} />,
    });
  }

  return (
    <div className="fullpage-layout-lobby">
      <SwipeableContainer pages={pages} />
    </div>
  );
}
