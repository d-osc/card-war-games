import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BattleSide, canPlayCard, CardTemplate, MAX_PETS, REUSE_DECK_COST, SLOTS_COUNT } from '@cardwar/shared';
import { getSocket } from '../socket';
import { useStore } from '../stores';
import type { BattleRewardsMsg, BattleStateMsg } from '../dto';
import CardView from '../components/CardView';
import CardBackView from '../components/CardBackView';
import Icon from '../components/Icon';
import { ICONS } from '../icons-data';
import Modal from '../components/Modal';
import { cardById, canPlayCard as canPlayEngine, isReactionCard } from '@cardwar/shared';

const MONSTER_FIGHTER_ICONS: Record<string, string> = {
  m_slime: 'slime', m_goblin: 'goblin', m_wolf_king: 'wolf', m_golem: 'golem', m_dragon: 'dragon',
};

function fighterIcon(side: BattleSide): string {
  if (side.isMonster) return MONSTER_FIGHTER_ICONS[side.uid] ?? 'goblin';
  return 'profile';
}

function SidePanel({ side, isMe, active }: { side: BattleSide; isMe: boolean; active: boolean }) {
  const hpPct = Math.max(0, (side.hp / side.maxHp) * 100);
  const manaPct = Math.max(0, Math.min(100, (side.mana / side.stats.manaMax) * 100));
  const stamPct = Math.max(0, Math.min(100, (side.stam / side.stats.stamMax) * 100));
  return (
    <div className={`battle-side${isMe ? ' me' : ''}${active ? ' turn-active' : ''}`}>
      <div className="fighter-row">
        <div className="emoji fighter-avatar"><Icon name={fighterIcon(side)} size={24} /></div>
        <div className="who">
          <div className="name">{side.name} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Lv.{side.level}</span> {active && <span style={{ color: 'var(--accent)' }}>• กำลังเล่นเทิร์น</span>}</div>
          <div className="mini-bars">
            <div className="bar hp"><div className="fill" style={{ width: `${hpPct}%` }} /><span className="bar-num">{Math.max(0, side.hp)}/{side.maxHp}</span></div>
            <div className="bar mana"><div className="fill" style={{ width: `${manaPct}%` }} /><span className="bar-num">{side.mana}/{side.stats.manaMax}</span></div>
            <div className="bar stam"><div className="fill" style={{ width: `${stamPct}%` }} /><span className="bar-num">{side.stam}/{side.stats.stamMax}</span></div>
            {side.shield > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="res-pill shield-pill"><Icon name="shield" size={12} /> {side.shield}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 5, justifyItems: 'end' }}>
          <span className="res-pill shard"><Icon name="gem" size={12} /> {side.shards}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="res-pill deck"><Icon name="cardPlay" size={12} /> มือ {side.hand.length}</span>
        <span className="res-pill deck"><Icon name="deck" size={12} /> เดค {side.deckCount}</span>
        {side.pets.length > 0 && (
          <span className="pets-row">
            {side.pets.map((p) => (
              <span key={p.uid} className="pet-chip"><Icon name="pet" size={12} /> {p.name} ×{p.atk}</span>
            ))}
            {side.pets.length < MAX_PETS && isMe && <span className="res-pill deck"><Icon name="pet" size={12} /> สัตว์เลี้ยง {side.pets.length}/{MAX_PETS}</span>}
          </span>
        )}
        {side.statuses.map((s, i) => (
          <span key={i} className={`status-chip ${s.kind}`}>
            {s.kind === 'poison' ? `พิษ ${s.value}×${s.turns}` : s.kind === 'atkUp' ? `โจมตี+${s.value}×${s.turns}` : `เวท+${s.value}×${s.turns}`}
          </span>
        ))}
      </div>
    </div>
  );
}

function CardBack() {
  return <CardBackView size="sm" />;
}


interface SlotRowProps {
  side: BattleSide;
  isMe: boolean;
  myTurn?: boolean;
  started?: boolean;
  onSlotClick: (index: number) => void;
}

function SlotRow({ side, isMe, myTurn, started, onSlotClick }: SlotRowProps) {
  return (
    <div className={`slot-row${isMe ? ' me' : ''}`}>
      {Array.from({ length: SLOTS_COUNT }, (_, i) => {
        const sc = side.slots[i];
        if (!sc) {
          return <div key={i} className="slot-empty-box" />;
        }
        const isKnown = isMe && sc.templateId != null;
        const t = isKnown ? cardById(sc.templateId!) : null;
        const isShield = t != null && isReactionCard(t);
        const readyToOpen = isShield && !myTurn && started;
        return (
          <div
            key={i}
            className={`slot-card-wrap${readyToOpen ? ' ready' : ''}${isMe && started ? ' clickable' : ''}`}
            onClick={isMe && started ? () => onSlotClick(i) : undefined}
            title={isKnown ? t!.name : 'การ์ดหมอบ'}
          >
            <CardBackView size="sm" />
            {readyToOpen && <span className="slot-ready-dot" />}
            {isKnown && <span className={`slot-rarity rarity-art-${t!.rarity}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function BattlePage() {
  const [params] = useSearchParams();
  const battleId = params.get('b') ?? '';
  const navigate = useNavigate();
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);

  const [msg, setMsg] = useState<BattleStateMsg | null>(null);
  const [over, setOver] = useState<{ winner: string | null; youWon: boolean; reason: string } | null>(null);
  const [rewards, setRewards] = useState<BattleRewardsMsg | null>(null);
  const [dcNote, setDcNote] = useState(false);
  const [handMenu, setHandMenu] = useState<string | null>(null);
  const [slotMenu, setSlotMenu] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [playedCard, setPlayedCard] = useState<{ templateId: string; by: 'a' | 'b'; countdown: number } | null>(null);
  const [defensePrompt, setDefensePrompt] = useState<{
    handShields: { uid: string; templateId: string }[];
    slotShields: { uid: string; templateId: string; slotIndex: number }[];
    countdown: number;
  } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setDefensePrompt((prev) => prev ? { ...prev, countdown: Math.max(0, prev.countdown - 0.5) } : null);
      setPlayedCard((prev) => {
        if (!prev) return null;
        if (prev.countdown <= 0.5) return null; // auto close
        return { ...prev, countdown: prev.countdown - 0.5 };
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!battleId) return;
    const socket = getSocket();
    socket.emit('battle:join', { battleId });

    const onState = (m: BattleStateMsg) => {
      if (m.battleId !== battleId) return;
      setMsg(m);
      if (m.state.phase === 'finished') {
        setOver((prev) => prev ?? { winner: m.state.winner, youWon: m.state.winner === m.you, reason: m.state.endReason });
      }
    };
    const onOver = (m: { battleId: string; winner: string | null; youWon: boolean; reason: string }) => {
      if (m.battleId !== battleId) return;
      setOver({ winner: m.winner, youWon: m.youWon, reason: m.reason });
    };
    const onRewards = (m: BattleRewardsMsg) => {
      setRewards(m);
      if (m.character) setCharacter(m.character);
    };
    const onError = (m: { message: string }) => showToast(m.message);
    const onDc = () => setDcNote(true);

    const onDefensePrompt = (m: { battleId: string; handShields: { uid: string; templateId: string }[]; slotShields: { uid: string; templateId: string; slotIndex: number }[]; timeoutMs: number }) => {
      if (m.battleId !== battleId) return;
      setDefensePrompt({ handShields: m.handShields, slotShields: m.slotShields, countdown: Math.ceil(m.timeoutMs / 1000) });
    };
    const onDefenseResolved = (m: { battleId: string }) => {
      if (m.battleId !== battleId) return;
      setDefensePrompt(null);
    };

    socket.on('battle:state', onState);
    socket.on('battle:over', onOver);
    socket.on('battle:rewards', onRewards);
    socket.on('battle:error', onError);
    socket.on('battle:opponent_dc', onDc);
    const onPlayedCard = (m: { battleId: string; templateId: string; by: 'a' | 'b' }) => {
      if (m.battleId !== battleId) return;
      setPlayedCard({ templateId: m.templateId, by: m.by, countdown: 5 });
    };

    socket.on('defense:prompt', onDefensePrompt);
    socket.on('defense:resolved', onDefenseResolved);
    socket.on('battle:playedCard', onPlayedCard);
    return () => {
      socket.off('battle:state', onState);
      socket.off('battle:over', onOver);
      socket.off('battle:rewards', onRewards);
      socket.off('battle:error', onError);
      socket.off('battle:opponent_dc', onDc);
      socket.off('defense:prompt', onDefensePrompt);
      socket.off('defense:resolved', onDefenseResolved);
      socket.off('battle:playedCard', onPlayedCard);
    };
  }, [battleId, setCharacter, showToast]);

  const view = useMemo(() => {
    if (!msg) return null;
    const me = msg.you === 'a' ? msg.state.a : msg.state.b;
    const foe = msg.you === 'a' ? msg.state.b : msg.state.a;
    return { me, foe, you: msg.you, state: msg.state };
  }, [msg]);

  const myTurn = view != null && view.state.phase === 'playing' && view.state.active === view.you && !!msg?.started;
  const secondsLeft = msg && msg.turnEndsAt > 0 ? Math.max(0, Math.ceil((msg.turnEndsAt - now) / 1000)) : 0;

  if (!battleId) {
    return (
      <div className="empty">
        ไม่พบรหัสการต่อสู้
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => navigate('/')}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  if (!view) {
    return <div className="page-loading">กำลังเข้าสนามประลอง…</div>;
  }

  function play(handUid: string) {
    if (!msg!.started || view!.state.phase !== 'playing') return;
    const check = canPlayCard(view!.state, view!.you, handUid);
    if (!check.ok) {
      showToast(check.reason ?? 'เล่นการ์ดไม่ได้');
      return;
    }
    getSocket().emit('battle:action', { battleId, type: 'play', handUid });
  }

  function endTurn() {
    getSocket().emit('battle:action', { battleId, type: 'endTurn' });
  }

  function respondDefense(choice: 'skip' | 'useHand' | 'useSlot', handUid?: string, slotIndex?: number) {
    getSocket().emit('battle:action', { battleId, type: 'defenseRespond', choice, handUid, slotIndex });
    setDefensePrompt(null);
  }

  function doReuseDeck() {
    getSocket().emit('battle:action', { battleId, type: 'reuseDeck' });
  }

  function surrender() {
    getSocket().emit('battle:action', { battleId, type: 'surrender' });
  }

  function placeCard(handUid: string, slotIndex?: number) {
    getSocket().emit('battle:action', { battleId, type: 'place', handUid, slotIndex });
  }

  function openSlot(slotIndex: number) {
    getSocket().emit('battle:action', { battleId, type: 'open', slotIndex });
  }


  return (
    <div className="battle-outer">
      {/* ช่อง 1 — เดคศัตรู (ถูกพักไว้ก่อน)
      <aside className="battle-col battle-col-foe">
        <div className="deck-pile foe">
          <div className="deck-pile-card">
            <CardBackView size="sm" />
            <span className="deck-pile-count">{view.foe.deckCount}</span>
          </div>
          <div className="deck-pile-label">เดคศัตรู่</div>
        </div>
      </aside>
      */}

      {/* ช่อง 2 — สนามรบ */}
      <div className="battle-wrap">
      <SidePanel side={view.foe} isMe={false} active={view.state.active !== view.you && view.state.phase === 'playing'} />

      {view.foe.hand.length > 0 && (
        <div className="hand-row" style={{ opacity: 0.65 }}>
          {view.foe.hand.map((h) => <CardBack key={h.uid} />)}
        </div>
      )}

      {/* ช่องวางการ์ดฝั่งตรงข้าม (บน 5 ช่อง) */}
      <SlotRow side={view.foe} isMe={false} onSlotClick={() => {}} />

      {/* ปุ่มลอยเปิดบันทึกการต่อสู้ */}
      <button className="log-fab" onClick={() => setLogOpen(true)} title="บันทึกการต่อสู้">
        <Icon name="quests" size={22} />
      </button>

      {/* Dialog เต็มจอ — บันทึกการต่อสู้ (ใหม่สุดอยู่บน) */}
      {logOpen && (
        <div className="log-dialog" onClick={() => setLogOpen(false)}>
          <div className="log-dialog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-dialog-head">
              <strong><Icon name="quests" size={18} /> บันทึกการต่อสู้</strong>
              <button className="btn sm" onClick={() => setLogOpen(false)}>
                <Icon name="cancel" size={14} /> ปิด
              </button>
            </div>
            <div className="log-dialog-body">
              {view.state.log.length === 0 && <div className="empty">ยังไม่มีบันทึก</div>}
              {[...view.state.log].reverse().map((l, i) => (
                <div key={i} className={i === 0 ? 'latest' : ''}>
                  <span className="log-turn">เทิร์น {l.turnNo}</span> {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ศูนย์กลางสนาม — ข้อมูลเทิร์น + ปุ่มจบเทิร์น + ยอมแพ้ รวมกันกลางสนาม */}
      <div className="battle-center">
        <div className="battle-center-info">
          <strong>เทิร์นที่ {view.state.turnNo}</strong>
          {view.state.phase === 'playing' && msg!.started && (
            <span className="turn-timer" style={{ marginLeft: 10 }}>⏱ {secondsLeft}s</span>
          )}
        </div>
        <button className="btn accent big" disabled={!myTurn} onClick={endTurn}>
          จบเทิร์น
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {dcNote && <span className="res-pill deck"><Icon name="cancel" size={12} /> คู่ต่อสู้หลุดการเชื่อมต่อ (30 วิถือว่าแพ้)</span>}
          {view.state.phase === 'playing' && (
            <button className="btn sm danger" onClick={surrender}><Icon name="flag" size={14} /> ยอมแพ้</button>
          )}
        </div>
      </div>

      {/* ช่องวางการ์ดฝั่งเรา (ล่าง 5 ช่อง) */}
      <SlotRow
        side={view.me}
        isMe
        myTurn={myTurn}
        started={!!msg!.started && view.state.phase === 'playing'}
        onSlotClick={(idx) => {
          if (view.me.slots[idx]) setSlotMenu(idx);
        }}
      />

      <div className="hand-row">
        {view.me.hand.length === 0 && <div className="empty" style={{ width: '100%' }}>มือว่าง — จบเทิร์นเพื่อจั่วการ์ด</div>}
        {view.me.hand.map((h) => {
          if (h.templateId == null) return <CardBack key={h.uid} />;
          const t: CardTemplate = cardById(h.templateId);
          const inPlay = !!msg!.started && view.state.phase === 'playing';
          const check = canPlayEngine(view.state, view.you, h.uid);
          const playable = inPlay && check.ok;
          const isReaction = !myTurn && playable;
          return (
            <CardView
              key={h.uid}
              card={t}
              disabled={!inPlay}
              statusBadge={isReaction ? 'ตั้งรับ!' : undefined}
              onClick={() => setHandMenu(h.uid)}
            />
          );
        })}
      </div>

      {/* แผงตัวละครฝั่งเรา — อยู่ล่างสุดใต้มือการ์ด */}
      <SidePanel side={view.me} isMe active={myTurn} />

      {/* Menu การ์ดในมือ: ใช้ / หมอบ / ทิ้ง */}
      {handMenu != null && (() => {
        const hc = view.me.hand.find((h) => h.uid === handMenu);
        if (!hc?.templateId) return null;
        const t = cardById(hc.templateId);
        const check = canPlayEngine(view.state, view.you, handMenu);
        const canPlace = myTurn && !view.me.placedThisTurn;
        const hasEmptySlot = view.me.slots.some((s) => s == null);
        return (
          <Modal title={t.name} onClose={() => setHandMenu(null)} wide>
            <div className="card-detail">
              <div className="big-card-wrap">
                <CardView card={t} size="xl" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="btn-row" style={{ flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                  <button className="btn primary big" disabled={!check.ok} onClick={() => { play(handMenu); setHandMenu(null); }}>
                    <Icon name="cardPlay" size={18} /> ใช้งานในมือ
                    {!check.ok && <span style={{ fontSize: '0.75rem', marginLeft: 6, color: 'var(--danger)' }}>({check.reason})</span>}
                  </button>
                  <button className="btn accent big" disabled={!canPlace || !hasEmptySlot} onClick={() => { placeCard(handMenu); setHandMenu(null); }}>
                    <Icon name="deck" size={18} /> หมอบการ์ดลงช่อง
                    {!canPlace && <span style={{ fontSize: '0.75rem', marginLeft: 6 }}>(หมอบได้ 1 ครั้ง/เทิร์น ช่วงเทิร์นตัวเอง)</span>}
                    {canPlace && !hasEmptySlot && <span style={{ fontSize: '0.75rem', marginLeft: 6 }}>(ช่องเต็ม)</span>}
                  </button>
                  <button className="btn ghost big" onClick={() => setHandMenu(null)}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Menu การ์ดหมอบในช่อง: เปิดใช้ */}
      {slotMenu != null && (() => {
        const sc = view.me.slots[slotMenu];
        if (!sc) { setSlotMenu(null); return null; }
        const t = sc.templateId ? cardById(sc.templateId) : null;
        const isShield = t != null && isReactionCard(t);
        const canOpen = (!!msg!.started && view.state.phase === 'playing') && (myTurn || isShield);
        return (
          <Modal title={t ? t.name : 'การ์ดหมอบ'} onClose={() => setSlotMenu(null)}>
            <div style={{ textAlign: 'center' }}>
              {t && <div style={{ display: 'grid', placeItems: 'center', marginBottom: 12 }}><CardView card={t} size="lg" /></div>}
              <div className="btn-row" style={{ justifyContent: 'center' }}>
                <button className="btn primary big" disabled={!canOpen} onClick={() => { openSlot(slotMenu); setSlotMenu(null); }}>
                  <Icon name="sparkles" size={18} /> เปิดการ์ดใช้งาน
                  {!myTurn && isShield && <span style={{ fontSize: '0.75rem', marginLeft: 6 }}>(ตั้งรับ!)</span>}
                  {!myTurn && !isShield && <span style={{ fontSize: '0.75rem', marginLeft: 6, color: 'var(--danger)' }}>(เทิร์นศัตรูเปิดได้เฉพาะโล่)</span>}
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {!msg!.started && view.state.phase === 'playing' && (
        <div className="empty">รออีกฝ่ายเข้าสนาม…</div>
      )}

      {playedCard && (() => {
        const t = cardById(playedCard.templateId);
        const isMine = playedCard.by === view.you;
        return (
          <div className="played-card-overlay" onClick={() => setPlayedCard(null)}>
            <div className="played-card-show" onClick={() => setPlayedCard(null)}>
              <div className="played-card-header">
                <span className={isMine ? 'text-success' : 'text-danger'}>
                  {isMine ? 'คุณใช้' : 'ศัตรูใช้'}
                </span>
                <span className="turn-timer">{Math.ceil(playedCard.countdown)}s</span>
              </div>
              <div className="big-card-wrap">
                <CardView card={t} size="xl" />
              </div>
            </div>
          </div>
        );
      })()}

      {defensePrompt && (() => {
        const allShields = [
          ...defensePrompt.handShields.map((s) => ({ ...s, source: 'hand' as const })),
          ...defensePrompt.slotShields.map((s) => ({ ...s, source: 'slot' as const })),
        ];
        return (
          <Modal title="กำลังถูกโจมตี!" dismissable={false}>
            <div style={{ textAlign: 'center' }}>
              <div className="defense-alert">
                <Icon name="pvp" size={36} />
              </div>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '8px 0 4px' }}>ฝ่ายตรงข้ามกำลังจะโจมตีคุณ!</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: '0 0 14px' }}>
                เลือกการ์ดป้องกัน หรือข้ามเพื่อรับดาเมจ
                <span className="turn-timer" style={{ marginLeft: 8, color: defensePrompt.countdown <= 3 ? 'var(--danger)' : 'var(--accent)' }}>
                  {Math.ceil(defensePrompt.countdown)}s
                </span>
              </p>
              {allShields.length > 0 && (
                <div className="defense-shield-list">
                  {allShields.map((s) => {
                    const t = cardById(s.templateId);
                    return (
                      <div
                        key={s.uid}
                        className="defense-shield-option"
                        onClick={() => respondDefense(s.source === 'hand' ? 'useHand' : 'useSlot', s.source === 'hand' ? s.uid : undefined, s.source === 'slot' ? s.slotIndex : undefined)}
                      >
                        <CardView card={t} size="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn danger big" onClick={() => respondDefense('skip')}>
                  ไม่ป้องกัน (รับดาเมจ)
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {over && (
        <Modal title={over.youWon ? 'ชนะ!' : 'แพ้…'} onClose={() => navigate('/')} dismissable={rewards != null}>
          <div style={{ textAlign: 'center' }}>
            <div className="result-icon">{over.youWon ? <Icon name="trophy" size={64} /> : <Icon name="cancel" size={64} />}</div>
            <p style={{ color: 'var(--muted)' }}>{over.reason}</p>
            {rewards && (
              <div className="q-rewards" style={{ justifyContent: 'center', display: 'flex', gap: 14, margin: '10px 0' }}>
                {rewards.gold != null && <span className="cell-label"><Icon name="gold" size={13} /> {rewards.gold > 0 ? '+' : ''}{rewards.gold}</span>}
                {rewards.xp != null && <span className="cell-label"><Icon name="sparkles" size={13} /> +{rewards.xp} XP</span>}
                {rewards.ratingDelta != null && <span className="cell-label"><Icon name="trophy" size={13} /> {rewards.ratingDelta > 0 ? '+' : ''}{rewards.ratingDelta} (รวม {rewards.newRating})</span>}
              </div>
            )}
            {rewards?.cards && rewards.cards.length > 0 && (
              <div className="gacha-results">
                {rewards.cards.map((id, i) => (
                  <CardView key={i} card={cardById(id)} />
                ))}
              </div>
            )}
            {rewards?.cards && rewards.cards.length > 0 && <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>การ์ดที่ได้รับจากดันเจี้ยน</p>}
            <div className="btn-row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <button className="btn" onClick={() => navigate('/')}>หน้าหลัก</button>
              <button className="btn primary" onClick={() => navigate(view.state.mode === 'pve' ? '/dungeon' : '/pvp')}>
                {view.state.mode === 'pve' ? 'ไปดันเจี้ยนต่อ' : view.state.mode === 'challenge' ? 'ท้าคู่อื่นต่อ' : 'ประลองต่อ'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      </div>

      {/* ช่อง 3 — เดคเรา (ถูกพักไว้ก่อน)
      <aside className="battle-col battle-col-me">
        <div className="deck-pile me">
          <div className="deck-pile-card">
            <CardBackView size="sm" />
            <span className="deck-pile-count">{view.me.deckCount}</span>
          </div>
          <div className="deck-pile-label">เดค</div>
          {view.me.usedCards.length > 0 && (
            <div className="deck-pile-used">
              <Icon name="sparkles" size={12} /> {view.me.usedCards.length} ใบที่ใช้แล้ว
            </div>
          )}
          {myTurn && view.me.usedCards.length > 0 && (
            <button
              className="btn sm deck-pile-recycle"
              disabled={view.me.shards < REUSE_DECK_COST}
              onClick={doReuseDeck}
              title={view.me.shards < REUSE_DECK_COST ? `ต้องมี ${REUSE_DECK_COST} ชาร์ด (มี ${view.me.shards})` : `นำการ์ด ${view.me.usedCards.length} ใบกลับเข้าเดค`}
            >
              <Icon name="sparkles" size={12} /> รีไซเคิล ({REUSE_DECK_COST} ชาร์ด)
            </button>
          )}
        </div>
      </aside>
      */}
    </div>
  );
}
