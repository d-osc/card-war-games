import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useStore } from '../stores';

// ===========================================================================
// Layout — full screen ปุ่มกลับ Lobby อยู่ใน content ของแต่ละหน้า
// class = fullpage-layout-{pagename} + fullpage-content-{pagename}
// ===========================================================================

const PAGES: Record<string, string> = {
  '/pvp': 'pvp',
  '/dungeon': 'dungeon',
  '/quests': 'quests',
  '/pquests': 'pquests',
  '/inventory': 'inventory',
  '/deck': 'deck',
  '/shop': 'shop',
  '/market': 'market',
  '/mine': 'mine',
  '/forest': 'forest',
  '/craft': 'craft',
  '/repair': 'repair',
  '/settings': 'settings',
  '/social': 'social',
  '/guild': 'guild',
  '/profile': 'profile',
  '/battle': 'battle',
  '/admin': 'admin',
};

const TITLES: Record<string, string> = {
  '/pvp': 'ประลอง PvP',
  '/dungeon': 'ดันเจี้ยน',
  '/quests': 'เควสต์รายชั่วโมง',
  '/pquests': 'เควสต์ผู้เล่น',
  '/inventory': 'คลังการ์ด',
  '/deck': 'เดค + อุปกรณ์',
  '/shop': 'ร้านค้ากลาง',
  '/market': 'ตลาดการ์ดผู้เล่น',
  '/mine': 'เหมืองขุดแร่',
  '/forest': 'ป่าลึก',
  '/craft': 'โรงคราฟต์',
  '/repair': 'ร้านซ่อมเครื่องมือ',
  '/social': 'เพื่อน + ข้อความ',
  '/guild': 'กิลด์',
  '/profile': 'โปรไฟล์',
  '/settings': 'ตั้งค่า',
  '/battle': 'สนามประลอง',
  '/admin': 'แผงควบคุมแอดมิน',
};

export default function Layout() {
  const location = useLocation();
  const title = TITLES[location.pathname] ?? 'Card War';
  const pageName = PAGES[location.pathname] ?? 'default';
  const character = useStore((s) => s.character);

  return (
    <div className={`fullpage-layout fullpage-layout-${pageName}`}>
      <main className={`fullpage-content fullpage-content-${pageName}`}>
        {/* ปุ่มกลับ Lobby + ชื่อหน้า + ทองมุมขวา — อยู่ใน content ของแต่ละหน้า (ยกเว้น battle) */}
        {location.pathname !== '/battle' && (
          <div className="page-header">
            <NavLink to="/" className="back-btn" title="กลับ Lobby">
              <Icon name="home" size={18} />
            </NavLink>
            <span className="page-title">{title}</span>
            {character && (
              <span className="header-gold" title="ทองของคุณ">
                <Icon name="gold" size={15} /> {character.gold.toLocaleString()}
              </span>
            )}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
