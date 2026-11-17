import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_NAME_TH, DECK_MIN, EQUIP_SLOTS, PET_EQUIP_MAX, STAT_NAME_TH, TOOL_CATEGORIES } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, InventoryCard } from '../dto';
import CardView from '../components/CardView';
import Modal from '../components/Modal';

export default function DeckPage() {
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [cards, setCards] = useState<InventoryCard[]>([]);
  const [selected, setSelected] = useState<InventoryCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'deck' | 'equip' | 'pet' | 'tool'>('deck');

  const load = useCallback(async () => {
    const res = await api<{ cards: InventoryCard[] }>('/api/inventory');
    setCards(res.cards);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function doAction(action: string, card: InventoryCard) {
    setBusy(true);
    try {
      const res = await api<{ message: string; character: CharacterDTO }>(`/api/cards/${card.id}/action`, { method: 'POST', body: { action } });
      setCharacter(res.character);
      showToast(res.message);
      setSelected(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  if (!character) return null;
  const deckCards = cards.filter((c) => c.status === 'IN_DECK');
  const deckOk = character.deckCount >= DECK_MIN;
  const equippedPets = character.equipment.filter((e) => e.slot === 'pet');
  const equippedCount = EQUIP_SLOTS.filter((s) => character.equipment.some((e) => e.slot === s)).length;
  const equippedTools = character.equipment.filter((e) => TOOL_CATEGORIES.includes(e.slot as never));
  const equippedToolCount = TOOL_CATEGORIES.filter((c) => equippedTools.some((t) => t.slot === c)).length;

  const TABS: { key: 'deck' | 'equip' | 'pet' | 'tool'; label: string }[] = [
    { key: 'deck', label: `เดคต่อสู้ (${character.deckCount})` },
    { key: 'equip', label: `ช่องสวมใส่ (${equippedCount}/${EQUIP_SLOTS.length})` },
    { key: 'pet', label: `สัตว์เลี้ยง (${equippedPets.length}/${PET_EQUIP_MAX})` },
    { key: 'tool', label: `เครื่องมือ (${equippedToolCount}/${TOOL_CATEGORIES.length})` },
  ];

  return (
    <div className="page-grid" style={{ gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <div className="tabs" style={{ marginBottom: 0 }}>
        {TABS.map((t) => (
          <div key={t.key} className={`chip${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'deck' && (
      <div className="panel">
        <div className="section-title">
           เดคต่อสู้ <span className="hint">{character.deckCount} ใบ — ไม่จำกัดจำนวน ซ้ำกี่ใบก็ได้ (ขั้นต่ำ {DECK_MIN} ใบเพื่อเข้าต่อสู้)</span>
        </div>
        {!deckOk && (
          <div className="panel" style={{ borderColor: 'var(--danger)', marginBottom: 12, padding: '10px 14px' }}>
             เดคต้องมีอย่างน้อย {DECK_MIN} ใบจึงเข้าต่อสู้ (PvP/ดันเจี้ยน) ได้ —{' '}
            <Link to="/inventory">ไปคลังเพื่อเพิ่มการ์ด</Link>
          </div>
        )}
        {deckCards.length === 0 ? (
          <div className="empty">ยังไม่มีการ์ดในเดค — เพิ่มจาก<a href="/inventory">คลังการ์ด</a></div>
        ) : (
          <div className="grid-cards-deck">
            {deckCards.map((c) => (
              <CardView key={c.id} card={c.card} showSerial={c.id} statusBadge="เดค" onClick={() => setSelected(c)} />
            ))}
          </div>
        )}
      </div>
      )}

      {tab === 'equip' && (
      <div className="panel">
        <div className="section-title"> ช่องสวมใส่ <span className="hint">บวกสเตตัสต่อสู้อัตโนมัติ</span></div>
        <div className="grid-cards-deck">
          {EQUIP_SLOTS.map((slot) => {
            const eq = character.equipment.find((e) => e.slot === slot);
            if (!eq || !eq.template) {
              return (
                <div key={slot} className="pcard rarity-C slot-empty">
                  <div className="pcard-inner" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6%', padding: '8%', textAlign: 'center', color: '#93a0b8', background: 'linear-gradient(170deg, #1a2238, #0d1120)', border: '2px solid #3d4a66', borderRadius: '6.2%' }}>
                    <div style={{ fontSize: '2.2rem' }}></div>
                    <div style={{ fontWeight: 800, color: '#c8d2e4' }}>{CATEGORY_NAME_TH[slot]}</div>
                    <div style={{ fontSize: '0.72rem' }}>หาอุปกรณ์มาใส่จากคราฟต์หรือดันเจี้ยนเพื่อบวกสเตตัส</div>
                  </div>
                </div>
              );
            }
            return (
              <CardView
                key={slot}
                card={eq.template}
                statusBadge="สวมใส่"
                showSerial={eq.instanceId}
                onClick={() => setSelected({ id: eq.instanceId, templateId: eq.templateId, card: eq.template!, status: 'EQUIPPED', slot: eq.slot })}
              />
            );
          })}
        </div>
      </div>
      )}

      {tab === 'pet' && (
      <div className="panel">
        <div className="section-title"> สัตว์เลี้ยง <span className="hint">สวมใส่สูงสุด {PET_EQUIP_MAX} ตัว — เข้าสนามอัตโนมัติตั้งแต่เริ่มต่อสู้ ไม่ต้องลงเดค</span></div>
        <div className="grid-cards-deck">
          {equippedPets.map((eq) => (
            <CardView
              key={eq.instanceId}
              card={eq.template!}
              statusBadge="สวมใส่"
              showSerial={eq.instanceId}
              onClick={() => setSelected({ id: eq.instanceId, templateId: eq.templateId, card: eq.template!, status: 'EQUIPPED', slot: eq.slot })}
            />
          ))}
          {Array.from({ length: PET_EQUIP_MAX - equippedPets.length }, (_, i) => (
            <div key={`pet-slot-${i}`} className="pcard rarity-C slot-empty">
              <div className="pcard-inner" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6%', padding: '8%', textAlign: 'center', color: '#93a0b8', background: 'linear-gradient(170deg, #1a2238, #0d1120)', border: '2px solid #3d4a66', borderRadius: '6.2%' }}>
                <div style={{ fontSize: '2.2rem' }}></div>
                <div style={{ fontWeight: 800, color: '#c8d2e4' }}>ช่องสัตว์เลี้ยง {i + 1}</div>
                <div style={{ fontSize: '0.72rem' }}>หาสัตว์เลี้ยงจากป่า/กาชา แล้วกดสวมใส่จากคลัง</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {tab === 'tool' && (
      <div className="panel">
        <div className="section-title"> เครื่องมือ <span className="hint">สวมใส่ติดตัว จอบ/ขวาน ชนิดละ 1 ช่อง — ต้องมีจึงเข้าเหมือง/ป่า (เกรดยิ่งสูงยิ่งเจอของดี)</span></div>
        <div className="grid-cards-deck">
          {TOOL_CATEGORIES.map((cat) => {
            const tool = equippedTools.find((t) => t.slot === cat);
            if (tool && tool.template) {
              return (
                <CardView
                  key={cat}
                  card={tool.template}
                  statusBadge="สวมใส่"
                  showSerial={tool.instanceId}
                  onClick={() => setSelected({ id: tool.instanceId, templateId: tool.templateId, card: tool.template!, status: 'EQUIPPED', slot: tool.slot })}
                />
              );
            }
            return (
              <div key={cat} className="pcard rarity-C slot-empty">
                <div className="pcard-inner" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6%', padding: '8%', textAlign: 'center', color: '#93a0b8', background: 'linear-gradient(170deg, #1a2238, #0d1120)', border: '2px solid #3d4a66', borderRadius: '6.2%' }}>
                  <div style={{ fontSize: '2.2rem' }}></div>
                  <div style={{ fontWeight: 800, color: '#c8d2e4' }}>{CATEGORY_NAME_TH[cat]}</div>
                  <div style={{ fontSize: '0.72rem' }}>คราฟต์จากไม้+แร่ หรือซื้อจากร้านมือสอง แล้วกดสวมใส่จากคลัง</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {selected && (
        <Modal title={selected.card.name} onClose={() => setSelected(null)} wide>
          <div className="card-detail">
            <div className="big-card-wrap">
              <CardView
                card={selected.card}
                statusBadge={selected.status === 'EQUIPPED' ? 'สวมใส่' : 'ในเดค'}
                showSerial={selected.id}
                size="xl"
              />
            </div>
            <div>
              <dl className="kv">
                <dt>หมวด</dt><dd>{CATEGORY_NAME_TH[selected.card.category]}</dd>
                {selected.slot && <><dt>ช่อง</dt><dd>{CATEGORY_NAME_TH[selected.slot as keyof typeof CATEGORY_NAME_TH]}</dd></>}
                {selected.card.equip && Object.entries(selected.card.equip).map(([k, v]) => (
                  [<dt key={`${k}t`}>{STAT_NAME_TH[k as keyof typeof STAT_NAME_TH]}</dt>, <dd key={`${k}d`}>+{v}</dd>]
                ))}
              </dl>
            </div>
          </div>
          <div className="modal-actions">
            {selected.status === 'EQUIPPED' && (
              <button className="btn" disabled={busy} onClick={() => void doAction('unequip', selected)}> ถอดออก</button>
            )}
            {selected.status === 'IN_DECK' && (
              <button className="btn" disabled={busy} onClick={() => void doAction('removeDeck', selected)}> นำออกจากเดค</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
