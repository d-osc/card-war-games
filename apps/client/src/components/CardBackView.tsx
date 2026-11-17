import { useId } from 'react';
import { Rarity } from '@cardwar/shared';

// ===========================================================================
// CardBackView — หลังการ์ด SVG 360×530 ตามดีไซน์ระบบหลังการ์ด 12 ระดับ
// โครง: พื้นเข้ม + ลายพับรบุ (diamond pattern) + กรอบ gradient ตามระดับ +
//       เส้นใน + มุมเฉียง + สัญลักษณ์กลาง (เพชรใหญ่ → วงเรืองแสง → วงเส้นประ →
//       ดาว 8 แฉก → วงใน → เพชรแกนกลาง)
// ใช้ 6 ธีม: 5 rarity ของเกม + ธีมแบรนด์ (ค่าเริ่มต้น สำหรับการ์ดคว่ำฝั่งตรงข้าม)
// ===========================================================================

interface BackTheme {
  frame: [string, string, string];
  glow: [string, string]; // สี + opacity ของ radial กลาง
  glowOp: [number, number];
  pattern: string;
  bg: string;
  diamond: string;
  star: string;
  inner: string;
  center: string;
  dash: string;
  innerLine: string;
  frameW: number;
  slashW: number;
  // ขนาดสัญลักษณ์กลาง (ใหญ่ขึ้นตามระดับ)
  e: { D: number; W: number; R: number; r: number; c: number };
}

const THEMES: Record<string, BackTheme> = {
  brand: {
    frame: ['#f7e7b0', '#d4af37', '#7a5c12'], glow: ['#ffd75e', '#8a6d1d'], glowOp: [0.9, 0.5],
    pattern: '#d4af37', bg: '#0a0d14', diamond: '#131a2e', star: '#1b2540', inner: '#0b0f1a',
    center: '#ffd75e', dash: '#f5e6b8', innerLine: '#d4af37', frameW: 5.5, slashW: 2.5,
    e: { D: 208, W: 140, R: 86, r: 48, c: 16 },
  },
  C: {
    frame: ['#f1f5f9', '#94a3b8', '#475569'], glow: ['#cbd5e1', '#334155'], glowOp: [0.8, 0.4],
    pattern: '#94a3b8', bg: '#080c14', diamond: '#0f172a', star: '#1e293b', inner: '#090d16',
    center: '#e2e8f0', dash: '#cbd5e1', innerLine: '#cbd5e1', frameW: 5, slashW: 2.2,
    e: { D: 205, W: 138, R: 84, r: 46, c: 15 },
  },
  UC: {
    frame: ['#bbf7d0', '#22c55e', '#14532d'], glow: ['#4ade80', '#15803d'], glowOp: [0.9, 0.5],
    pattern: '#22c55e', bg: '#030d07', diamond: '#052e16', star: '#0f3d24', inner: '#02140a',
    center: '#4ade80', dash: '#86efac', innerLine: '#86efac', frameW: 5, slashW: 2.2,
    e: { D: 205, W: 138, R: 84, r: 48, c: 15 },
  },
  R: {
    frame: ['#bae6fd', '#0ea5e9', '#0369a1'], glow: ['#38bdf8', '#0284c7'], glowOp: [0.9, 0.5],
    pattern: '#0284c7', bg: '#030c14', diamond: '#082f49', star: '#0c4a6e', inner: '#021727',
    center: '#38bdf8', dash: '#38bdf8', innerLine: '#7dd3fc', frameW: 5.5, slashW: 2.5,
    e: { D: 208, W: 140, R: 86, r: 50, c: 16 },
  },
  SR: {
    frame: ['#e9b8ff', '#c084fc', '#6b21a8'], glow: ['#c084fc', '#7e22ce'], glowOp: [0.9, 0.55],
    pattern: '#a855f7', bg: '#090314', diamond: '#240c36', star: '#4c1d73', inner: '#140520',
    center: '#c084fc', dash: '#e9b8ff', innerLine: '#e9b8ff', frameW: 5.5, slashW: 2.5,
    e: { D: 210, W: 142, R: 88, r: 50, c: 16 },
  },
  SSR: {
    frame: ['#fff4b8', '#f3c853', '#ca8a04'], glow: ['#ffb703', '#ca8a04'], glowOp: [0.95, 0.55],
    pattern: '#ca8a04', bg: '#0f0902', diamond: '#241405', star: '#472608', inner: '#180c03',
    center: '#fde047', dash: '#fef08a', innerLine: '#ffd700', frameW: 6, slashW: 2.5,
    e: { D: 212, W: 144, R: 90, r: 52, c: 17 },
  },
};

interface Props {
  rarity?: Rarity;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function CardBackView({ rarity, size = 'md' }: Props) {
  const rawId = useId();
  const uid = 'bk' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const t = THEMES[rarity ?? 'brand'] ?? THEMES.brand;
  const f = `${uid}-f`;
  const c = `${uid}-c`;
  const m = `${uid}-m`;
  const { D, W, R, r } = t.e;
  const rc = t.e.c;

  return (
    <div className={`pcard-svg back ${size}`}>
      <svg className="tcg" viewBox="0 0 360 530" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="การ์ดคว่ำหลัง">
        <defs>
          <linearGradient id={f} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={t.frame[0]} /><stop offset="50%" stopColor={t.frame[1]} /><stop offset="100%" stopColor={t.frame[2]} />
          </linearGradient>
          <radialGradient id={c} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={t.glow[0]} stopOpacity={t.glowOp[0]} />
            <stop offset="50%" stopColor={t.glow[1]} stopOpacity={t.glowOp[1]} />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <pattern id={m} width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 0 12 L 12 0 L 24 12 L 12 24 Z" fill="none" stroke={t.pattern} strokeWidth="0.6" opacity="0.18" />
          </pattern>
        </defs>

        {/* พื้นการ์ด + ลายพับรบุ */}
        <rect x="4" y="4" width="352" height="522" rx="20" fill={t.bg} stroke="#000" strokeWidth="3" />
        <rect x="16" y="16" width="328" height="498" rx="14" fill={`url(#${m})`} />

        {/* กรอบ + เส้นใน */}
        <rect x="10" y="10" width="340" height="510" rx="16" fill="none" stroke={`url(#${f})`} strokeWidth={t.frameW} />
        <rect x="16" y="16" width="328" height="498" rx="12" fill="none" stroke={t.innerLine} strokeWidth="1.2" opacity="0.55" />

        {/* มุมเฉียง */}
        <g stroke={`url(#${f})`} strokeWidth={t.slashW} fill="none">
          <path d="M 14 40 L 40 14 M 346 40 L 320 14 M 14 490 L 40 516 M 346 490 L 320 516" />
        </g>

        {/* สัญลักษณ์กลาง: เพชรใหญ่ → เรืองแสง → วงประ → ดาว 8 แฉก → วงใน → เพชรแกน */}
        <g transform="translate(180, 265)">
          <polygon points={`0,${-D} ${W},0 0,${D} ${-W},0`} fill={t.diamond} stroke={`url(#${f})`} strokeWidth="2" />
          <circle cx="0" cy="0" r={R + 20} fill={`url(#${c})`} />
          <circle cx="0" cy="0" r={R} fill="none" stroke={t.dash} strokeWidth="1.8" strokeDasharray="14 4" />
          <polygon
            points={`0,${-(R - 6)} ${R / 4},${-(R / 4)} ${R - 6},0 ${R / 4},${R / 4} 0,${R - 6} ${-R / 4},${R / 4} ${-(R - 6)},0 ${-R / 4},${-(R / 4)}`}
            fill={t.star} stroke={`url(#${f})`} strokeWidth="2"
          />
          <circle cx="0" cy="0" r={r} fill={t.inner} stroke={`url(#${f})`} strokeWidth="1.8" />
          <polygon points={`0,${-Math.round(rc * 1.35)} ${rc},0 0,${Math.round(rc * 1.35)} ${-rc},0`} fill={t.center} stroke="#fff" strokeWidth="1.2" />
        </g>
      </svg>
    </div>
  );
}
