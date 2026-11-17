import { useMemo, useState } from 'react';
import { cardById, allTemplates } from '@cardwar/shared';
import type { CardTemplate } from '@cardwar/shared';
import CardView from './CardView';
import Icon from './Icon';
import Modal from './Modal';

// ===========================================================================
// เลือกการ์ดจากแคตตาล็อกทั้งเกม — dialog เต็มจอ
// ค้นหาด้วยชื่อ + กรองหายาก · แตะการ์ดดูใหญ่ · กด "เลือกการ์ดนี้" ยืนยัน
// ===========================================================================

export default function CardPicker({ open, title, selectedId, onSelect, onClose }: {
  open: boolean;
  title: string;
  selectedId: string | null;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<string>('all');
  const [preview, setPreview] = useState<CardTemplate | null>(null);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allTemplates().filter((t) => t.group !== 'quest')
      .filter((t) => rarity === 'all' || t.rarity === rarity)
      .filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle))
      .sort((a, b) => a.rarity.localeCompare(b.rarity) || a.name.localeCompare(b.name, 'th'));
  }, [q, rarity]);

  if (!open) return null;

  const RARITY_FILTERS = ['all', 'C', 'UC', 'R', 'SR', 'SSR'];

  return (
    <div className="fs-dialog">
      <div className="fs-dialog-head">
        <button className="back-btn" onClick={onClose} title="ปิด">
          <Icon name="home" size={18} />
        </button>
        <div className="fs-dialog-title">{title}</div>
        <div className="fs-dialog-search">
          <input
            className="input"
            type="text"
            placeholder="ค้นหาการ์ด… (ชื่อ / รหัส)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      <div className="tabs hscroll fs-dialog-filters">
        {RARITY_FILTERS.map((r) => (
          <div key={r} className={`chip${rarity === r ? ' active' : ''}`} onClick={() => setRarity(r)}>
            {r === 'all' ? 'ทั้งหมด' : r}
          </div>
        ))}
      </div>
      <div className="fs-dialog-body">
        {items.length === 0 ? (
          <div className="empty">ไม่พบการ์ดที่ค้นหา</div>
        ) : (
          <div className="fs-card-grid">
            {items.map((t) => (
              <CardView
                key={t.id}
                card={t}
                selected={t.id === selectedId}
                onClick={() => setPreview(t)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="fs-dialog-foot">
        {selectedId && cardById(selectedId)
          ? <>เลือกอยู่: <b>{cardById(selectedId)!.name}</b> [{cardById(selectedId)!.rarity}]</>
          : 'ยังไม่ได้เลือกการ์ด'}
      </div>

      {preview && (
        <Modal title={preview.name} onClose={() => setPreview(null)}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <div style={{ width: 210 }}>
              <CardView card={preview} />
            </div>
            <div className="q-rewards" style={{ justifyContent: 'center', display: 'flex', gap: 14 }}>
              <span className={`rarity-text-${preview.rarity}`}>[{preview.rarity}]</span>
              <span> ราคาฐาน {preview.basePrice}</span>
            </div>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setPreview(null)}>ปิด</button>
              <button
                className="btn primary"
                onClick={() => { onSelect(preview.id); setPreview(null); onClose(); }}
              >
                <Icon name="check" size={16} /> เลือกการ์ดนี้
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
