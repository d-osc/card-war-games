import { useCallback, useEffect, useState } from 'react';
import { PLAYER_QUEST_FEE_RATE, PLAYER_QUEST_MAX_QTY, PLAYER_QUEST_MAX_XP_PER_UNIT, PLAYER_QUEST_XP_GOLD_RATE, cardById } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CatalogItemDTO, CharacterDTO, InventoryCard, PlayerQuestDTO } from '../dto';
import CardView, { artIconName } from '../components/CardView';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import CardPicker from '../components/CardPicker';

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function PlayerQuestsPage() {
  const [tab, setTab] = useState<'board' | 'mine' | 'create'>('board');
  const [board, setBoard] = useState<PlayerQuestDTO[]>([]);
  const [mine, setMine] = useState<PlayerQuestDTO[]>([]);
  const [catalog, setCatalog] = useState<CatalogItemDTO[]>([]);
  const [form, setForm] = useState({ templateId: 'ore_iron', quantity: 3, goldPerUnit: 0, xpPerUnit: 0 });
  const [deliverTarget, setDeliverTarget] = useState<PlayerQuestDTO | null>(null);
  const [myCards, setMyCards] = useState<InventoryCard[]>([]);
  const [sel, setSel] = useState(new Set<number>());
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);

  const load = useCallback(async () => {
    try {
      const b = await api<{ quests: PlayerQuestDTO[] }>('/api/pquests');
      setBoard(b.quests);
      const m = await api<{ quests: PlayerQuestDTO[] }>('/api/pquests/mine');
      setMine(m.quests);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    void api<{ templates: CatalogItemDTO[] }>('/api/pquests/catalog').then((r) => {
      setCatalog(r.templates);
      setForm((f) => ({ ...f, goldPerUnit: f.goldPerUnit || r.templates.find((t) => t.id === f.templateId)?.basePrice || 0 }));
    }).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (deliverTarget) {
      void api<{ cards: InventoryCard[] }>('/api/inventory').then((r) => {
        setMyCards(r.cards.filter((c) => c.status === 'INVENTORY' && c.templateId === deliverTarget.wanted.id));
      });
    }
  }, [deliverTarget]);

  const selectedCatalog = catalog.find((c) => c.id === form.templateId);
  const totalReward = form.quantity * form.goldPerUnit;
  const fee = Math.ceil(totalReward * PLAYER_QUEST_FEE_RATE);
  const xpTotal = form.quantity * form.xpPerUnit;
  const xpCost = Math.ceil(xpTotal * PLAYER_QUEST_XP_GOLD_RATE);

  async function createQuest() {
    setBusy(true);
    try {
      const res = await api<{ quest: PlayerQuestDTO; character: CharacterDTO }>('/api/pquests/create', {
        method: 'POST',
        body: { templateId: form.templateId, quantity: form.quantity, goldPerUnit: form.goldPerUnit, xpPerUnit: form.xpPerUnit },
      });
      setCharacter(res.character);
      showToast(`ตั้งเควสต์สำเร็จ! ฝากรางวัลไว้ ${totalReward} ทอง + ค่าธรรมเนียม ${fee}${xpCost > 0 ? ` + ค่ารางวัล XP ${xpCost} ทอง (ได้ ${xpTotal} XP รวม)` : ''}`);
      setTab('mine');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ตั้งเควสต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function deliver() {
    if (!deliverTarget || sel.size === 0) return;
    setBusy(true);
    try {
      const res = await api<{ message: string; character: CharacterDTO }>(`/api/pquests/${deliverTarget.id}/deliver`, {
        method: 'POST',
        body: { serials: [...sel] },
      });
      setCharacter(res.character);
      showToast(res.message);
      setDeliverTarget(null);
      setSel(new Set());
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ส่งมอบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function cancelQuest(id: number) {
    if (!window.confirm('ยกเลิกเควสต์? เงินรางวัลที่ยังไม่ถูกรับจะคืนให้ (ค่าธรรมเนียมไม่คืน)')) return;
    try {
      const res = await api<{ message: string; character: CharacterDTO }>(`/api/pquests/${id}/cancel`, { method: 'POST' });
      setCharacter(res.character);
      showToast(res.message);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tabs">
        <div className={`chip${tab === 'board' ? ' active' : ''}`} onClick={() => { setTab('board'); void load(); }}> กระดานเควสต์</div>
        <div className={`chip${tab === 'mine' ? ' active' : ''}`} onClick={() => { setTab('mine'); void load(); }}> เควสต์ของฉัน ({mine.filter((q) => q.status === 'OPEN').length})</div>
        <div className={`chip${tab === 'create' ? ' active' : ''}`} onClick={() => setTab('create')}> ตั้งเควสต์ใหม่</div>
      </div>

      <div className="pquests-body">

      {tab === 'board' && (
        <div>
          {board.length === 0 && <div className="empty">ยังไม่มีเควสต์เปิด — ตั้งเควสต์รับการ์ดที่คุณต้องการ หรือหาการ์ดส่งมอบให้คนอื่นเพื่อรับทอง!</div>}
          {board.map((q) => (
            <div key={q.id} className="quest-board-row">
              <div className={`listing-emoji rarity-art-${q.wanted.rarity}`}><Icon name={artIconName(q.wanted) ?? 'deck'} size={30} /></div>
              <div className="info">
                <div style={{ fontWeight: 800 }}>
                  ต้องการ {q.wanted.name} <span className={`rarity-text-${q.wanted.rarity}`}>[{q.wanted.rarity}]</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                  โดย {q.creatorName} · ส่งแล้ว {q.delivered}/{q.quantity} · ราคาฐาน {q.wanted.basePrice}/ใบ
                </div>
              </div>
              <div className="price" style={{ fontWeight: 800, color: 'var(--gold)' }}> {q.goldPerUnit.toLocaleString('th-TH')}/ใบ{q.xpPerUnit > 0 && <span style={{ color: 'var(--accent)' }}> +{q.xpPerUnit} XP</span>}</div>
              {!q.isMine && (
                <button className="btn sm primary" onClick={() => { setDeliverTarget(q); setSel(new Set()); }}>
                  ส่งมอบ (รับ {q.goldPerUnit}/ใบ)
                </button>
              )}
              {q.isMine && <span className="badge gold">ของคุณ</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {mine.length === 0 && <div className="empty">คุณยังไม่ได้ตั้งเควสต์ — กดแท็บ "ตั้งเควสต์ใหม่"</div>}
          {mine.map((q) => (
            <div key={q.id} className="quest-board-row">
              <div className={`listing-emoji rarity-art-${q.wanted.rarity}`}><Icon name={artIconName(q.wanted) ?? 'deck'} size={30} /></div>
              <div className="info">
                <div style={{ fontWeight: 800 }}>
                  {q.wanted.name} {q.status === 'OPEN' ? <span className="badge blue">เปิดรับ</span> : q.status === 'DONE' ? <span className="badge gold">สำเร็จ</span> : <span className="badge">ยกเลิก</span>}
                </div>
                <div className="bar xp" style={{ margin: '6px 0' }}>
                  <div className="fill" style={{ width: `${Math.min(100, (q.delivered / q.quantity) * 100)}%` }} />
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                  ส่งแล้ว {q.delivered}/{q.quantity} · {q.goldPerUnit} ทอง/ใบ{q.xpPerUnit > 0 ? ` +${q.xpPerUnit} XP/ใบ` : ''} · รวม {q.totalReward.toLocaleString('th-TH')} ทอง
                </div>
              </div>
              {q.status === 'OPEN' && (
                <button className="btn sm danger" onClick={() => void cancelQuest(q.id)}>ยกเลิก (คืนเงินคงเหลือ)</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'create' && (
        <div className="panel" style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
          <div className="section-title"> ตั้งเควสต์รับซื้อการ์ด <span className="hint">เงินรางวัลฝากไว้กับระบบ</span></div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div className="bar-label"><span>การ์ดที่ต้องการ (1 การ์ด/เควสต์)</span></div>
              <div className="wanted-card-row">
                {selectedCatalog && cardById(selectedCatalog.id) ? (
                  <div className="wanted-card-preview" onClick={() => setPickerOpen(true)}>
                    <CardView card={cardById(selectedCatalog.id)!} />
                  </div>
                ) : (
                  <div className="wanted-card-empty" onClick={() => setPickerOpen(true)}>
                    <Icon name="deck" size={34} />
                    <span>ยังไม่ได้เลือกการ์ด<br />แตะเพื่อค้นหา</span>
                  </div>
                )}
                <div className="wanted-card-info">
                  <div style={{ fontWeight: 800 }}>
                    {selectedCatalog
                      ? <>{selectedCatalog.name} <span className={`rarity-text-${selectedCatalog.rarity}`}>[{selectedCatalog.rarity}]</span></>
                      : <span style={{ color: 'var(--muted)' }}>เลือกการ์ดที่ต้องการรับซื้อ</span>}
                  </div>
                  {selectedCatalog && (
                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>ราคาฐาน {selectedCatalog.basePrice} ทอง/ใบ</div>
                  )}
                  <button className="btn primary" onClick={() => setPickerOpen(true)}>
                    <Icon name="deck" size={15} /> ค้นหาการ์ด
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div>
                <div className="bar-label"><span>จำนวน (1-{PLAYER_QUEST_MAX_QTY})</span></div>
                <input className="input" type="number" min={1} max={PLAYER_QUEST_MAX_QTY} value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, Math.min(PLAYER_QUEST_MAX_QTY, Number(e.target.value) || 1)) })} />
              </div>
              <div>
                <div className="bar-label"><span>รางวัลทอง/ใบ (≥ {selectedCatalog?.basePrice ?? 0})</span></div>
                <input className="input" type="number" min={selectedCatalog?.basePrice ?? 1} value={form.goldPerUnit}
                  onChange={(e) => setForm({ ...form, goldPerUnit: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <div className="bar-label"><span>รางวัล XP/ใบ (0-{PLAYER_QUEST_MAX_XP_PER_UNIT}) · 1 ทอง = 10 XP</span></div>
                <input className="input" type="number" min={0} max={PLAYER_QUEST_MAX_XP_PER_UNIT} value={form.xpPerUnit}
                  onChange={(e) => setForm({ ...form, xpPerUnit: Math.max(0, Math.min(PLAYER_QUEST_MAX_XP_PER_UNIT, Math.floor(Number(e.target.value) || 0))) })} />
              </div>
            </div>
            <div className="panel" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                <span>เงินรางวัลรวม (ฝากไว้กับระบบ)</span><b style={{ color: 'var(--gold)' }}>{totalReward.toLocaleString('th-TH')} ทอง</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                <span>ค่าธรรมเนียมตั้งเควสต์ ({Math.round(PLAYER_QUEST_FEE_RATE * 100)}%)</span><b style={{ color: 'var(--danger)' }}>{fee.toLocaleString('th-TH')} ทอง</b>
              </div>
              {xpTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                  <span>ค่ารางวัล XP รวม {xpTotal.toLocaleString('th-TH')} XP (1 ทอง = 10 XP)</span>
                  <b style={{ color: 'var(--danger)' }}>{xpCost.toLocaleString('th-TH')} ทอง</b>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginTop: 4 }}>
                <span>หักทั้งหมดตอนตั้ง</span><b>{(totalReward + fee + xpCost).toLocaleString('th-TH')} ทอง</b>
              </div>
            </div>
            <button className="btn primary big" disabled={busy || !form.templateId || form.goldPerUnit < (selectedCatalog?.basePrice ?? 0)} onClick={() => void createQuest()}>
               ตั้งเควสต์
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', margin: 0 }}>
              ผู้เล่นคนอื่นที่มีการ์ดตรงตามชนิดสามารถส่งมอบแลกทองได้ทันที การ์ดจะส่งตรงถึงคลังของคุณ
            </p>
          </div>
        </div>
      )}

      </div>

      <CardPicker
        open={pickerOpen}
        title="เลือกการ์ดที่ต้องการรับซื้อ"
        selectedId={form.templateId}
        onSelect={(id) => {
          const t = catalog.find((c) => c.id === id);
          setForm((f) => ({ ...f, templateId: id, goldPerUnit: t?.basePrice ?? f.goldPerUnit }));
        }}
        onClose={() => setPickerOpen(false)}
      />

      {deliverTarget && (
        <Modal title={`ส่งมอบ ${deliverTarget.wanted.name} (รับ ${deliverTarget.goldPerUnit} ทอง/ใบ)`} onClose={() => setDeliverTarget(null)}>
          {myCards.length === 0 ? (
            <div className="empty">คุณไม่มี {deliverTarget.wanted.name} ในคลัง — หามาก่อนแล้วค่อยมาส่งมอบ!</div>
          ) : (
            <>
              <div className="bar-label">
                <span>เลือก {sel.size} ใบ (เควสต์รับอีก {deliverTarget.remaining} ใบ)</span>
                <span>จะได้รับ {sel.size * deliverTarget.goldPerUnit} ทอง{deliverTarget.xpPerUnit > 0 ? ` + ${sel.size * deliverTarget.xpPerUnit} XP` : ''}</span>
              </div>
              <div className="craft-select-list">
                {myCards.map((c) => (
                  <CardView key={c.id} card={c.card} showSerial={c.id} selected={sel.has(c.id)} onClick={() => setSel((s) => toggle(s, c.id))} />
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn primary" disabled={busy || sel.size === 0 || sel.size > deliverTarget.remaining} onClick={() => void deliver()}>
                  ยืนยันส่งมอบ {sel.size} ใบ
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
