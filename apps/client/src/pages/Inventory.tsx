import Icon from '../components/Icon';
import { useCallback, useEffect, useState } from 'react';
import { CardGroup, CARD_TEMPLATES, DESTROY_REFUND_RATE, GROUP_NAME_TH, MARKET_FEE_RATE, MARKET_MIN_FEE, RARITY_NAME_TH, STAT_NAME_TH, SYSTEM_SHOP_MARKUP, AUCTION_DURATIONS_H, toolMaxDurability, TOOL_REPAIR_GOLD_PER_TIER } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, InventoryCard } from '../dto';
import CardView from '../components/CardView';
import Modal from '../components/Modal';

function marketFee(amount: number): number {
  return Math.max(MARKET_MIN_FEE, Math.ceil(amount * MARKET_FEE_RATE));
}

const GROUP_FILTERS: ('all' | CardGroup)[] = ['all', 'equipment', 'consumable', 'skill', 'pet', 'material', 'tool'];

interface ActionResponse {
  message: string;
  character: CharacterDTO;
}

export default function InventoryPage() {
  const [cards, setCards] = useState<InventoryCard[]>([]);
  const [filter, setFilter] = useState<'all' | CardGroup>('all');
  const [selected, setSelected] = useState<InventoryCard | null>(null);
  const [busy, setBusy] = useState(false);
  const [marketMode, setMarketMode] = useState<'auction' | 'direct' | null>(null);
  const [auctionForm, setAuctionForm] = useState({ startPrice: 0, buyoutPrice: '', hours: 12 });
  const [directForm, setDirectForm] = useState({ targetName: '', price: 0 });
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const character = useStore((s) => s.character);

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
      const res = await api<ActionResponse>(`/api/cards/${card.id}/action`, { method: 'POST', body: { action } });
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

  function openMarket(mode: 'auction' | 'direct') {
    if (!selected) return;
    setAuctionForm({ startPrice: selected.card.basePrice, buyoutPrice: '', hours: 12 });
    setDirectForm({ targetName: '', price: selected.card.basePrice });
    setMarketMode(mode);
  }

  async function submitMarket() {
    if (!selected) return;
    setBusy(true);
    try {
      if (marketMode === 'auction') {
        const res = await api<{ character: CharacterDTO }>('/api/market/auctions/create', {
          method: 'POST',
          body: {
            serial: selected.id,
            startPrice: auctionForm.startPrice,
            buyoutPrice: auctionForm.buyoutPrice ? Number(auctionForm.buyoutPrice) : null,
            hours: auctionForm.hours,
          },
        });
        setCharacter(res.character);
        showToast('ตั้งประมูลสำเร็จ! ดูรายการได้ที่หน้าตลาดการ์ด');
      } else {
        const res = await api<{ character: CharacterDTO }>('/api/market/direct/create', {
          method: 'POST',
          body: { serial: selected.id, targetName: directForm.targetName.trim(), price: directForm.price },
        });
        setCharacter(res.character);
        showToast(`ตั้งขายตรงให้ ${directForm.targetName.trim()} แล้ว (48 ชม.)`);
      }
      setMarketMode(null);
      setSelected(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ตั้งขายไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const filtered = filter === 'all' ? cards : cards.filter((c) => c.card.group === filter);
  const counts = new Map<string, number>();
  for (const c of cards) counts.set(c.card.group, (counts.get(c.card.group) ?? 0) + 1);

  const sel = selected;

  return (
    <div>
      <div className="tabs">
        {GROUP_FILTERS.map((g) => (
          <div key={g} className={`chip${filter === g ? ' active' : ''}`} onClick={() => setFilter(g)}>
            {g === 'all' ? `ทั้งหมด (${cards.length})` : `${GROUP_NAME_TH[g]} (${counts.get(g) ?? 0})`}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">ยังไม่มีการ์ดในหมวดนี้ — ไปขุดแร่ เก็บของป่า ตีดันเจี้ยน หรือกาชากันเถอะ!</div>
      ) : (
        <div className="grid-cards">
          {filtered.map((c) => (
            <CardView
              key={c.id}
              card={c.card}
              showSerial={c.id}
              statusBadge={c.status === 'IN_DECK' ? 'เดค' : c.status === 'EQUIPPED' ? 'สวมใส่' : c.status === 'SHOP' ? 'วางขาย' : undefined}
              durability={c.card.group === 'tool' ? { cur: c.durability ?? toolMaxDurability(c.card.tier), max: toolMaxDurability(c.card.tier) } : undefined}
              onClick={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {sel && (
        <Modal title="รายละเอียดการ์ด" onClose={() => setSelected(null)} wide>
          <div className="card-detail">
            <div className="big-card-wrap">
              <CardView
                card={sel.card}
                showSerial={sel.id}
                statusBadge={sel.status === 'IN_DECK' ? 'ในเดค' : sel.status === 'EQUIPPED' ? 'สวมใส่' : sel.status === 'SHOP' ? 'วางขาย' : undefined}
                durability={sel.card.group === 'tool' ? { cur: sel.durability ?? toolMaxDurability(sel.card.tier), max: toolMaxDurability(sel.card.tier) } : undefined}
                size="xl"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{sel.card.name} <span className={`rarity-text-${sel.card.rarity}`}>[{sel.card.rarity} · {RARITY_NAME_TH[sel.card.rarity]}]</span></div>
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 8 }}>#{sel.id} · {sel.card.description}</div>
              {sel.card.group === 'equipment' && sel.card.equip && (
                <dl className="kv">
                  {Object.entries(sel.card.equip).map(([k, v]) => (
                    [<dt key={`${k}t`}>{STAT_NAME_TH[k as keyof typeof STAT_NAME_TH]}</dt>, <dd key={`${k}d`}>+{v}</dd>]
                  ))}
                </dl>
              )}
              <dl className="kv">
                <dt>ราคาฐานของระบบ</dt><dd> {sel.card.basePrice.toLocaleString('th-TH')}</dd>
                <dt>ขายคืนระบบได้</dt><dd> {sel.card.basePrice.toLocaleString('th-TH')} (ระบบขายต่อ {Math.ceil(sel.card.basePrice * SYSTEM_SHOP_MARKUP)})</dd>
                <dt>ทำลายได้ทองคืน</dt><dd> {Math.floor(sel.card.basePrice * DESTROY_REFUND_RATE)}</dd>
                {sel.card.shardCost > 0 && <><dt>ค่าอัญเชิญ</dt><dd> {sel.card.shardCost}</dd></>}
              </dl>
            </div>
          </div>

          <div className="modal-actions">
            {sel.status === 'IN_DECK' && (
              <button className="btn" disabled={busy} onClick={() => void doAction('removeDeck', sel)}><Icon name="cancel" size={14} /> นำออกจากเดค</button>
            )}
            {sel.status === 'EQUIPPED' && (
              <button className="btn" disabled={busy} onClick={() => void doAction('unequip', sel)}><Icon name="cancel" size={14} /> ถอดออก</button>
            )}
            {sel.card.group === 'tool' && sel.status !== 'SHOP' && (sel.durability ?? toolMaxDurability(sel.card.tier)) < toolMaxDurability(sel.card.tier) && (
              <button className="btn accent" disabled={busy} onClick={() => void doAction('repair', sel)}>
                <Icon name="pickaxe" size={14} /> ซ่อม ({sel.card.tier * TOOL_REPAIR_GOLD_PER_TIER} ทอง)
              </button>
            )}
            {sel.status === 'SHOP' && <div className="empty" style={{ padding: 8 }}>การ์ดใบนี้ถูกวางขายในร้านมือสองอยู่</div>}
            {sel.status === 'INVENTORY' && (
              <>
                {(sel.card.group === 'equipment' || sel.card.group === 'pet' || sel.card.group === 'tool') && (
                  <button className="btn primary" disabled={busy} onClick={() => void doAction('equip', sel)}> สวมใส่</button>
                )}
                {sel.card.category === 'food' && sel.card.consumable?.energy && (
                  <button className="btn accent" disabled={busy} onClick={() => void doAction('use', sel)}> กินเพื่อฟื้นพลังงาน</button>
                )}
                {(sel.card.group === 'skill' || sel.card.group === 'consumable') && (
                  <button className="btn accent" disabled={busy} onClick={() => void doAction('addDeck', sel)}> ใส่เดค</button>
                )}
                <button className="btn" disabled={busy} onClick={() => openMarket('auction')}> ตั้งประมูล</button>
                <button className="btn" disabled={busy} onClick={() => openMarket('direct')}> ขายระบุผู้เล่น</button>
                <button className="btn" disabled={busy} onClick={() => void doAction('sell', sel)}> ขายคืนระบบ {sel.card.basePrice}</button>
                <button className="btn danger" disabled={busy} onClick={() => void doAction('destroy', sel)}> ทำลาย</button>
              </>
            )}
          </div>
          {sel.status === 'INVENTORY' && sel.card.group === 'tool' && (
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 10 }}>
               เครื่องมือสวมใส่ติดตัว (จอบ/ขวาน ชนิดละ 1) — ต้องมีจึงเข้าเหมือง/ป่าได้ เกรดยิ่งสูงยิ่งเจอของดีบ่อยขึ้น
               {' '}· ความทนทาน {sel.durability ?? toolMaxDurability(sel.card.tier)}/{toolMaxDurability(sel.card.tier)}
               {(sel.durability ?? toolMaxDurability(sel.card.tier)) <= 0 ? ' — พังแล้ว! ต้องซ่อมก่อนใช้งาน' : ''}
            </p>
          )}
          {sel.status === 'INVENTORY' && sel.card.group === 'pet' && (
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 10 }}>
               สัตว์เลี้ยงสวมใส่ติดตัว (สูงสุด 3 ตัว) — เข้าสนามอัตโนมัติตั้งแต่เริ่มการต่อสู้ ไม่ต้องใส่เดค
            </p>
          )}
          {sel.status === 'INVENTORY' && sel.card.group === 'consumable' && sel.card.category === 'potion' && (
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 10 }}>
               ยาใช้ในการต่อสู้ — ใส่เดคเพื่อกดใช้ในเทิร์นของคุณ
            </p>
          )}
        </Modal>
      )}

      {sel && marketMode === 'auction' && (
        <Modal title={` ตั้งประมูล: ${sel.card.name}`} onClose={() => setMarketMode(null)}>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            ราคาเริ่มต้อง ≥ ราคาฐาน {sel.card.basePrice} ทอง · ค่าธรรมเนียมตั้งประมูล {marketFee(auctionForm.startPrice)} ทอง (ไม่คืน)
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div className="bar-label"><span>ราคาเริ่มต้น (≥ {sel.card.basePrice})</span></div>
              <input className="input" type="number" min={sel.card.basePrice} value={auctionForm.startPrice}
                onChange={(e) => setAuctionForm({ ...auctionForm, startPrice: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <div className="bar-label"><span>ราคาซื้อทันที (ไม่บังคับ)</span></div>
              <input className="input" type="number" min={0} placeholder="เช่น 500" value={auctionForm.buyoutPrice}
                onChange={(e) => setAuctionForm({ ...auctionForm, buyoutPrice: e.target.value })} />
            </div>
            <div>
              <div className="bar-label"><span>ระยะเวลา</span></div>
              <div className="tabs" style={{ marginBottom: 0 }}>
                {AUCTION_DURATIONS_H.map((h) => (
                  <div key={h} className={`chip${auctionForm.hours === h ? ' active' : ''}`} onClick={() => setAuctionForm({ ...auctionForm, hours: h })}>{h} ชม.</div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn primary" disabled={busy || auctionForm.startPrice < sel.card.basePrice} onClick={() => void submitMarket()}><Icon name="market" size={15} /> ตั้งประมูล</button>
            <button className="btn ghost" onClick={() => setMarketMode(null)}><Icon name="cancel" size={14} /> ยกเลิก</button>
          </div>
        </Modal>
      )}

      {sel && marketMode === 'direct' && (
        <Modal title={` ขายตรงถึงผู้เล่น: ${sel.card.name}`} onClose={() => setMarketMode(null)}>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
            ผู้ซื้อที่ถูกระบุเท่านั้นที่เห็นและซื้อได้ (48 ชม.) · ราคา ≥ ราคาฐาน {sel.card.basePrice} ทอง · ค่าธรรมเนียมตั้งขาย {marketFee(directForm.price)} ทอง
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div className="bar-label"><span>ชื่อตัวละครผู้รับ</span></div>
              <input className="input" placeholder="เช่น HeroOne" value={directForm.targetName}
                onChange={(e) => setDirectForm({ ...directForm, targetName: e.target.value })} />
            </div>
            <div>
              <div className="bar-label"><span>ราคาขาย (≥ {sel.card.basePrice})</span></div>
              <input className="input" type="number" min={sel.card.basePrice} value={directForm.price}
                onChange={(e) => setDirectForm({ ...directForm, price: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn primary" disabled={busy || !directForm.targetName.trim() || directForm.price < sel.card.basePrice} onClick={() => void submitMarket()}><Icon name="check" size={15} /> ตั้งขาย</button>
            <button className="btn ghost" onClick={() => setMarketMode(null)}>ยกเลิก</button>
          </div>
        </Modal>
      )}

      {character && (
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 14 }}>
          ทั้งหมดในแค็ตตาล็อก {CARD_TEMPLATES.length} แบบ · การ์ดทุกใบมีหมายเลขเฉพาะ (serial) บันทึกในระบบบัญชี — เมื่อถูกใช้/ทำลาย จะกลับเข้า pool ของระบบเพื่อ drop/กาชาใหม่
        </p>
      )}
    </div>
  );
}
