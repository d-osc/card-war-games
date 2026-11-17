import { useRef, useState } from 'react';
import type { CardTemplate } from '@cardwar/shared';
import CardView from './CardView';
import CardBackView from './CardBackView';
import Icon from './Icon';

// พลิกการ์ดเฉลย — แสดงหลังการ์ด แล้วลากไปทางขวาเพื่อพลิกดูผล
// hint = null จะซ่อนคำใบ้ (ใช้ตอนแสดงหลายใบพร้อมกัน แล้วเขียนคำใบ้รวมทีเดียว)
export default function FlipCard({ card, onRevealed, hint }: { card: CardTemplate; onRevealed: () => void; hint?: string | null }) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const dragRef = useRef<{ startX: number; base: number } | null>(null);

  function down(e: React.PointerEvent) {
    if (flipping) return;
    dragRef.current = { startX: e.clientX, base: angle };
    setDragging(true);
    // จับ pointer ไว้กับการ์ด — ลากเลยขอบการ์ดเร็ว ๆ เหตุการณ์ยังตามมาถึง ไม่สะดุดกลางคัน
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer ไม่ active — ไม่เป็นไร */ }
  }
  function move(e: React.PointerEvent) {
    if (!dragRef.current || flipping) return;
    const delta = e.clientX - dragRef.current.startX;
    setAngle(Math.max(0, Math.min(180, dragRef.current.base + delta * 0.9)));
  }
  function up() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (angle > 80) {
      setFlipping(true);
      setAngle(180);
      setTimeout(onRevealed, 650);
    } else {
      setAngle(0);
    }
  }

  return (
    <div className="flip-wrap">
      <div
        className={`flip-card${dragging ? ' dragging' : ''}`}
        style={{ transform: `rotateY(${angle}deg)` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="flip-face flip-front"><CardBackView size="md" /></div>
        <div className="flip-face flip-back"><CardView card={card} /></div>
      </div>
      {hint !== null && <p className="flip-hint"><Icon name="cardPlay" size={16} /> {hint ?? 'ลากการ์ดไปทางขวาเพื่อพลิกดูรางวัล'}</p>}
    </div>
  );
}
