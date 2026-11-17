import { useCallback, useEffect, useState } from 'react';
import { CardTemplate, CATEGORY_NAME_TH, GATHER_STAM_COST, toolMaxDurability } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import type { CharacterDTO, InventoryCard } from '../dto';
import CardView from '../components/CardView';
import FlipCard from '../components/FlipCard';
import MiniGame from '../components/MiniGame';
import Modal from '../components/Modal';
import Icon from '../components/Icon';

interface GatherResponse {
  templateId: string;
  card: CardTemplate;
  goldBonus: number;
  xp: number;
  energyLeft: number;
  character: CharacterDTO;
}

const ZONE_UI = {
  mine: {
    title: ' เหมืองขุดแร่',
    banner: 'mine',
    desc: `ขุดหาการ์ดแร่และอัญมณี — ใช้กำลัง ${GATHER_STAM_COST} ต่อครั้ง ยิ่งจอบเกรดดี ยิ่งเจอแร่ระดับสูงบ่อยขึ้น`,
    tool: 'จอบขุดแร่',
    drops: 'แร่ 80% · อัญมณี 20%',
    action: 'ขุด',
  },
  forest_wood: {
    title: ' ป่าลึก — ตัดไม้',
    banner: 'forest',
    desc: `ฟันไม้หาไม้และวัตถุดิบ — ใช้กำลัง ${GATHER_STAM_COST} ต่อครั้ง ยิ่งขวานเกรดดี ยิ่งเจอของดี`,
    tool: 'ขวานตัดไม้',
    drops: 'ไม้ 70% · วัตถุดิบ 20% · สัตว์เลี้ยง 10%',
    action: 'ตัดไม้',
  },
  forest_harvest: {
    title: ' ป่าลึก — เก็บเกี่ยว',
    banner: 'forest',
    desc: `เก็บสมุนไพรและวัตถุดิบ — ใช้กำลัง ${GATHER_STAM_COST} ต่อครั้ง ยิ่งเคียวเกรดดี ยิ่งเจอของดี`,
    tool: 'เคียวเก็บเกี่ยว',
    drops: 'สมุนไพร 68% · วัตถุดิบ 22% · สัตว์เลี้ยง 10%',
    action: 'เก็บเกี่ยว',
  },
} as const;

type ActivityKey = 'mine' | 'forest_wood' | 'forest_harvest';


export default function GatherPage({ zone }: { zone: 'mine' | 'forest' }) {
  const [activity, setActivity] = useState<'wood' | 'harvest'>('wood');
  const key: ActivityKey = zone === 'mine' ? 'mine' : (activity === 'harvest' ? 'forest_harvest' : 'forest_wood');
  const ui = ZONE_UI[key];
  const toolCategory = zone === 'mine' ? 'pickaxe' : (activity === 'harvest' ? 'sickle' : 'axe');
  const [result, setResult] = useState<GatherResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasTool, setHasTool] = useState<boolean | null>(null);
  const [toolTier, setToolTier] = useState(1);
  const [toolDura, setToolDura] = useState<{ cur: number; max: number } | null>(null);
  const [bestTool, setBestTool] = useState<InventoryCard | null>(null);
  const [digGame, setDigGame] = useState(false);
  const [flipPending, setFlipPending] = useState<GatherResponse | null>(null);
  const character = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);


  const checkTool = useCallback(async () => {
    const res = await api<{ cards: InventoryCard[] }>('/api/inventory');
    const tools = res.cards.filter((c) => c.card.category === toolCategory);
    // เลือกเกรดดีสุดที่ความทนทานยัง > 0 (เหมือน logic ของ server) — เก็บการ์ดไว้แสดงผล
    let best: { card: InventoryCard; tier: number; cur: number; max: number } | null = null;
    for (const c of tools) {
      const max = toolMaxDurability(c.card.tier);
      const cur = c.durability ?? max;
      if (cur <= 0) continue;
      if (!best || c.card.tier > best.tier) best = { card: c, tier: c.card.tier, cur, max };
    }
    setHasTool(tools.length > 0);
    setToolTier(best ? best.tier : Math.max(1, ...tools.map((t) => t.card.tier)));
    setToolDura(best ? { cur: best.cur, max: best.max } : null);
    setBestTool(best ? best.card : null);
  }, [toolCategory]);

  useEffect(() => {
    void checkTool();
  }, [checkTool]);

  /** กดขุด: หักกำลัง/พลังงาน + ความทนทานก่อน → ค่อยเข้ามินิเกม 10 ครั้ง */
  async function startDig() {
    if (busy || flipPending) return;
    setBusy(true);
    try {
      const res = await api<{ message: string; toolTier: number; character: CharacterDTO }>('/api/gather/start', { method: 'POST', body: { zone, activity } });
      setCharacter(res.character);
      await checkTool(); // อัปเดตหลอดกำลัง/ความทนทานให้เห็นการหักทันที
      setDigGame(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เริ่มขุดไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  /** กดรับรางวัล: ขอผลจาก server แล้วให้ผู้เล่นลากพลิกการ์ดดูเฉลย */
  async function gather(miniLuck = 0) {
    if (busy || flipPending) return;
    setBusy(true);
    setResult(null);
    setDigGame(false);
    try {
      const res = await api<GatherResponse>('/api/gather', { method: 'POST', body: { zone, activity, luck: miniLuck } });
      setCharacter(res.character);
      setFlipPending(res);
      void checkTool(); // อัปเดตความทนทานเครื่องมือหลังใช้
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เก็บของไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-grid" style={{ alignContent: 'center' }}>
      <div className="panel" style={{ textAlign: 'center', padding: '26px 16px' }}>
        <div className="gather-banner"><Icon name={ui.banner} size={64} /></div>
        {zone === 'forest' && (
          <div className="tabs gather-tabs">
            <div className={`chip${activity === 'wood' ? ' active' : ''}`} onClick={() => setActivity('wood')}> ตัดไม้</div>
            <div className={`chip${activity === 'harvest' ? ' active' : ''}`} onClick={() => setActivity('harvest')}> เก็บเกี่ยว</div>
          </div>
        )}
        <h3 style={{ margin: '8px 0 4px' }}>{ui.title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.86rem', margin: '0 0 6px' }}>{ui.desc}</p>
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem', margin: '0 0 16px' }}>
          อัตรา: {ui.drops} · ต้องมี{ui.tool}ติดตัว (เกรด {''.repeat(toolTier)})
        </p>

        {/* เครื่องมือที่ใช้อยู่ + หลอดทรัพยากร (เหมือง=กำลัง / ป่า=พลังงาน) */}
        <div className="gather-status">
          {bestTool && toolDura && (
            <div className="gather-tool">
              <div className="gather-tool-card">
                <CardView
                  card={bestTool.card}
                  statusBadge={bestTool.status === 'EQUIPPED' ? 'สวมใส่' : undefined}
                  durability={{ cur: bestTool.durability ?? toolMaxDurability(bestTool.card.tier), max: toolMaxDurability(bestTool.card.tier) }}
                />
              </div>
              <div className="bar stam">
                <div className="fill" style={{ width: `${Math.max(0, Math.min(100, (toolDura.cur / toolDura.max) * 100))}%` }} />
                <span className="bar-num">{toolDura.cur}/{toolDura.max}</span>
              </div>
              <span className="gather-tool-label">ความทนทาน (−1 ต่อครั้ง)</span>
            </div>
          )}
          {character && (
            <div className="gather-vital">
              <span className="gather-vital-label"><Icon name="energy" size={15} /> กำลัง</span>
              <div className="bar stam" style={{ width: 220 }}>
                <div className="fill" style={{ width: `${Math.max(0, Math.min(100, (character.stam / character.stats.stamMax) * 100))}%` }} />
                <span className="bar-num">{character.stam}/{character.stats.stamMax}</span>
              </div>
              <span className="gather-vital-hint">ใช้ {GATHER_STAM_COST} ต่อครั้ง · ฟื้นต่อเทิร์นใน battle / นอกสนามตามความเร็ว</span>
            </div>
          )}
        </div>

        {hasTool === false && (
          <div className="panel" style={{ borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px' }}>
             คุณยังไม่มี{ui.tool} — คราฟต์ได้จากโรงคราฟต์ (ไม้+แร่) หรือซื้อจากร้านมือสอง
          </div>
        )}
        {hasTool && !toolDura && (
          <div className="panel" style={{ borderColor: 'var(--danger)', marginBottom: 14, padding: '10px 14px' }}>
             {ui.tool}พังหมดแล้ว (ความทนทาน 0) — เปิด<a href="/inventory">คลังการ์ด</a>กดซ่อมก่อน
          </div>
        )}

        <button
          className="btn primary big"
          disabled={
            busy || flipPending != null || hasTool === false || !toolDura ||
            (character ? character.stam < GATHER_STAM_COST : true)
          }
          onClick={() => void startDig()}
        >
          {' '}{ui.action}!
          {' '}(ใช้กำลัง {GATHER_STAM_COST})
        </button>
      </div>

      {flipPending && (
        <Modal title=" พลิกการ์ดรางวัล!">
          <FlipCard
            card={flipPending.card}
            onRevealed={() => { setResult(flipPending); setFlipPending(null); }}
          />
        </Modal>
      )}

      {result && (
        <Modal
          title={` ${ui.action}${zone === 'mine' ? 'เจอของ!' : 'ได้ของ!'}`}
          onClose={() => setResult(null)}
        >
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
              <div className="big-card-wrap" style={{ width: 190 }}>
                <CardView card={result!.card} />
              </div>
              <div className="q-rewards" style={{ justifyContent: 'center', display: 'flex', gap: 14 }}>
                <span> โบนัสทอง +{result!.goldBonus}</span>
                <span> XP +{result!.xp}</span>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0 }}>
                ได้ {CATEGORY_NAME_TH[result!.card.category]} เกรด {''.repeat(result!.card.tier || 1)} เข้าคลังแล้ว
              </p>
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={() => setResult(null)}><Icon name="cancel" size={14} /> ปิด</button>
                <button
                  className="btn primary"
                  disabled={busy || flipPending != null || !toolDura || (character ? character.stam < GATHER_STAM_COST : true)}
                  onClick={() => { setResult(null); void startDig(); }}
                >
                  {ui.action}ต่อ!
                </button>
              </div>
            </div>
        </Modal>
      )}

      {digGame && character && (
        <div className="modal-overlay">
          <div className="modal-shell">
            <div className="modal forge-modal">
              <MiniGame
                icon={zone === 'mine' ? 'pickaxe' : (activity === 'harvest' ? 'herb' : 'axe')}
                verb={ui.action}
                statLuck={character.stats.luck}
                onDone={(hits) => void gather(hits)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
