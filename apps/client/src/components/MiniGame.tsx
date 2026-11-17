import { useEffect, useRef, useState } from 'react';
import { gachaRates } from '@cardwar/shared';
import Icon from './Icon';
import { useStore } from '../stores';

// ===========================================================================
// มินิเกมโซนทอง — กดตอนสัญลักษณ์อยู่ในโซนสีทอง 10 ครั้ง
// ใช้ร่วมทุกหน้า (ขุดแร่/ตัดไม้/ซ่อม/คราฟต์) — จำนวนที่โดนส่งกลับผ่าน onDone
//   statLuck    : หน้าขุด — โชคจากสเตตัส จะแสดงรวมกับโชคมินิเกม
//   bonusPerHit : หน้าคราฟต์ — โบนัสคะแนนต่อการโดน 1 ครั้ง
// ===========================================================================
export default function MiniGame({ icon, verb, rounds = 10, statLuck, bonusPerHit, luckOnly, luckMultiplier = 1, hint, doneLabel = 'รับรางวัล', doneIcon = 'gold', onDone }: {
  icon: string;
  verb: string;
  rounds?: number;
  statLuck?: number;
  bonusPerHit?: number;
  luckOnly?: boolean;
  luckMultiplier?: number;
  hint?: string;
  doneLabel?: string;
  doneIcon?: string;
  onDone: (hits: number) => void;
}) {
  const [round, setRound] = useState(0);
  const [hits, setHits] = useState(0);
  const [marker, setMarker] = useState(0);
  const [zonePos, setZonePos] = useState({ start: 40, width: 20 });
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  const [done, setDone] = useState(false);
  const keyboardOn = useStore((s) => s.settings.keyboardShortcut);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const lockRef = useRef(false);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  const speed = 60 + round * 12; // % ต่อวินาที — เร็วขึ้นทุกรอบ

  useEffect(() => {
    const width = Math.max(12, 22 - round * 2);
    setZonePos({ start: 12 + Math.random() * (76 - width), width });
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
    const ok = p >= zonePos.start && p <= zonePos.start + zonePos.width;
    setFlash(ok ? 'hit' : 'miss');
    if (ok) setHits((h) => h + 1);
    setTimeout(() => {
      setFlash(null);
      if (round + 1 >= rounds) setDone(true);
      else setRound((r) => r + 1);
    }, 380);
  }

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (!keyboardOn) return;
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        strike();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardOn]);

  const effLuck = Math.min(10, hits * luckMultiplier);
  const luckSummary = luckOnly ? (
    <>
      <p>
        โชคจากมินิเกม +{hits}{luckMultiplier > 1 ? <> ×{luckMultiplier} = <b>{effLuck}</b></> : null} — <b>เพิ่มโชคเฉพาะรอบเปิดการ์ดครั้งนี้เท่านั้น</b>
      </p>
      <p>อัตรารอบนี้: {gachaRates(effLuck).map(([r, w]) => `${r} ${w.toFixed(1)}%`).join(' · ')}</p>
    </>
  ) : null;

  const summary = statLuck != null
    ? <p>โชคจากมินิเกม +{hits} · โชคจากสเตตัส +{statLuck} = <b>รวม {hits + statLuck}</b></p>
    : luckSummary
      ? luckSummary
      : bonusPerHit != null
        ? <p>โบนัสคะแนนวัตถุดิบ +{(hits * bonusPerHit).toFixed(1)} — ยิ่งโดนมาก ยิ่งมีโอกาสได้ของดี</p>
        : null;

  return (
    <div className="forge-game">
      <div className="forge-head">
        <span className="forge-title"><Icon name={icon} size={18} /> {verb}ให้โดนจุดทอง</span>
        <span className="forge-progress">ครั้งที่ {Math.min(round + 1, rounds)}/{rounds} · โดน {hits}</span>
      </div>

      {!done ? (
        <>
          <div className={`forge-track${flash ? ` ${flash}` : ''}`}>
            <div className="forge-zone" style={{ left: `${zonePos.start}%`, width: `${zonePos.width}%` }} />
            <div className="forge-marker" style={{ left: `${marker}%` }}>
              <span className="forge-hammer"><Icon name={icon} size={22} /></span>
            </div>
          </div>
          <button className="btn primary big forge-strike" onClick={strike}>
            {verb}! (Space)
          </button>
          <p className="forge-hint">{hint ?? 'กดตอนสัญลักษณ์อยู่ในโซนสีทอง — ยิ่งโดนมาก ยิ่งดี'}</p>
        </>
      ) : (
        <div className="forge-result">
          <div className="forge-score">
            {Array.from({ length: rounds }, (_, i) => (
              <span key={i} className={`dot${i < hits ? ' on' : ''}`} />
            ))}
          </div>
          <p className="forge-big">โดน {hits}/{rounds} ครั้ง</p>
          {summary}
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn primary big" onClick={() => onDone(hits)}>
              <Icon name={doneIcon} size={16} /> {doneLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
