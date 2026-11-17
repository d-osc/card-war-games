import { useEffect, useId, useState } from 'react';
import { CardTemplate, CATEGORY_NAME_TH, Rarity, resourceCost, RARITY_NAME_TH, STAT_NAME_TH } from '@cardwar/shared';
import { CardBadgeIcon } from './CardBadgeIcon';
import { ICONS } from '../icons-data';
import { artIconName } from '../cardIconMap';

export { artIconName };


// ===========================================================================
// CardView — การ์ด SVG ตามดีไซน์ TCG 360×530
// โครง: แบนเนอร์ชื่อ / สัญลักษณ์ประเภท (วงกลม=Item, หกเหลี่ยม=Skill) /
//       เพชร Shard มุมขวาบน / หน้าต่างอาร์ต / ริบบอน rarity / Stats Bar /
//       Effect Box / Metadata ล่างสุด
// rarity mapping: C→Common(เงิน) UC→Uncommon(เขียว) R→Rare(น้ำเงิน)
//                 SR→Epic(ม่วง) SSR→Legendary(ทอง + มุมเพชร)
// ===========================================================================

interface Theme {
  frame: [string, string, string];
  shard: [string, string, string];
  bg: string;
  banner: string;
  art: string;
  ribbon: string;
  stats: string;
  effect: string;
  title: string;
  ribbonText: string;
  statText: string;
  costText: string;
  effectHead: string;
  body: string;
  flavor: string;
  meta: string;
  metaVal: string;
  frameW: number;
  cornerAccents?: boolean;
  rarityEn: string;
}

const THEMES: Record<Rarity, Theme> = {
  C: {
    frame: ['#cbd5e1', '#94a3b8', '#475569'], shard: ['#f1f5f9', '#94a3b8', '#475569'],
    bg: '#090d14', banner: '#0f172a', art: '#1e293b', ribbon: '#1e293b', stats: '#111827', effect: '#0b0f19',
    title: '#f8fafc', ribbonText: '#cbd5e1', statText: '#e2e8f0', costText: '#93c5fd',
    effectHead: '#e2e8f0', body: '#cbd5e1', flavor: '#64748b', meta: '#94a3b8', metaVal: '#f1f5f9',
    frameW: 5, rarityEn: 'COMMON',
  },
  UC: {
    frame: ['#86efac', '#22c55e', '#15803d'], shard: ['#bbf7d0', '#22c55e', '#14532d'],
    bg: '#05120a', banner: '#062e1a', art: '#064e3b', ribbon: '#064e3b', stats: '#062e1a', effect: '#041f12',
    title: '#f0fdf4', ribbonText: '#86efac', statText: '#86efac', costText: '#bbf7d0',
    effectHead: '#86efac', body: '#f0fdf4', flavor: '#6ee7b7', meta: '#86efac', metaVal: '#f0fdf4',
    frameW: 5, rarityEn: 'UNCOMMON',
  },
  R: {
    frame: ['#bae6fd', '#0ea5e9', '#0369a1'], shard: ['#e0f2fe', '#0ea5e9', '#075985'],
    bg: '#040e1a', banner: '#072b42', art: '#082f49', ribbon: '#0c4a6e', stats: '#0c4a6e', effect: '#061c2b',
    title: '#f0f9ff', ribbonText: '#7dd3fc', statText: '#7dd3fc', costText: '#bae6fd',
    effectHead: '#38bdf8', body: '#f0f9ff', flavor: '#7dd3fc', meta: '#7dd3fc', metaVal: '#f0f9ff',
    frameW: 5.5, rarityEn: 'RARE',
  },
  SR: {
    frame: ['#e9b8ff', '#c77dff', '#7b2cbf'], shard: ['#f3e8ff', '#c084fc', '#3b0764'],
    bg: '#090312', banner: '#240c36', art: '#1e1b4b', ribbon: '#3b0764', stats: '#3b0764', effect: '#130620',
    title: '#f3e8ff', ribbonText: '#e0aaff', statText: '#e0aaff', costText: '#f3e8ff',
    effectHead: '#c77dff', body: '#f1f5f9', flavor: '#a855f7', meta: '#c084fc', metaVal: '#f3e8ff',
    frameW: 6, rarityEn: 'EPIC',
  },
  SSR: {
    frame: ['#fff4b8', '#fff8d4', '#f3c853'], shard: ['#fff6cc', '#ffaa00', '#8a1c00'],
    bg: '#0a0d14', banner: '#241405', art: '#2b1706', ribbon: '#2b1706', stats: '#281608', effect: '#1c130b',
    title: '#fff9e6', ribbonText: '#ffd700', statText: '#ffd700', costText: '#fef08a',
    effectHead: '#ffd54f', body: '#f1f5f9', flavor: '#94a3b8', meta: '#d4af37', metaVal: '#ffd700',
    frameW: 6, cornerAccents: true, rarityEn: 'LEGENDARY',
  },
};

const RED = '#f87171';
const BLUE = '#60a5fa';
const CYAN = '#38bdf8';
const YELLOW = '#facc15';

function wrapText(s: string, max = 46): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

/** ตราประเภทมุมบนซ้าย: ไอคอนเวกเตอร์ (หกเหลี่ยม=Skill / วงกลม=Item) วาดในพื้นที่ 52×52 */

/** เนื้อหากล่องเอฟเฟกต์: หัวข้อ + โครงเอฟเฟกต์ 2 บรรทัด (flavor แยกใช้ description) */
function effectContent(t: CardTemplate): { header: string; lines: string[] } {
  const cost = resourceCost(t);
  const useTxt = `ใช้ ${cost.shard} Shard`;
  if (t.group === 'skill' && t.skill) {
    const s = t.skill;
    switch (s.kind) {
      case 'physical':
        return { header: ' โจมตีกายภาพ', lines: [`${useTxt} : สร้างดาเมจ ${s.power} + พลังโจมตีตัวละคร`, 'ลดด้วยการป้องกันศัตรู · จำกัด 1 ใบ/เทิร์น'] };
      case 'magic':
        return { header: ' เวทมนต์โจมตี', lines: [`${useTxt} : สร้างดาเมจ ${s.power} + พลังเวทตัวละคร`, 'ลดด้วยต้านเวทศัตรู · จำกัด 1 ใบ/เทิร์น'] };
      case 'heal':
        return { header: ' เวทมนต์รักษา', lines: [`${useTxt} : ฟื้นฟูพลังชีวิต ${s.power} + 30% ของพลังเวท`, 'ใช้ได้ในเทิร์นของตัวเอง'] };
      case 'shield':
        return { header: ' สร้างเกราะ', lines: [`${useTxt} : ได้เกราะกันดาเมจ ${s.power} จุด`, 'ใช้ได้ทั้งเทิร์นตัวเอง หรือตั้งรับระหว่างศัตรูโจมตี'] };
      case 'buff_atk':
        return { header: ' บัฟพลังโจมตี', lines: [`${useTxt} : เพิ่มพลังโจมตี +${s.power}`, `ต่อเนื่อง ${s.duration ?? 3} เทิร์น`] };
      case 'buff_matk':
        return { header: ' บัฟพลังเวท', lines: [`${useTxt} : เพิ่มพลังเวท +${s.power}`, `ต่อเนื่อง ${s.duration ?? 3} เทิร์น`] };
      case 'poison':
        return { header: ' พิษกัดกิน', lines: [`${useTxt} : ศัตรูติดพิษ ${s.power} ดาเมจ/เทิร์น`, `ต่อเนื่อง ${s.duration ?? 3} เทิร์น`] };
    }
  }
  if (t.group === 'pet' && t.pet) {
    return { header: ' อัญเชิญสัตว์เลี้ยง', lines: [`${useTxt} : โจมตีอัตโนมัติ ${t.pet.atk} ดาเมจทุกเทิร์น`, 'ค้างอยู่บนสนาม (สูงสุด 3 ตัว)'] };
  }
  if (t.group === 'consumable' && t.consumable) {
    const c = t.consumable;
    const parts: string[] = [];
    if (c.heal) parts.push(`HP +${c.heal}`);
    if (c.mana) parts.push(`มานา +${c.mana}`);
    if (c.stam) parts.push(`กำลัง +${c.stam}`);
    if (c.atkBuff) parts.push(`โจมตี +${c.atkBuff}`);
    if (c.matkBuff) parts.push(`เวท +${c.matkBuff}`);
    if (c.energy) parts.push(`พลังงาน +${c.energy} (กินนอกสนาม)`);
    return { header: t.category === 'potion' ? ' ยาสนามรบ' : ' อาหาร', lines: wrapText(parts.join(' · '), 46) };
  }
  if (t.group === 'equipment' && t.equip) {
    const statList = Object.entries(t.equip).map(([k, v]) => `${STAT_NAME_TH[k as keyof typeof STAT_NAME_TH]} +${v}`).join(' · ');
    return { header: ' อุปกรณ์สวมใส่', lines: wrapText(statList, 46) };
  }
  if (t.group === 'tool') {
    return { header: ' เครื่องมือ', lines: [`เกรด ${''.repeat(t.tier)} — ต้องมีติดตัวตอนเก็บของ`, 'เกรดสูงขึ้น พบของหายากบ่อยขึ้น'] };
  }
  return { header: ' วัตถุดิบ', lines: [`เกรด ${''.repeat(t.tier)} (${CATEGORY_NAME_TH[t.category]})`, 'ใช้คราฟต์ · ขาย · ตั้งเควสต์รับซื้อ'] };
}

/** แถบสถิติ: ซ้าย = ค่าหลักของการ์ด, ขวา = ต้นทุน MP/STA หรือราคา */
function statsContent(t: CardTemplate): { left: React.ReactNode; right: React.ReactNode } {
  const cost = resourceCost(t);
  if (t.group === 'skill' && t.skill) {
    const s = t.skill;
    const leftByKind: Record<string, [string, string, string, string]> = {
      physical: [' ATK', String(s.power), ' DEF', '0'],
      magic: [' MAG', String(s.power), ' DEF', '0'],
      heal: [' HEAL', String(s.power), ' DEF', '0'],
      shield: [' SHLD', String(s.power), ' HP', '0'],
      buff_atk: [' ATK', `+${s.power}`, '⏱ T', String(s.duration ?? 3)],
      buff_matk: [' MAG', `+${s.power}`, '⏱ T', String(s.duration ?? 3)],
      poison: [' PSN', String(s.power), '⏱ T', String(s.duration ?? 3)],
    };
    const [l1, l2, l3, l4] = leftByKind[s.kind];
    return {
      left: <>{l1}: <tspan fill={RED}>{l2}</tspan> &nbsp;/&nbsp; {l3}: <tspan fill={BLUE}>{l4}</tspan></>,
      right: <> MP: <tspan fill={CYAN}>{cost.mana}</tspan> &nbsp;|&nbsp;  STA: <tspan fill={YELLOW}>{cost.stam}</tspan></>,
    };
  }
  if (t.group === 'pet' && t.pet) {
    return {
      left: <> ATK: <tspan fill={RED}>{t.pet.atk}</tspan> &nbsp;/&nbsp;  HP: <tspan fill={BLUE}>{t.pet.hp}</tspan></>,
      right: <> <tspan fill={CYAN}>SUMMON</tspan></>,
    };
  }
  if (t.group === 'equipment' && t.equip) {
    const total = Object.values(t.equip).reduce((a, b) => a + b, 0);
    return {
      left: <> BONUS: <tspan fill={RED}>+{total}</tspan></>,
      right: <> <tspan fill={CYAN}>EQUIP</tspan></>,
    };
  }
  if (t.group === 'consumable' && t.consumable) {
    const c = t.consumable;
    return {
      left: <> <tspan fill={CYAN}>USE IN BATTLE</tspan></>,
      right: <> MP: <tspan fill={CYAN}>{c.mana ?? 0}</tspan> &nbsp;|&nbsp;  STA: <tspan fill={YELLOW}>{c.stam ?? 0}</tspan></>,
    };
  }
  return {
    left: <> TIER: <tspan fill={YELLOW}>{''.repeat(t.tier)}</tspan></>,
    right: <> <tspan fill={CYAN}>CRAFT</tspan></>,
  };
}

function typeEn(t: CardTemplate): string {
  if (t.group === 'skill') return 'SKILL';
  if (t.group === 'pet') return 'PET';
  if (t.group === 'equipment') return 'ITEM · EQUIP';
  if (t.group === 'consumable') return 'ITEM · USE';
  if (t.group === 'tool') return 'ITEM · TOOL';
  return 'ITEM · MATERIAL';
}

interface Props {
  card: CardTemplate;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  statusBadge?: string;
  showSerial?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** ความทนทานเครื่องมือ — แสดงเป็นป้ายบนการ์ด */
  durability?: { cur: number; max: number };
}

export default function CardView({ card, selected, disabled, onClick, statusBadge, showSerial, size = 'md', durability }: Props) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const t = THEMES[card.rarity];
  const cost = resourceCost(card);
  const eff = effectContent(card);
  const stats = statsContent(card);
  const nameSize = card.name.length > 16 ? 12 : card.name.length > 11 ? 14 : 15.5;
  // const badgeW = statusBadge ? statusBadge.length * 6.6 + 22 : 0;

  // อาร์ตกลางการ์ด: ใช้ภาพถ้าโหลดได้ (template.image หรือ /card-art/{id}.png) — ไม่ได้กลับไปใช้ไอคอน/อีโมจิ
  const [artSrc, setArtSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = card.image ?? `/card-art/${card.id}.png`;
    const img = new Image();
    img.onload = () => setArtSrc(url);
    img.onerror = () => setArtSrc(null);
    img.src = url;
    return () => { img.onload = null; img.onerror = null; };
  }, [card.id, card.image]);

  const cls = ['pcard-svg', size, selected ? 'selected' : '', disabled ? 'disabled' : ''].filter(Boolean).join(' ');

  // สีความทนทานตามสภาพ: >50% เขียว / 20-50% เหลือง / ต่ำแดง / พังเทา
  const duraText = durability ? `${durability.cur}/${durability.max}` : '';
  const duraColor = !durability ? ''
    : durability.cur <= 0 ? '#94a3b8'
    : durability.cur / durability.max > 0.5 ? '#86efac'
    : durability.cur / durability.max >= 0.2 ? '#fbbf24'
    : '#f87171';

  return (
    <div className={cls} onClick={onClick} title={card.description}>
      <svg className="tcg" viewBox="0 0 360 530" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={card.name}>
        <defs>
          <linearGradient id={`${uid}-f`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.frame[0]} /><stop offset="50%" stopColor={t.frame[1]} /><stop offset="100%" stopColor={t.frame[2]} />
          </linearGradient>
          <linearGradient id={`${uid}-s`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.shard[0]} /><stop offset="50%" stopColor={t.shard[1]} /><stop offset="100%" stopColor={t.shard[2]} />
          </linearGradient>
          <clipPath id={`${uid}-a`}><rect x="20" y="52" width="320" height="236" rx="10" /></clipPath>
        </defs>

        {/* เนื้อการ์ด + อาร์ต */}
        <rect x="4" y="4" width="352" height="522" rx="20" fill={t.bg} stroke="#000" strokeWidth="3" />
        <g clipPath={`url(#${uid}-a)`}>
          <rect x="20" y="52" width="320" height="236" fill={t.art} />
          {artSrc ? (
            <image href={artSrc} x="20" y="52" width="320" height="236" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <>
              <circle cx="180" cy="170" r="88" fill={t.frame[1]} opacity="0.16" />
              {(() => {
                const artKey = artIconName(card);
                const d = artKey ? ICONS[artKey] : null;
                if (d) {
                  const s = 0.42;
                  return (
                    <g transform={`translate(${180 - s * 256}, ${172 - s * 256}) scale(${s})`}>
                      <path d={d} fill={t.frame[2]} opacity="0.45" transform="translate(14,18)" />
                      <path d={d} fill={t.frame[0]} />
                    </g>
                  );
                }
                return <text x="180" y="192" textAnchor="middle" fontSize="86" className="cv-art">{card.emoji}</text>;
              })()}
            </>
          )}
        </g>
        <rect x="20" y="52" width="320" height="236" rx="10" fill="none" stroke={`url(#${uid}-f)`} strokeWidth="2.2" />
        <rect x="9" y="9" width="342" height="512" rx="16" fill="none" stroke={`url(#${uid}-f)`} strokeWidth={t.frameW} />

        {/* แบนเนอร์ชื่อ */}
        <g>
          <path d="M 52 18 L 308 18 L 324 50 L 36 50 Z" fill={t.banner} stroke={`url(#${uid}-f)`} strokeWidth="1.8" />
          <text x="180" y="40" fill={t.title} textAnchor="middle" className="cv-title" fontSize={nameSize}>{card.name}</text>
        </g>

        {/* ตราประเภท: วงกลม=Item / หกเหลี่ยม=Skill (ไอคอนเวกเตอร์ 64×64 ย่อลง 52×52 — กรอบใช้สี rarity ของการ์ด) */}
        <g transform="translate(12, 10) scale(0.8125)">
          <CardBadgeIcon card={card} uid={uid} frameUrl={`url(#${uid}-f)`} banner={t.banner} />
        </g>

        {/* เพชร Shard มุมขวาบน */}
        <g transform="translate(296, 8)">
          <polygon points="26,0 52,26 26,52 0,26" fill={t.banner} stroke={`url(#${uid}-f)`} strokeWidth="2.5" />
          <polygon points="26,5 47,26 26,47 5,26" fill={`url(#${uid}-s)`} stroke="#fff" strokeWidth="0.6" />
          <text x="26" y="35" fill="#fff" textAnchor="middle" className="cv-shard">{cost.shard}</text>
        </g>

        {/* ป้ายสถานะ (เดค/สวมใส่/วางขาย) */}
        {/* {statusBadge && (
          <g>
            <rect x={180 - badgeW / 2} y="58" width={badgeW} height="19" rx="6" fill="rgba(8,11,20,0.88)" stroke={t.frame[1]} strokeWidth="1" />
            <text x="180" y="71.5" textAnchor="middle" fill="#9fe8ff" className="cv-badge">{statusBadge}</text>
          </g>
        )} */}

        {/* ริบบอน rarity */}
        <g transform="translate(0, 282)">
          <polygon points="40,0 320,0 305,20 55,20" fill={t.ribbon} stroke={`url(#${uid}-f)`} strokeWidth="1.5" />
          <text x="180" y="14" fill={t.ribbonText} textAnchor="middle" className="cv-rarity">• {t.rarityEn} • {typeEn(card)} •</text>
        </g>

        {/* แถบสถิติ — การ์ดเครื่องมือที่ส่งความทนทานมา แสดงความทนทานแทนช่องซ้าย */}
        <g transform="translate(20, 308)">
          <rect x="0" y="0" width="320" height="28" rx="6" fill={t.stats} stroke={`url(#${uid}-f)`} strokeWidth="1.4" />
          {durability ? (
            <text x="12" y="19" fill={t.statText} className="cv-stat"> ทนทาน: <tspan fill={duraColor} fontWeight="900">{duraText}</tspan></text>
          ) : (
            <text x="12" y="19" fill={t.statText} className="cv-stat">{stats.left}</text>
          )}
          <text x="308" y="19" textAnchor="end" fill={t.costText} className="cv-stat">{stats.right}</text>
        </g>

        {/* กล่องเอฟเฟกต์ */}
        <g transform="translate(20, 342)">
          <rect x="0" y="0" width="320" height="150" rx="10" fill={t.effect} stroke={`url(#${uid}-f)`} strokeWidth="1.8" />
          <rect x="4" y="4" width="312" height="142" rx="8" fill="none" stroke={t.frame[1]} strokeWidth="0.6" strokeDasharray="4 2" opacity="0.3" />
          <text x="16" y="27" fill={t.effectHead} className="cv-effhead">{eff.header}</text>
          <text x="16" y="52" fill={t.body} className="cv-effbody">
            <tspan x="16" dy="0">{eff.lines[0]}</tspan>
            {eff.lines[1] && <tspan x="16" dy="22">{eff.lines[1]}</tspan>}
          </text>
          <line x1="16" y1="108" x2="304" y2="108" stroke={t.frame[2]} strokeWidth="0.8" opacity="0.5" />
          <text x="160" y="130" textAnchor="middle" fill={t.flavor} className="cv-flavor">&ldquo;{card.description}&rdquo;</text>
        </g>

        {/* Metadata ล่างสุด */}
        <g transform="translate(24, 492)">
          <text x="0" y="17" className="cv-meta" fill={t.meta}>ID: <tspan fill={t.metaVal} fontWeight="bold">#{showSerial ?? card.id.toUpperCase()}</tspan> &nbsp;|&nbsp; CARD WAR</text>
          <text x="312" y="17" textAnchor="end" className="cv-meta" fill={t.meta}>© 2026 • <tspan fill={t.metaVal} fontWeight="bold">{RARITY_NAME_TH[card.rarity]}</tspan></text>
        </g>

        {/* มุมเพชรสำหรับระดับสูงสุด */}
        {t.cornerAccents && (
          <g stroke={`url(#${uid}-f)`} strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M 12 38 L 38 12 M 16 48 L 48 16" /><path d="M 348 38 L 322 12 M 344 48 L 312 16" />
            <path d="M 12 492 L 38 518 M 16 482 L 48 514" /><path d="M 348 492 L 322 518 M 344 482 L 312 514" />
          </g>
        )}
      </svg>
    </div>
  );
}
