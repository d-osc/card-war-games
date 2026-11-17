import { useCallback, useEffect, useState } from 'react';
import { CardTemplate, cardById, CRAFT_KEYS, CraftKey, craftScore } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, InventoryCard } from '../dto';
import CardView from '../components/CardView';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import MiniGame from '../components/MiniGame';
import FlipCard from '../components/FlipCard';

type Station = 'equipment' | 'alchemy' | 'brew' | 'cook';

interface CraftResponse {
  card: CardTemplate;
  character: CharacterDTO;
}

const STATIONS: { key: Station; label: string; ico: string }[] = [
  { key: 'equipment', label: 'คราฟต์อุปกรณ์', ico: 'craft' },
  { key: 'alchemy', label: 'แร่แปรธาตุ', ico: 'gem' },
  { key: 'brew', label: 'ปรุงยา', ico: 'potion' },
  { key: 'cook', label: 'ทำอาหาร', ico: 'food' },
];

const CRAFT_KEY_ICONS: Record<string, string> = {
  sword: 'sword', katana: 'katana', bow: 'bow', hat: 'hat', top: 'top', pants: 'pants',
  shoes: 'shoes', gloves: 'gloves', ring: 'ringIcon', bracelet: 'bracelet', earring: 'earring',
  pickaxe: 'pickaxe', axe: 'axe', sickle: 'herb',
};

/** ธีมมินิเกมของแต่ละสถานี — กดตอนสัญลักษณ์อยู่ในโซนทอง 10 ครั้ง */
const STATION_GAME: Record<Station, { icon: string; verb: string }> = {
  equipment: { icon: 'craft', verb: 'หลอม' },
  alchemy: { icon: 'gem', verb: 'กวน' },
  brew: { icon: 'potion', verb: 'ปั่น' },
  cook: { icon: 'food', verb: 'ผัด' },
};

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function MaterialPicker({ cards, selected, onToggle, listClass = 'craft-select-list' }: {
  cards: InventoryCard[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  listClass?: string;
}) {
  return (
    <div className="craft-picker-body">
      <div className="bar-label">
        <span>เลือก {selected.size} ชิ้น</span>
        <span>แตะการ์ดเพื่อเลือก/ยกเลิก</span>
      </div>
      {cards.length === 0 ? (
        <div className="empty">ไม่มีวัตถุดิบหมวดนี้ในคลัง</div>
      ) : (
        <div className={listClass}>
          {cards.map((c) => (
            <CardView key={c.id} card={c.card} showSerial={c.id} selected={selected.has(c.id)} onClick={() => onToggle(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CraftPage() {
  const [station, setStation] = useState<Station>('equipment');
  const [cards, setCards] = useState<InventoryCard[]>([]);
  const [woodSel, setWoodSel] = useState(new Set<number>());
  const [oreSel, setOreSel] = useState(new Set<number>());
  const [mixSel, setMixSel] = useState(new Set<number>());
  const [craftKey, setCraftKey] = useState<CraftKey>('sword');
  const [result, setResult] = useState<CraftResponse | null>(null);
  const [miniGame, setMiniGame] = useState(false);
  const [flipPending, setFlipPending] = useState<CraftResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);

  const load = useCallback(async () => {
    const res = await api<{ cards: InventoryCard[] }>('/api/inventory');
    setCards(res.cards);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // วัตถุดิบที่ใช้ได้แต่ละสถานี (เฉพาะในคลัง)
  const inventoryOnly = cards.filter((c) => c.status === 'INVENTORY');
  const woods = inventoryOnly.filter((c) => c.card.category === 'wood');
  const ores = inventoryOnly.filter((c) => c.card.category === 'ore' || c.card.category === 'gem');
  const herbs = inventoryOnly.filter((c) => c.card.category === 'herb');
  const parts = inventoryOnly.filter((c) => c.card.category === 'monster_part');
  const ingredients = inventoryOnly.filter((c) => c.card.category === 'ingredient');

  const currentInputs = (): { serials: number[]; wood: number[]; ore: number[] } => {
    switch (station) {
      case 'equipment': return { serials: [], wood: [...woodSel], ore: [...oreSel] };
      case 'alchemy': return { serials: [...mixSel], wood: [], ore: [] };
      case 'brew': return { serials: [...mixSel], wood: [], ore: [] };
      case 'cook': return { serials: [...mixSel], wood: [], ore: [] };
    }
  };

  const scoreCards = (): CardTemplate[] => {
    switch (station) {
      case 'equipment': return [...woodSel, ...oreSel].map((id) => cards.find((c) => c.id === id)!).filter(Boolean).map((c) => c.card);
      case 'alchemy': return [...mixSel].map((id) => ores.find((o) => o.id === id)!).filter(Boolean).map((c) => c.card);
      case 'brew': return [...mixSel].map((id) => cards.find((c) => c.id === id)!).filter(Boolean).map((c) => c.card);
      case 'cook': return [...mixSel].map((id) => cards.find((c) => c.id === id)!).filter(Boolean).map((c) => c.card);
    }
  };

  const score = craftScore(scoreCards().filter(Boolean).map((c) => cardById(c.id)));

  /** เรียกหลังจบมินิเกม: เอาจำนวนที่โดน (hits) ส่งให้ server คิดโบนัสคะแนน แล้วให้ผู้เล่นลากพลิกการ์ดดูเฉลย */
  async function craft(hits = 0) {
    setBusy(true);
    setResult(null);
    setMiniGame(false);
    try {
      const body = station === 'equipment'
        ? { key: craftKey, wood: [...woodSel], ore: [...oreSel], hits }
        : { serials: [...mixSel], hits };
      const res = await api<CraftResponse>(`/api/craft/${station}`, { method: 'POST', body });
      setCharacter(res.character);
      setFlipPending(res);
      setWoodSel(new Set());
      setOreSel(new Set());
      setMixSel(new Set());
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'คราฟต์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const canCraft =
    station === 'equipment'
      ? woodSel.size >= 1 && oreSel.size >= 1 && woodSel.size + oreSel.size <= 20
      : mixSel.size >= 2 && mixSel.size <= 20;

  const eligibleForMix = station === 'alchemy' ? ores : station === 'brew' ? [...herbs, ...parts] : [...herbs, ...ingredients];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tabs">
        {STATIONS.map((s) => (
          <div key={s.key} className={`chip${station === s.key ? ' active' : ''}`} onClick={() => { setStation(s.key); setMixSel(new Set()); }}>
            <Icon name={s.ico} size={16} /> {s.label}
          </div>
        ))}
      </div>

      {station === 'equipment' && (
        <div className="page-grid two-col craft-fit craft-fit-eq">
          <div className="panel">
            <div className="section-title">1⃣ เลือกประเภทที่จะสร้าง</div>
            <div className="tabs hscroll" style={{ marginBottom: 10 }}>
              {CRAFT_KEYS.map((k) => (
                <div key={k.key} className={`chip${craftKey === k.key ? ' active' : ''}`} onClick={() => setCraftKey(k.key)}>
                  <Icon name={CRAFT_KEY_ICONS[k.key] ?? 'craft'} size={16} /> {k.label}
                </div>
              ))}
            </div>
            <p className="craft-help" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
              ใส่การ์ดไม้ <b>กี่ใบก็ได้ ชนิดไหนก็ได้</b> + การ์ดแร่/อัญมณี <b>กี่ใบก็ได้</b> — ผลลัพธ์สุ่มตามเกรดวัตถุดิบ (อัญมณีให้คะแนนสูงสุด)
            </p>
          </div>
          <div className="panel craft-score-panel">
            <div className="section-title"> พลังวัตถุดิบรวม: <span style={{ color: 'var(--gold)' }}>{score.toFixed(1)}</span></div>
            <div className="bar xp"><div className="fill" style={{ width: `${Math.min(100, (score / 20) * 100)}%` }} /></div>
            <p className="craft-help" style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>2 = พื้นฐาน · 5+ เริ่มมีโอกาส R · 8+ มีโอกาส SR · 13+ มีโอกาส SSR</p>
          </div>

          <div className="panel craft-picker">
            <div className="section-title"> การ์ดไม้ (อย่างน้อย 1)</div>
            <MaterialPicker cards={woods} selected={woodSel} onToggle={(id) => setWoodSel((s) => toggle(s, id))} />
          </div>
          <div className="panel craft-picker">
            <div className="section-title"> การ์ดแร่/อัญมณี (อย่างน้อย 1)</div>
            <MaterialPicker cards={ores} selected={oreSel} onToggle={(id) => setOreSel((s) => toggle(s, id))} />
          </div>
        </div>
      )}

      {station !== 'equipment' && (
        <div className="page-grid two-col craft-fit">
          <div className="panel craft-picker">
            <div className="section-title">
              {station === 'alchemy' ? ' ผสมแร่/อัญมณี (≥ 2 ชิ้น)' : station === 'brew' ? ' ต้มสมุนไพร/ชิ้นส่วนมอนสเตอร์ (≥ 2 ชิ้น)' : ' ปรุงสมุนไพร/วัตถุดิบ (≥ 2 ชิ้น)'}
            </div>
            <p className="craft-help" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
              {station === 'alchemy' && 'ใส่ได้ไม่จำกัดจำนวน — ยิ่งวัตถุดิบเกรดสูง ยิ่งมีโอกาสแปรธาตุได้แร่/อัญมณีเกรดสูง (ใช้วัตถุดิบทั้งหมดที่เลือก)'}
              {station === 'brew' && 'สุ่มได้การ์ดยาหลากชนิด — ยาเกรดสูงต้องใช้วัตถุดิบเกรดสูง'}
              {station === 'cook' && 'สุ่มได้การ์ดอาหาร — อาหารกินนอกสนามเพื่อฟื้นพลังงาน หรือใช้ในสนามเพื่อบัฟ'}
            </p>
            <MaterialPicker cards={eligibleForMix} selected={mixSel} onToggle={(id) => setMixSel((s) => toggle(s, id))} listClass="craft-select-list-2" />
          </div>
          <div className="panel craft-score-panel">
            <div className="section-title"> พลังวัตถุดิบรวม: <span style={{ color: 'var(--gold)' }}>{score.toFixed(1)}</span> ({mixSel.size} ชิ้น)</div>
            <div className="bar xp"><div className="fill" style={{ width: `${Math.min(100, (score / 20) * 100)}%` }} /></div>
          </div>
        </div>
      )}

      <div className="craft-footer">
        <div className="craft-score-strip">
          <span>พลังวัตถุดิบรวม <b style={{ color: 'var(--gold)' }}>{score.toFixed(1)}</b>{station !== 'equipment' ? ` (${mixSel.size} ชิ้น)` : ''}</span>
          <div className="bar xp"><div className="fill" style={{ width: `${Math.min(100, (score / 20) * 100)}%` }} /></div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn primary big" disabled={busy || !canCraft} onClick={() => setMiniGame(true)}>
            {station === 'equipment' ? ' คราฟต์เลย!' : station === 'alchemy' ? ' แปรธาตุ!' : station === 'brew' ? ' ปรุงยา!' : ' ทำอาหาร!'}
          </button>
        </div>
      </div>

      {miniGame && (
        <Modal title=" มินิเกมคราฟต์!" onClose={() => setMiniGame(false)}>
          <MiniGame
            icon={STATION_GAME[station].icon}
            verb={STATION_GAME[station].verb}
            bonusPerHit={0.5}
            hint="กดตอนสัญลักษณ์อยู่ในโซนสีทอง — ยิ่งโดนมาก โบนัสคะแนนยิ่งสูง ยิ่งมีโอกาสได้ของดี"
            doneLabel="รับผลงาน"
            doneIcon="check"
            onDone={(hits) => void craft(hits)}
          />
        </Modal>
      )}

      {flipPending && (
        <Modal title=" พลิกการ์ดผลงาน!">
          <FlipCard
            card={flipPending.card}
            onRevealed={() => { setResult(flipPending); setFlipPending(null); }}
          />
        </Modal>
      )}

      {result && (
        <Modal title=" ผลงานคราฟต์ออกมาแล้ว!" onClose={() => setResult(null)}>
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <div style={{ width: 200 }}>
              <CardView card={result.card} />
            </div>
            <button className="btn primary" onClick={() => setResult(null)}><Icon name="check" size={16} /> เยี่ยม! เก็บลงคลัง</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
