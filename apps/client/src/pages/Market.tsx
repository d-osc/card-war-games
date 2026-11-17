import { useCallback, useEffect, useState } from 'react';
import { AUCTION_DURATIONS_H, AUCTION_MIN_INCREMENT, MARKET_FEE_RATE, MARKET_MIN_FEE } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { AuctionDTO, CharacterDTO, DirectSaleDTO } from '../dto';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import { artIconName } from '../components/CardView';

function useTick(ms: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdownText(endsAt: string, now: number): string {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return 'หมดเวลา';
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (h > 0) return `${h}ช ${m}น`;
  return `${m}น ${s}วิ`;
}

function minBid(a: AuctionDTO): number {
  return a.currentBid ? Math.ceil(a.currentBid * (1 + AUCTION_MIN_INCREMENT)) : a.startPrice;
}

interface MeResponse2 {
  character: CharacterDTO;
  message?: string;
}

export default function MarketPage() {
  const [tab, setTab] = useState<'auction' | 'direct'>('auction');
  const [auctions, setAuctions] = useState<AuctionDTO[]>([]);
  const [sales, setSales] = useState<DirectSaleDTO[]>([]);
  const [bidTarget, setBidTarget] = useState<AuctionDTO | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);
  const now = useTick(1000);

  const load = useCallback(async () => {
    try {
      const a = await api<{ auctions: AuctionDTO[] }>('/api/market/auctions');
      setAuctions(a.auctions);
      const d = await api<{ sales: DirectSaleDTO[] }>('/api/market/direct');
      setSales(d.sales);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(path: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await api<MeResponse2>(path, { method: 'POST', body });
      if (res.character) setCharacter(res.character);
      if (res.message) showToast(res.message);
      await load();
      return true;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitBid() {
    if (!bidTarget) return;
    const ok = await act(`/api/market/auctions/${bidTarget.id}/bid`, { amount: Number(bidAmount) });
    if (ok) setBidTarget(null);
  }

  const incoming = sales.filter((s) => s.isForMe);
  const mySales = sales.filter((s) => s.isMine);

  return (
    <div>
      <div className="tabs">
        <div className={`chip${tab === 'auction' ? ' active' : ''}`} onClick={() => setTab('auction')}> ประมูลการ์ด</div>
        <div className={`chip${tab === 'direct' ? ' active' : ''}`} onClick={() => setTab('direct')}> ขายตรงถึงผู้เล่น</div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 0 }}>
        กติกาตลาด: ราคาขั้นต่ำ = ราคาฐานของระบบ (กันขายถูกทุบตลาด) · ค่าธรรมเนียม {Math.round(MARKET_FEE_RATE * 100)}% (ขั้นต่ำ {MARKET_MIN_FEE} ทอง) จ่ายตอนตั้งขาย และอีกครั้งตอนขายสำเร็จ — เข้าเป็นภาษีของระบบ
        ตั้งประมูล/ขายตรงได้จากหน้า<a href="/inventory">คลังการ์ด</a>
      </p>

      {tab === 'auction' && (
        <div className="page-grid">
          {auctions.length === 0 && <div className="empty">ยังไม่มีการประมูลเปิดอยู่ — เป็นคนแรกที่ตั้งประมูลจากหน้าคลังการ์ด!</div>}
          {auctions.map((a) => (
            <div key={a.id} className="auction-row">
              <div className={`listing-emoji rarity-art-${a.card.rarity}`}><Icon name={artIconName(a.card) ?? 'deck'} size={30} /></div>
              <div className="info">
                <div style={{ fontWeight: 800 }}>
                  {a.card.name} <span className={`rarity-text-${a.card.rarity}`}>[{a.card.rarity}]</span>{' '}
                  <span className="badge">#{a.serial}</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                  ผู้ขาย {a.sellerName}
                  {a.isMine && <span className="badge gold"> ของคุณ</span>}
                  {a.imHighest && <span className="badge blue"> คุณเสนอสูงสุด</span>}
                </div>
              </div>
              <div className="price-col">
                <span>เริ่ม {a.startPrice}</span>
                <span>ปัจจุบัน <b>{a.currentBid ?? '—'}</b>{a.currentBidderName ? ` (${a.currentBidderName})` : ''}</span>
                {a.buyoutPrice && <span>ซื้อทันที <b>{a.buyoutPrice}</b></span>}
              </div>
              <div className="countdown cell-label"><Icon name="boltShield" size={13} /> {countdownText(a.endsAt, now)}</div>
              <div className="btn-row">
                {!a.isMine && !a.imHighest && (
                  <button
                    className="btn sm accent"
                    disabled={busy}
                    onClick={() => {
                      setBidTarget(a);
                      setBidAmount(String(minBid(a)));
                    }}
                  >
                    <Icon name="gold" size={13} /> เสนอราคา (≥{minBid(a)})
                  </button>
                )}
                {!a.isMine && a.buyoutPrice != null && (
                  <button
                    className="btn sm primary"
                    disabled={busy}
                    onClick={() => void act(`/api/market/auctions/${a.id}/buyout`, undefined, `ซื้อทันทีในราคา ${a.buyoutPrice} ทอง?`)}
                  >
                    ซื้อทันที
                  </button>
                )}
                {a.isMine && !a.currentBid && (
                  <button
                    className="btn sm danger"
                    disabled={busy}
                    onClick={() => void act(`/api/market/auctions/${a.id}/cancel`, undefined, 'ยกเลิกการประมูล? (ค่าธรรมเนียมไม่คืน)')}
                  >
                    ยกเลิก
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'direct' && (
        <div className="page-grid">
          <div className="panel">
            <div className="section-title"> ข้อเสนอที่ส่งถึงคุณ <span className="hint">เห็นได้เฉพาะคุณ (48 ชม.)</span></div>
            {incoming.length === 0 ? (
              <div className="empty">ยังไม่มีใครเสนอขายการ์ดให้คุณ</div>
            ) : incoming.map((s) => (
              <div key={s.id} className="quest-board-row" style={{ marginBottom: 10 }}>
                <div className={`listing-emoji rarity-art-${s.card.rarity}`}><Icon name={artIconName(s.card) ?? 'deck'} size={30} /></div>
                <div className="info">
                  <div style={{ fontWeight: 800 }}>
                    {s.card.name} <span className={`rarity-text-${s.card.rarity}`}>[{s.card.rarity}]</span> <span className="badge">#{s.serial}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>จาก {s.sellerName} · หมดอายุ {countdownText(s.expiresAt, now)}</div>
                </div>
                <div className="price" style={{ fontWeight: 800, color: 'var(--gold)' }}> {s.price.toLocaleString('th-TH')}</div>
                <button className="btn sm primary" disabled={busy} onClick={() => void act(`/api/market/direct/${s.id}/buy`, undefined, `ซื้อในราคา ${s.price} ทอง?`)}>
                  ซื้อ
                </button>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="section-title"> รายการที่คุณตั้งขายไว้</div>
            {mySales.length === 0 ? (
              <div className="empty">คุณยังไม่ได้ตั้งขายตรง — ไปหน้าคลังการ์ด กด "ขายระบุผู้เล่น"</div>
            ) : mySales.map((s) => (
              <div key={s.id} className="quest-board-row" style={{ marginBottom: 10 }}>
                <div className={`listing-emoji rarity-art-${s.card.rarity}`}><Icon name={artIconName(s.card) ?? 'deck'} size={30} /></div>
                <div className="info">
                  <div style={{ fontWeight: 800 }}>
                    {s.card.name} <span className={`rarity-text-${s.card.rarity}`}>[{s.card.rarity}]</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>ถึง {s.targetName} · หมดอายุ {countdownText(s.expiresAt, now)}</div>
                </div>
                <div className="price" style={{ fontWeight: 800, color: 'var(--gold)' }}> {s.price.toLocaleString('th-TH')}</div>
                <button className="btn sm danger" disabled={busy} onClick={() => void act(`/api/market/direct/${s.id}/cancel`, undefined, 'ยกเลิกรายการขาย? (ค่าธรรมเนียมไม่คืน)')}>
                  ยกเลิก
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {bidTarget && (
        <Modal title={`เสนอราคา: ${bidTarget.card.name}`} onClose={() => setBidTarget(null)}>
          <p style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
            ราคาปัจจุบัน <b style={{ color: 'var(--gold)' }}>{bidTarget.currentBid ?? bidTarget.startPrice}</b> ทอง
            {' '}· ต้องเสนออย่างน้อย <b>{minBid(bidTarget)}</b> ทอง (+{Math.round(AUCTION_MIN_INCREMENT * 100)}% ต่อครั้ง)
            {' '}· เงินถูกวางประกันทันที ถ้ามีคนเสนอสูงกว่าจะได้คืนอัตโนมัติ
          </p>
          <input
            className="input"
            type="number"
            value={bidAmount}
            min={minBid(bidTarget)}
            onChange={(e) => setBidAmount(e.target.value)}
          />
          <div className="modal-actions">
            <button className="btn primary" disabled={busy || Number(bidAmount) < minBid(bidTarget)} onClick={() => void submitBid()}>
              ยืนยันเสนอราคา
            </button>
            <button className="btn ghost" onClick={() => setBidTarget(null)}><Icon name="cancel" size={14} /> ยกเลิก</button>
          </div>
        </Modal>
      )}

      {tab === 'auction' && (
        <p style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>
          ระยะเวลาประมูลที่เลือกได้: {AUCTION_DURATIONS_H.join(' / ')} ชั่วโมง · เมื่อหมดเวลา ผู้เสนอสูงสุดได้การ์ด ผู้ขายได้เงินหักค่าธรรมเนียม · ไม่มีผู้เสนอ = การ์ดคืนผู้ขาย
        </p>
      )}
    </div>
  );
}
