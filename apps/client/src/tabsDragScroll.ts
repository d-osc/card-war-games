// ให้ container ที่ระบุ กดค้าง-ลากเพื่อเลื่อนได้ด้วยเมาส์/ปากกา (ทั้งแกนตั้งและแนวนอน)
import { useStore } from './stores';
// (มือถือข้ามไว้ — สัมผัสนิ้วเลื่อนแบบ native อยู่แล้ว จะได้ไม่ชนกัน)
const DRAG_SCROLL_SELECTOR = '.tabs, .craft-select-list, .craft-select-list-2, .grid-cards, .grid-cards-deck, .fs-card-grid, .gacha-flip-grid';

export function enableDragScroll() {
  let el: HTMLElement | null = null;
  let fromFlip = false; // เริ่มลากบนการ์ดพลิก — แนวนอนเป็นของการพลิก ให้เลื่อนเฉพาะแนวตั้ง
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragged = false;

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    if (!useStore.getState().settings.dragScroll) return;
    const target = e.target as HTMLElement;
    const box = target.closest<HTMLElement>(DRAG_SCROLL_SELECTOR);
    if (!box) return;
    el = box;
    fromFlip = !!target.closest('.flip-card');
    startX = e.clientX;
    startY = e.clientY;
    startLeft = box.scrollLeft;
    startTop = box.scrollTop;
    dragged = false;
  });

  document.addEventListener('pointermove', (e) => {
    if (!el) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragged) {
      // เริ่มจับการลากเมื่อขยับชัดเจนพอ กดธรรมดาแล้วคลิกยังทำงานปกติ
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
      // ลากแนวนอนบนการ์ดพลิก = ท่าพลิกการ์ด — ปล่อยให้ FlipCard จัดการเอง
      if (fromFlip && Math.abs(dx) > Math.abs(dy)) { el = null; return; }
      dragged = true;
      el.classList.add('drag-scrolling');
      // การ์ดพลิกต้องการ pointer events ต่อ — ไม่แย่ง capture ไปจากมัน
      if (!fromFlip) {
        try { el.setPointerCapture(e.pointerId); } catch { /* pointer ไม่ active (เช่น event จำลอง) — ไม่เป็นไร */ }
      }
    }
    el.scrollLeft = startLeft - dx;
    el.scrollTop = startTop - dy;
  });

  function end() {
    if (!el) return;
    const box = el;
    el = null;
    if (dragged) {
      box.classList.remove('drag-scrolling');
      // กลืน click ที่ตามมาหลังปล่อยเมาส์ กันการ์ด/chip ถูกเลือกโดยไม่ตั้งใจ
      box.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    }
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}
