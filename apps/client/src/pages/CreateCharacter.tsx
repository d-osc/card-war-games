import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO } from '../dto';

export default function CreateCharacterPage() {
  const navigate = useNavigate();
  const refresh = useStore((s) => s.refresh);
  const token = useStore((s) => s.token);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    navigate('/login');
  }

  async function create() {
    setBusy(true);
    setError('');
    try {
      await api<{ character: CharacterDTO }>('/api/character', {
        method: 'POST',
        body: { name },
      });
      await refresh();
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างตัวละครไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap" style={{ justifyContent: 'flex-start', paddingTop: '8dvh' }}>
      <div className="logo" style={{ fontSize: '2.6rem' }}></div>
      <h1 style={{ fontSize: '1.4rem' }}>สร้างตัวละคร</h1>
      <div className="login-box panel" style={{ display: 'grid', gap: 16 }}>
        <div>
          <div className="bar-label"><span>ชื่อตัวละคร</span><span>2-20 ตัวอักษร (ห้ามซ้ำ)</span></div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="ตั้งชื่อวีรบุรุษของคุณ" />
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
          ทุกคนเริ่มต้นเท่ากัน — สเตตัสและสไตล์การเล่นของคุณขึ้นกับ <b>การจัดเดค</b> อุปกรณ์ที่สวมใส่
          และการลงแต้มสเตตัสเอง (เลเวลละ 3 แต้ม) เท่านั้น
        </p>

        <button className="btn primary big" disabled={busy || name.trim().length < 2} onClick={() => void create()}>
           เริ่มการผจญภัย (รับเดคเริ่มต้น 20 ใบ + อุปกรณ์ + เครื่องมือ)
        </button>
        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      </div>
    </div>
  );
}
