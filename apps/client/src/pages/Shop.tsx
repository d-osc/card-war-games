import { useCallback, useEffect, useState } from 'react';
import { CardTemplate, GACHA_COST, gachaRates, cardById } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, ShopListingDTO } from '../dto';
import CardView from '../components/CardView';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import FlipCard from '../components/FlipCard';
import MiniGame from '../components/MiniGame';
import { artIconName } from '../components/CardView';

interface IapPackageDTO {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  gold: number;
  firstBonusGold: number;
  guaranteedTemplateId?: string;
  priceTHB: number;
  firstBonusLeft: boolean;
}

interface IapResponse {
  gold: number;
  firstBonus: boolean;
  cards: CardTemplate[];
  character: CharacterDTO;
}

interface GachaResponse {
  cards: CardTemplate[];
  goldSpent: number;
  character: CharacterDTO;
}

export default function ShopPage() {
  const [tab, setTab] = useState<'gacha' | 'second' | 'special'>('gacha');
  const [listings, setListings] = useState<ShopListingDTO[]>([]);
  const [gachaResult, setGachaResult] = useState<GachaResponse | null>(null);
  const [flipPending, setFlipPending] = useState<GachaResponse | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [miniGame, setMiniGame] = useState<number | null>(null); // จำนวนครั้งที่จะสุ่มรอบนี้
  const [busy, setBusy] = useState(false);
  const [iap, setIap] = useState<IapPackageDTO[] | null>(null);
  const [iapConfirm, setIapConfirm] = useState<IapPackageDTO | null>(null);
  const [iapResult, setIapResult] = useState<IapResponse | null>(null);
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);

  const loadListings = useCallback(async () => {
    const res = await api<{ listings: ShopListingDTO[] }>('/api/shop/listings');
    setListings(res.listings);
  }, []);

  const loadIap = useCallback(async () => {
    try {
      const res = await api<{ packages: IapPackageDTO[] }>('/api/shop/iap');
      setIap(res.packages);
    } catch {
      setIap([]);
    }
  }, []);

  useEffect(() => {
    if (tab === 'second') void loadListings();
    if (tab === 'special') void loadIap();
  }, [tab, loadListings, loadIap]);

  /** เล่นมินิเกมก่อน — คะแนนที่โดนกลายเป็นโชคเฉพาะรอบเปิดการ์ดครั้งนี้ */
  async function pull(pulls: number, hits = 0) {
    setBusy(true);
    try {
      const res = await api<GachaResponse>('/api/shop/gacha', { method: 'POST', body: { pulls, hits } });
      setCharacter(res.character);
      setRevealed(0);
      setFlipPending(res); // แสดงหลังการ์ดก่อน — พลิกทีละใบจึงเห็นผล
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'สุ่มไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  // พลิกครบทุกใบแล้ว → สรุปผล
  useEffect(() => {
    if (flipPending && revealed >= flipPending.cards.length) {
      setGachaResult(flipPending);
      setFlipPending(null);
      setRevealed(0);
    }
  }, [revealed, flipPending]);

  async function buy(listing: ShopListingDTO) {
    setBusy(true);
    try {
      const res = await api<{ card: CardTemplate; character: CharacterDTO }>(`/api/shop/buy/${listing.id}`, { method: 'POST' });
      setCharacter(res.character);
      showToast(`ซื้อ ${res.card.name} สำเร็จ!`);
      await loadListings();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ซื้อไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function buyIap(pkg: IapPackageDTO) {
    setBusy(true);
    try {
      const res = await api<IapResponse>('/api/shop/iap/purchase', { method: 'POST', body: { packageId: pkg.id } });
      setCharacter(res.character);
      setIapConfirm(null);
      setIapResult(res);
      void loadIap();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ซื้อแพ็กไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tabs">
        <div className={`chip${tab === 'gacha' ? ' active' : ''}`} onClick={() => setTab('gacha')}> กาชาการ์ด</div>
        <div className={`chip${tab === 'second' ? ' active' : ''}`} onClick={() => setTab('second')}> การ์ดมือสอง</div>
        <div className={`chip${tab === 'special' ? ' active' : ''}`} onClick={() => setTab('special')}> พิเศษ</div>
      </div>

      <div className="shop-body">

      {tab === 'gacha' && (
        <div className="panel gacha-stage">
          <div className="gacha-orb"><Icon name="gacha" size={72} /></div>
          <h3 style={{ margin: '6px 0' }}>กาชาการ์ดสุ่มทุกประเภท</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 10px' }}>
            การ์ดจากกาชาเป็นการ์ดที่ระบบออกใหม่ (mint) ทุกครั้ง — มีหมายเลข serial เฉพาะตัว
          </p>
          <div className="rates">
            <span className="rarity-text-C">C 50%</span>
            <span className="rarity-text-UC">UC 28%</span>
            <span className="rarity-text-R">R 15%</span>
            <span className="rarity-text-SR">SR 5.5%</span>
            <span className="rarity-text-SSR">SSR 1.5%</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.78rem', margin: '0 0 6px' }}>
            ทุกครั้งที่กดสุ่มจะได้เล่นมินิเกมเสี่ยงโชคก่อน — ยิ่งโดนโซนทองมาก โชคยิ่งสูง ได้การ์ดหายากง่ายขึ้น (เพิ่มเฉพาะรอบนั้น) · <b>สุ่ม 10 ครั้ง โชคจากมินิเกม ×2</b>
          </p>
          <details className="gacha-luck-table">
            <summary>อัตราตามระดับโชค 0–10</summary>
            <table>
              <thead>
                <tr><th>โชค</th><th>C</th><th>UC</th><th>R</th><th>SR</th><th>SSR</th></tr>
              </thead>
              <tbody>
                {Array.from({ length: 11 }, (_, l) => {
                  const rates = gachaRates(l);
                  return (
                    <tr key={l}>
                      <td className="luck-col">{l}</td>
                      {rates.map(([r, w]) => (
                        <td key={r} className={`rarity-text-${r}`}>{w.toFixed(1).replace(/\.0$/, '')}%</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" disabled={busy || (character ? character.gold < GACHA_COST : true)} onClick={() => setMiniGame(1)}>
              สุ่ม 1 ครั้ง —  {GACHA_COST}
            </button>
            <button className="btn primary" disabled={busy || (character ? character.gold < GACHA_COST * 10 : true)} onClick={() => setMiniGame(10)}>
              สุ่ม 10 ครั้ง —  {(GACHA_COST * 10).toLocaleString('th-TH')}
            </button>
          </div>
        </div>
      )}

      {tab === 'second' && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 0 }}>
            การ์ดที่ผู้เล่นทั้งหลายขายคืนระบบ — ระบบขายต่อในราคาฐาน +25% (ส่วนต่างเป็นภาษีของระบบเพื่อสมดุลเศรษฐกิจ)
          </p>
          {listings.length === 0 ? (
            <div className="empty">ยังไม่มีการ์ดวางขาย — ลองกลับมาใหม่ หรือเป็นคนแรกที่ขายการ์ดคืนระบบจากหน้าคลัง</div>
          ) : (
            <div className="page-grid">
              {listings.map((l) => (
                <div key={l.id} className="listing-row">
                  <div className={`listing-emoji rarity-art-${l.card.rarity}`}><Icon name={artIconName(l.card) ?? 'deck'} size={30} /></div>
                  <div className="info">
                    <div style={{ fontWeight: 800 }}>{l.card.name} <span className={`rarity-text-${l.card.rarity}`}>[{l.card.rarity}]</span></div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>ขายโดย {l.sellerName} · #{l.id}</div>
                  </div>
                  <div className="price"> {l.price.toLocaleString('th-TH')}</div>
                  <button className="btn sm primary" disabled={busy || (character ? character.gold < l.price : true)} onClick={() => void buy(l)}>
                    ซื้อ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'special' && (
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 0 }}>
            แพ็กพิเศษรองรับด้วยเงินจริง — ซื้อแพ็กไหนครั้งแรกได้ทองโบนัสเพิ่มทันที (โบนัสแพ็กละ 1 ครั้ง)
          </p>
          {iap === null && <div className="empty">กำลังโหลดแพ็ก…</div>}
          <div className="iap-grid">
            {(iap ?? []).map((p) => {
              const gift = p.guaranteedTemplateId ? cardById(p.guaranteedTemplateId) : null;
              return (
                <div key={p.id} className={`iap-card${p.priceTHB >= 399 ? ' best' : ''}`}>
                  {p.priceTHB >= 399 && <div className="iap-best-tag">คุ้มที่สุด</div>}
                  <div className="iap-emoji">{p.emoji}</div>
                  <div className="iap-title">{p.title}</div>
                  <div className="iap-desc">{p.desc}</div>
                  <div className="iap-gold"><Icon name="gold" size={16} /> {p.gold.toLocaleString('th-TH')} ทอง</div>
                  {p.firstBonusLeft && (
                    <div className="iap-bonus">ซื้อครั้งแรก +{p.firstBonusGold.toLocaleString('th-TH')} ทอง</div>
                  )}
                  {gift && (
                    <div className="iap-gift">
                      <div className="iap-gift-card"><CardView card={gift} /></div>
                      <span>การันตีทุกครั้ง</span>
                    </div>
                  )}
                  <button className="btn primary iap-buy" disabled={busy} onClick={() => setIapConfirm(p)}>
                    ซื้อ {p.priceTHB.toLocaleString('th-TH')}฿
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>

      {iapConfirm && (
        <Modal title={`ยืนยันซื้อ ${iapConfirm.title}`} onClose={() => setIapConfirm(null)}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12, textAlign: 'center' }}>
            <div className="iap-emoji">{iapConfirm.emoji}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{iapConfirm.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{iapConfirm.desc}</div>
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              <Icon name="gold" size={15} /> {iapConfirm.gold.toLocaleString('th-TH')} ทอง
              {iapConfirm.firstBonusLeft && <> <span className="iap-bonus">+{iapConfirm.firstBonusGold.toLocaleString('th-TH')} (โบนัสครั้งแรก)</span></>}
              {iapConfirm.guaranteedTemplateId && <> · การ์ด {cardById(iapConfirm.guaranteedTemplateId)?.name} การันตี</>}
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--gold)' }}>{iapConfirm.priceTHB.toLocaleString('th-TH')} บาท</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>
              (โหมดพัฒนา: จำลองการชำระเงินสำเร็จทันที — ยังไม่หักบัตรจริง)
            </p>
            <div className="btn-row" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={() => setIapConfirm(null)}>ยกเลิก</button>
              <button className="btn primary big" disabled={busy} onClick={() => void buyIap(iapConfirm)}>
                <Icon name="check" size={16} /> ยืนยันซื้อ
              </button>
            </div>
          </div>
        </Modal>
      )}

      {iapResult && (
        <Modal title=" ซื้อแพ็กสำเร็จ!" onClose={() => setIapResult(null)}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <p style={{ margin: 0, fontSize: '1rem' }}>
              ได้รับ <b style={{ color: 'var(--gold)' }}>{iapResult.gold.toLocaleString('th-TH')} ทอง</b>
              {iapResult.firstBonus && ' (รวมโบนัสครั้งแรก)'} เข้ากระเป๋าแล้ว!
            </p>
            {iapResult.cards.length > 0 && (
              <>
                <div style={{ width: 170 }}>
                  <CardView card={iapResult.cards[0]} />
                </div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.8rem' }}>
                  การ์ดการันตี {iapResult.cards[0].name} เข้าคลังแล้ว
                </p>
              </>
            )}
            <button className="btn primary" onClick={() => setIapResult(null)}><Icon name="check" size={15} /> เยี่ยม!</button>
          </div>
        </Modal>
      )}

      {miniGame != null && (
        <Modal title=" มินิเกมเสี่ยงโชค!" onClose={() => setMiniGame(null)}>
          <MiniGame
            icon="gacha"
            verb="หมุน"
            luckOnly
            luckMultiplier={miniGame === 10 ? 2 : 1}
            hint="กดตอนสัญลักษณ์อยู่ในโซนสีทอง — ยิ่งโดนมาก โชคยิ่งสูง ได้การ์ดหายากง่ายขึ้น (เฉพาะรอบนี้ · สุ่ม 10 ครั้ง โชคคูณ 2)"
            doneLabel={`รับผลสุ่ม ${miniGame} ครั้ง`}
            doneIcon="gacha"
            onDone={(hits) => { const p = miniGame; setMiniGame(null); void pull(p, hits); }}
          />
        </Modal>
      )}

      {flipPending && (
        <Modal title=" พลิกการ์ดกาชา!">
          {flipPending.cards.length === 1 ? (
            <FlipCard card={flipPending.cards[0]} onRevealed={() => setRevealed(1)} />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
              <div className="gacha-flip-grid">
                {flipPending.cards.map((c, i) => (
                  <FlipCard key={i} card={c} hint={null} onRevealed={() => setRevealed((r) => r + 1)} />
                ))}
              </div>
              <p className="flip-hint"><Icon name="cardPlay" size={16} /> ลากการ์ดแต่ละใบเพื่อพลิกดูรางวัล ({revealed}/{flipPending.cards.length})</p>
            </div>
          )}
        </Modal>
      )}

      {gachaResult && (
        <Modal title={` ผลสุ่มกาชา (ใช้ ${gachaResult.goldSpent} ทอง)`} onClose={() => setGachaResult(null)}>
          <div className="gacha-results">
            {gachaResult.cards.map((c, i) => (
              <CardView key={i} card={c} />
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setGachaResult(null)}><Icon name="check" size={15} /> เก็บลงคลัง</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
