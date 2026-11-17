import { useNavigate } from 'react-router-dom';
import { useStore } from '../stores';
import { resetSocket } from '../socket';
import Icon from '../components/Icon';

// ===========================================================================
// ตั้งค่า — สลับเปิด/ปิด (เก็บใน localStorage ของเครื่อง) + ออกจากระบบ
// ===========================================================================

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="knob" />
    </button>
  );
}

function SettingRow({ icon, title, desc, value, onChange }: {
  icon: string;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="setting-row">
      <span className="setting-ico"><Icon name={icon} size={20} /></span>
      <div className="setting-info">
        <div className="setting-title">{title}</div>
        <div className="setting-desc">{desc}</div>
      </div>
      <Switch on={value} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const setSetting = useStore((s) => s.setSetting);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);

  function doLogout() {
    resetSocket();
    logout();
    navigate('/login');
  }

  return (
    <div className="page-grid" style={{ alignContent: 'start', maxWidth: 620, margin: '0 auto', width: '100%' }}>
      <div className="panel">
        <div className="section-title"><Icon name="settings" size={18} /> การแสดงผลและควบคุม</div>
        <SettingRow
          icon="sparkles"
          title="เอฟเฟกต์เคลื่อนไหว"
          desc="อนิเมชันและทรานซิชันต่าง ๆ — ปิดเพื่อความลื่นบนเครื่องอ่อน"
          value={settings.animations}
          onChange={(v) => setSetting('animations', v)}
        />
        <SettingRow
          icon="cardPlay"
          title="ปุ่ม Space ในมินิเกม"
          desc="กด Space ตี/หมุนแทนการคลิกปุ่ม"
          value={settings.keyboardShortcut}
          onChange={(v) => setSetting('keyboardShortcut', v)}
        />
        <SettingRow
          icon="deck"
          title="ลากเพื่อเลื่อนด้วยเมาส์"
          desc="กดค้างแล้วลากบน grid การ์ด/แถว chip เพื่อเลื่อน (มือถือใช้นิ้วได้อยู่แล้ว)"
          value={settings.dragScroll}
          onChange={(v) => setSetting('dragScroll', v)}
        />
      </div>

      <div className="panel">
        <div className="section-title"><Icon name="profile" size={18} /> บัญชี</div>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '0 0 10px' }}>
          ผู้ใช้: <b>{user?.name ?? '—'}</b>{user?.isAdmin ? ' (แอดมิน)' : ''}
        </p>
        <button className="btn danger" style={{ width: '100%' }} onClick={doLogout}>
          <Icon name="exit" size={16} /> ออกจากระบบ
        </button>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', margin: 0 }}>
        Card War — เกมการ์ดผจญภัย · การตั้งค่าเก็บไว้ในเครื่องของคุณ
      </p>
    </div>
  );
}
