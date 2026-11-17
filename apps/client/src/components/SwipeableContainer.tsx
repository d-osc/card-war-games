import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

interface Props {
  pages: { id: string; label: string; icon?: string; content: React.ReactNode }[];
  initialPage?: number;
}

/**
 * Full-screen swipeable container — ปัดซ้าย/ขวาเพื่อเปลี่ยนหน้า (mobile)
 * Navigation bar ล่างเป็น icon + label (คลิกเพื่อเปลี่ยนหน้า)
 */
export default function SwipeableContainer({ pages, initialPage = 0 }: Props) {
  const [current, setCurrent] = useState(initialPage);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(pages.length - 1, idx)));
  }, [pages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  };

  const onPointerUp = () => {
    if (!dragging) return;
    const threshold = 80;
    if (dragX < -threshold && current < pages.length - 1) goTo(current + 1);
    else if (dragX > threshold && current > 0) goTo(current - 1);
    setDragging(false);
    setDragX(0);
  };

  const translateX = -current * 100 + (dragging ? (dragX / (containerRef.current?.clientWidth || 1)) * 100 : 0);

  return (
    <div className="swipeable-container" ref={containerRef}>
      <div
        className="swipeable-track"
        style={{ transform: `translateX(${translateX}%)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {pages.map((page) => (
          <div key={page.id} className="swipeable-page">
            {page.content}
          </div>
        ))}
      </div>

      {/* Navigation bar — icon + label แต่ละหน้า */}
      <div className="swipeable-nav">
        {pages.map((page, i) => (
          <button
            key={page.id}
            className={`swipeable-nav-item${i === current ? ' active' : ''}`}
            onClick={() => goTo(i)}
            title={page.label}
          >
            <span className="nav-icon">
              <Icon name={page.icon ?? 'deck'} size={22} />
            </span>
            <span className="nav-label">{page.label}</span>
          </button>
        ))}
      </div>

      {/* Arrow buttons (desktop) */}
      <button className="swipeable-arrow prev" onClick={() => goTo(current - 1)} disabled={current === 0}>
        ‹
      </button>
      <button className="swipeable-arrow next" onClick={() => goTo(current + 1)} disabled={current === pages.length - 1}>
        ›
      </button>
    </div>
  );
}
