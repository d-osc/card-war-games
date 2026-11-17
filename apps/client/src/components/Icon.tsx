import { ICONS } from '../icons-data';

/**
 * ไอคอนเวกเตอร์จากชุด game-icons.net (packages/icons) — path เดียว 512×512
 * ระบายสีตาม currentColor จึงเปลี่ยนสีตามสถานะ (active/hover) อัตโนมัติ
 */
export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
