import { CardTemplate } from '@cardwar/shared';
import { ICONS } from '../icons-data';
import { artIconName } from '../cardIconMap';

// ===========================================================================
// CardBadgeIcon — ตรามุมบนซ้ายของการ์ด (64×64)
// สกิล = ตราหกเหลี่ยม / สัตว์เลี้ยง (สวมใส่) = สี่เหลี่ยมมุมแหลม / อื่น ๆ = วงกลม
// กรอบใช้สีตาม rarity ของการ์ด ตัวไอคอนด้านในมาจาก packages/icons (game-icons.net)
// ===========================================================================

const HEX = '32,4 56,16 56,40 32,60 8,40 8,16';
const ICON_SCALE = 0.086; // 512 → ~44 หน่วย กลางตรา (32,32)
const ICON_OFFSET = 32 - ICON_SCALE * 256;

export function CardBadgeIcon({ card, uid, frameUrl, banner }: { card: CardTemplate; uid: string; frameUrl: string; banner: string }) {
  void uid;
  const name = artIconName(card) ?? 'sack';
  const d = ICONS[name] ?? ICONS.sack;
  const icon = (
    <g transform={`translate(${ICON_OFFSET}, ${ICON_OFFSET}) scale(${ICON_SCALE})`}>
      <path d={d} fill="rgba(0,0,0,0.55)" transform="translate(16,20)" />
      <path d={d} fill="#e8ecf4" />
    </g>
  );
  if (card.group === 'skill') {
    return (
      <g>
        <polygon points={HEX} fill={banner} stroke={frameUrl} strokeWidth="2.6" />
        {icon}
      </g>
    );
  }
  if (card.group === 'pet') {
    return (
      <g>
        <rect x="6" y="6" width="52" height="52" fill={banner} stroke={frameUrl} strokeWidth="2.6" />
        {icon}
      </g>
    );
  }
  return (
    <g>
      <circle cx="32" cy="32" r="28" fill={banner} stroke={frameUrl} strokeWidth="2.6" />
      {icon}
    </g>
  );
}
