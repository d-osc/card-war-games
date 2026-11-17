import { useCallback, useEffect, useRef, useState } from 'react';
import { TOOL_REPAIR_GOLD_PER_TIER, toolMaxDurability } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, InventoryCard } from '../dto';
import Icon from '../components/Icon';
import CardView from '../components/CardView';

interface ActionResponse {
  message: string;
  character: CharacterDTO;
}

// ===========================================================================
// มินิเกมช่างตีเหล็ก — ตีให้โดนโซนทอง 10 ครั้ง แล้วคิดค่าความทนทานที่ซ่อมได้
// ซ่อมได้ = round(ความทนทานเต็ม × โดน ÷ 10) · ยิ่งรอบยาวโซนยิ่งแคบ เร็วขึ้น
// ===========================================================================
const ROUNDS = 10;

function ForgeMiniGame({ card, onDone, onCancel }: { card: InventoryCard; onDone: (hits: number) => void; onCancel: () => void }) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [marker, setMarker] = useState(0);
  const [zone, setZone] = useState({ start: 40, width: 18 });
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [done, setDone] = useState(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const lockRef = useRef(false);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const max = toolMaxDurability(card.card.tier);
  const cost = card.card.tier * TOOL_REPAIR_GOLD_PER_TIER;
  const speed = 55 + round * 10; // % ต่อวินาที — เร็วขึ้นทุกรอบ

  useEffect(() => {
    // สุ่มตำแหน่งโซน + แคบลงเรื่อย ๆ ตามรอบ
    const width = Math.max(10, 20 - round);
    setZone({ start: 12 + Math.random() * (76 - width), width });
    posRef.current = 0;
    dirRef.current = 1;
    setMarker(0);
    lockRef.current = false;
  }, [round]);

  useEffect(() => {
    if (done) return;
    const step = (t: number) => {
      const dt = lastRef.current ? (t - lastRef.current) / 1000 : 0;
      lastRef.current = t;
      if (!lockRef.current) {
        let p = posRef.current + dirRef.current * speed * dt;
        if (p >= 100) { p = 100; dirRef.current = -1; }
        if (p <= 0) { p = 0; dirRef.current = 1; }
        posRef.current = p;
        setMarker(p);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, done]);

  function strike() {
    if (done || lockRef.current) return;
    lockRef.current = true;
    const p = posRef.current;
    const ok = p >= zone.start && p <= zone.start + zone.width;
    setFlash(ok ? 'hit' : 'miss');
    if (ok) setHits((h) => h + 1);
    setTimeout(() => {
      setFlash(null);
      if (round + 1 >= ROUNDS) setDone(true);
      else setRound((r) => r + 1);
    }, 400);
  }

  // Space = ตี
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        strike();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cur = card.durability ?? max;
  const gain = done ? Math.min(max - cur, Math.round((max * hits) / ROUNDS)) : 0;

  return (
    <div className="forge-game">
      <div className="forge-head">
        <span className="forge-title"><Icon name="pickaxe" size={18} /> ช่างตีเหล็ก: {card.card.name}</span>
        <span className="forge-progress">ครั้งที่ {Math.min(round + 1, ROUNDS)}/{ROUNDS} · โดน {hits}</span>
      </div>

      {!done ? (
        <>
          <div className={`forge-track${flash ? ` ${flash}` : ''}`}>
            <div className="forge-zone" style={{ left: `${zone.start}%`, width: `${zone.width}%` }} />
            <div className="forge-marker" style={{ left: `${marker}%` }}>
              <span className="forge-hammer"><Icon name="axe" size={22} /></span>
            </div>
          </div>
          <button className="btn primary big forge-strike" onClick={strike}>
            ตี! (Space)
          </button>
          <p className="forge-hint">กดตอนสัญลักษณ์อยู่ในโซนสีทอง — โดน {hits}/{ROUNDS} ครั้งจะยิ่งซ่อมได้เยอะ</p>
        </>
      ) : (
        <div className="forge-result">
          <div className="forge-score">
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span key={i} className={`dot${i < hits ? ' on' : ''}`} />
            ))}
          </div>
          <p className="forge-big">โดน {hits}/{ROUNDS} ครั้ง</p>
          {hits > 0 ? (
            <>
              <p>ความทนทาน {cur} → <b>{cur + gain}</b> (+{gain}) · จ่ายค่าซ่อมไปแล้ว {cost} ทอง</p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn primary big" onClick={() => onDone(hits)}>
                  <Icon name="pickaxe" size={16} /> นำผลการตีมาซ่อม (+{gain})
                </button>
              </div>
            </>
          ) : (
            <>
              <p>ตีไม่โดนเลย… ค่าซ่อม {cost} ทองที่จ่ายไปเสียฟรี — ลองใหม่อีกครั้ง</p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={onCancel}>ปิด</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// ร้านซ่อมเครื่องมือ — ดูความทนทานทุกใบ + มินิเกมซ่อมทีละใบ หรือซ่อมทั้งหมดแบบเต็ม
// ===========================================================================
export default function RepairPage() {
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const [tools, setTools] = useState<InventoryCard[]>([]);
  const [selected, setSelected] = useState<InventoryCard | null>(null);
  const [mini, setMini] = useState<InventoryCard | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ cards: InventoryCard[] }>('/api/inventory');
    setTools(res.cards.filter((c) => c.card.group === 'tool' && (c.status === 'INVENTORY' || c.status === 'EQUIPPED')));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const duraOf = (c: InventoryCard) => c.durability ?? toolMaxDurability(c.card.tier);
  const maxOf = (c: InventoryCard) => toolMaxDurability(c.card.tier);
  const costOf = (c: InventoryCard) => c.card.tier * TOOL_REPAIR_GOLD_PER_TIER;
  const needsRepair = (c: InventoryCard) => duraOf(c) < maxOf(c);
  const brokenList = tools.filter(needsRepair);
  const totalCost = brokenList.reduce((a, c) => a + costOf(c), 0);

  /** จ่ายค่าซ่อมก่อน — หักทองสำเร็จแล้วค่อยเปิดมินิเกม (เสียแล้วเสียเลย) */
  async function payAndStart(card: InventoryCard) {
    setBusy(true);
    try {
      const res = await api<ActionResponse>(`/api/cards/${card.id}/action`, { method: 'POST', body: { action: 'repairPay' } });
      setCharacter(res.character);
      setMini(card);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'จ่ายค่าซ่อมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  /** นำผลมินิเกมมาซ่อม — เงินจ่ายไปแล้ว ขั้นนี้ไม่คิดอีก */
  async function applyHits(serial: number, hits: number) {
    setBusy(true);
    try {
      const res = await api<ActionResponse>(`/api/cards/${serial}/action`, { method: 'POST', body: { action: 'repairApply', hits } });
      showToast(res.message);
      setMini(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ซ่อมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function repairAll() {
    setBusy(true);
    try {
      let done = 0;
      let spent = 0;
      for (const c of brokenList) {
        // ซ่อมทั้งหมด = จ้างช่างมืออาชีพ ตีเต็ม 10/10 ให้เลย (ไม่ต้องเล่นมินิเกม)
        const res = await api<ActionResponse>(`/api/cards/${c.id}/action`, { method: 'POST', body: { action: 'repair', hits: 10 } });
        setCharacter(res.character);
        done += 1;
        spent += costOf(c);
      }
      showToast(done > 0 ? `ซ่อมทั้งหมด ${done} ชิ้น (−${spent} ทอง)` : 'ไม่มีเครื่องมือที่ต้องซ่อม');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ซ่อมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid" style={{ alignContent: 'start' }}>
      <div className="panel">
        <div className="section-title">
           ร้านซ่อมเครื่องมือ <span className="hint">ค่าซ่อม {TOOL_REPAIR_GOLD_PER_TIER} ทอง × เกรด คืนความทนทานเต็ม — คุณมี {character?.gold ?? 0} ทอง</span>
        </div>

        {tools.length === 0 && (
          <div className="empty">ยังไม่มีการ์ดเครื่องมือ — คราฟต์จากโรงคราฟต์ หรือซื้อจากร้านมือสอง</div>
        )}

        {tools.length > 0 && (
          <div className="repair-list">
            {tools.map((c) => {
              const cur = duraOf(c);
              const max = maxOf(c);
              const pct = Math.max(0, Math.min(100, (cur / max) * 100));
              return (
                <div key={c.id} className={`repair-row${cur <= 0 ? ' broken' : ''}`} onClick={() => setSelected(c)}>
                  <div className="repair-card-mini">
                    <CardView
                      card={c.card}
                      statusBadge={c.status === 'EQUIPPED' ? 'สวมใส่' : undefined}
                      durability={{ cur: duraOf(c), max: maxOf(c) }}
                    />
                  </div>
                  <div className="repair-info">
                    <div className="repair-name">
                      {c.card.name} <span className="hint">เกรด {''.repeat(c.card.tier)}</span>
                      {cur <= 0 && <span className="repair-broken-tag"><Icon name="cancel" size={12} /> พัง — ใช้งานไม่ได้</span>}
                    </div>
                    <div className="bar stam">
                      <div className="fill" style={{ width: `${pct}%` }} />
                      <span className="bar-num">{cur}/{max}</span>
                    </div>
                  </div>
                  <div className="repair-action">
                    {needsRepair(c) ? (
                      <button
                        className="btn accent sm"
                        disabled={busy || (character ? character.gold < costOf(c) : true)}
                        onClick={(e) => { e.stopPropagation(); void payAndStart(c); }}
                      >
                        <Icon name="gold" size={14} /> จ่าย {costOf(c)} เพื่อตีซ่อม
                      </button>
                    ) : (
                      <span className="repair-ok"><Icon name="check" size={14} /> สภาพดี</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {brokenList.length > 1 && (
          <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button
              className="btn primary"
              disabled={busy || (character ? character.gold < totalCost : true)}
              onClick={() => void repairAll()}
            >
              <Icon name="pickaxe" size={16} /> ซ่อมทั้งหมด {brokenList.length} ชิ้น ({totalCost} ทอง)
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-shell">
            <button className="modal-close" onClick={() => setSelected(null)} title="ปิด" aria-label="ปิด">
              <Icon name="cancel" size={16} />
            </button>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{selected.card.name}</h3>
              <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
                <div className="big-card-wrap" style={{ width: 200 }}>
                  <CardView card={selected.card} showSerial={selected.id} size="lg" />
                </div>
                <div className="bar stam" style={{ width: '100%', maxWidth: 280 }}>
                  <div className="fill" style={{ width: `${Math.max(0, Math.min(100, (duraOf(selected) / maxOf(selected)) * 100))}%` }} />
                  <span className="bar-num">{duraOf(selected)}/{maxOf(selected)}</span>
                </div>
                {needsRepair(selected) ? (
                  <button
                    className="btn primary big"
                    disabled={busy || (character ? character.gold < costOf(selected) : true)}
                    onClick={() => { setSelected(null); void payAndStart(selected); }}
                  >
                    <Icon name="gold" size={16} /> จ่าย {costOf(selected)} ทองเพื่อตีซ่อม
                  </button>
                ) : (
                  <p style={{ color: 'var(--muted)', margin: 0 }}><Icon name="check" size={14} /> เครื่องมือสภาพดี ไม่ต้องซ่อม</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {mini && (
        <div className="modal-overlay">
          <div className="modal-shell">
            <div className="modal forge-modal">
              <ForgeMiniGame
                card={mini}
                onDone={(hits) => void applyHits(mini.id, hits)}
                onCancel={() => setMini(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
