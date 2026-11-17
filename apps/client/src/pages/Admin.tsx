import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../stores';
import { cardById, RARITY_NAME_TH, registerTemplate } from '@cardwar/shared';

/** cardById ที่ไม่พัง — ledger อาจอ้างการ์ดที่ถูกลบไปแล้ว ให้แสดงรหัสแทน */
function safeCardName(templateId: string): string {
  try {
    const t = cardById(templateId);
    return `${t.emoji} ${t.name}`;
  } catch {
    return templateId;
  }
}
import type { CardTemplate } from '@cardwar/shared';
import CardView from '../components/CardView';
import Modal from '../components/Modal';
import Icon from '../components/Icon';
import CardPicker from '../components/CardPicker';

interface AdminStats {
  users: number;
  characters: number;
  guilds: number;
  totalGold: number;
  cardsMinted: number;
  cardsBurned: number;
  cardsInCirculation: number;
  openAuctions: number;
  openPlayerQuests: number;
  ledgerSinks: { type: string; name: string; total: number }[];
  ledgerSources: { type: string; name: string; total: number }[];
}

interface LedgerRow {
  id: number;
  type: string;
  typeName: string;
  userId: number | null;
  templateId: string | null;
  serial: number | null;
  gold: number | null;
  createdAt: string;
}

interface PlayerDetail {
  userId: number;
  name: string;
  level: number;
  xp: number;
  gold: number;
  rating: number;
  wins: number;
  losses: number;
  statPoints: number;
  deckCount: number;
  cardCount: number;
  email: string | null;
  createdAt: string;
}

interface PlayerRow {
  userId: number;
  name: string;
  level: number;
  gold: number;
  rating: number;
  wins: number;
  losses: number;
  email: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const user = useStore((s) => s.user);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ledger' | 'players' | 'create'>('ledger');
  const [manage, setManage] = useState<PlayerDetail | null>(null);
  const showToast = useStore((s) => s.showToast);

  async function openManage(userId: number) {
    try {
      const r = await api<{ player: PlayerDetail }>(`/api/admin/player/${userId}`);
      setManage(r.player);
    } catch {
      showToast('โหลดข้อมูลผู้เล่นไม่สำเร็จ');
    }
  }

  const load = useCallback(async () => {
    try {
      setStats(await api<AdminStats>('/api/admin/stats'));
      const l = await api<{ entries: LedgerRow[] }>('/api/admin/ledger?limit=100');
      setLedger(l.entries);
      const p = await api<{ players: PlayerRow[] }>(`/api/admin/players${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      setPlayers(p.players);
    } catch {
      // ignore
    }
  }, [search]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (!user?.isAdmin) {
    return <div className="empty"> หน้านี้เฉพาะแอดมิน (ตั้งค่า ADMIN_EMAILS ที่ server เพื่อกำหนดสิทธิ์)</div>;
  }
  if (!stats) return <div className="empty">กำลังโหลดข้อมูลระบบ…</div>;

  return (
    <div className="page-grid">
      <div className="panel">
        <div className="section-title"> ภาพรวมระบบ <span className="hint">อัปเดตทุก 20 วิ</span></div>
        <div className="stat-grid">
          <div className="stat-cell"><span> ผู้ใช้</span><b>{stats.users}</b></div>
          <div className="stat-cell"><span> ตัวละคร</span><b>{stats.characters}</b></div>
          <div className="stat-cell"><span> กิลด์</span><b>{stats.guilds}</b></div>
          <div className="stat-cell"><span> ทองหมุนเวียน</span><b>{stats.totalGold.toLocaleString('th-TH')}</b></div>
          <div className="stat-cell"><span> การ์ดที่ออกทั้งหมด (mint)</span><b>{stats.cardsMinted}</b></div>
          <div className="stat-cell"><span> การ์ดถูกทำลาย (burn)</span><b>{stats.cardsBurned}</b></div>
          <div className="stat-cell"><span> การ์ดอยู่กับผู้เล่น/ตลาด</span><b>{stats.cardsInCirculation}</b></div>
          <div className="stat-cell"><span> ประมูลเปิดอยู่</span><b>{stats.openAuctions}</b></div>
          <div className="stat-cell"><span> เควสต์ผู้เล่นเปิดอยู่</span><b>{stats.openPlayerQuests}</b></div>
        </div>
      </div>

      <div className="page-grid two-col">
        <div className="panel">
          <div className="section-title"> ทองออกจากระบบ (sink)</div>
          {stats.ledgerSinks.length === 0 ? <div className="empty">ยังไม่มีข้อมูล</div> : (
            <table className="table">
              <tbody>
                {stats.ledgerSinks.map((s) => (
                  <tr key={s.type}><td>{s.name}</td><td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>-{s.total.toLocaleString('th-TH')}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <div className="section-title"> ทองเข้าสู่ผู้เล่น (source)</div>
          {stats.ledgerSources.length === 0 ? <div className="empty">ยังไม่มีข้อมูล</div> : (
            <table className="table">
              <tbody>
                {stats.ledgerSources.map((s) => (
                  <tr key={s.type}><td>{s.name}</td><td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>+{s.total.toLocaleString('th-TH')}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
           {tab === 'ledger' ? 'สมุดบัญชีล่าสุด 100 รายการ' : tab === 'players' ? 'รายชื่อผู้เล่น' : 'สร้างการ์ดใหม่'}
          <span className="hint">
            <span className={`chip${tab === 'ledger' ? ' active' : ''}`} style={{ marginRight: 6 }} onClick={() => setTab('ledger')}>บัญชี</span>
            <span className={`chip${tab === 'players' ? ' active' : ''}`} style={{ marginRight: 6 }} onClick={() => setTab('players')}>ผู้เล่น</span>
            <span className={`chip${tab === 'create' ? ' active' : ''}`} onClick={() => setTab('create')}>สร้างการ์ด</span>
          </span>
        </div>

        {tab === 'ledger' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>#</th><th>รายการ</th><th>ผู้ใช้</th><th>การ์ด</th><th>ทอง</th><th>เวลา</th></tr></thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.typeName}</td>
                    <td>{r.userId ?? '-'}</td>
                    <td>{r.templateId ? `${safeCardName(r.templateId)}${r.serial ? ` #${r.serial}` : ''}` : '-'}</td>
                    <td style={{ color: (r.gold ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                      {r.gold != null ? `${r.gold > 0 ? '+' : ''}${r.gold}` : '-'}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{new Date(r.createdAt).toLocaleString('th-TH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'players' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input" placeholder="ค้นหาชื่อตัวละคร" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>ชื่อ</th><th>Lv</th><th>ทอง</th><th>เรตติ้ง</th><th>สถิติ</th><th>อีเมล</th><th></th></tr></thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.name}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td>{p.level}</td>
                      <td style={{ color: 'var(--gold)' }}>{p.gold.toLocaleString('th-TH')}</td>
                      <td>{p.rating}</td>
                      <td>{p.wins}ช {p.losses}แพ้</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{p.email ?? 'dev'}</td>
                      <td>
                        <button className="btn sm primary" onClick={() => void openManage(p.userId)}>จัดการ</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
          ระบบบัญชีปิดวงจร: ทุกการไหลของทอง/การ์ดถูกบันทึก — การ์ดที่ถูกทำลาย ({stats.cardsBurned} ใบ) กลับเข้า pool ของระบบเพื่อ drop/กาชาใหม่ · Rarity: {(['C', 'UC', 'R', 'SR', 'SSR'] as const).map((r) => `${r}=${RARITY_NAME_TH[r]}`).join(' · ')}
        </p>
      </div>

      {tab === 'create' && <CreateCardPanel onCreated={() => void load()} />}

      <ManagePlayerModal
        manage={manage}
        onClose={() => setManage(null)}
        onChanged={() => { void load(); if (manage) void openManage(manage.userId); }}
      />
    </div>
  );
}


// ===========================================================================
// Admin: สร้างการ์ดใหม่ — ฟอร์ม + พรีวิวสด
// ===========================================================================
const CREATE_GROUPS = [
  { key: 'material', label: 'วัตถุดิบ' },
  { key: 'equipment', label: 'อุปกรณ์สวมใส่' },
  { key: 'weapon', label: 'อาวุธ' },
  { key: 'consumable', label: 'ของใช้/ยา' },
  { key: 'skill', label: 'สกิล' },
  { key: 'pet', label: 'สัตว์เลี้ยง' },
  { key: 'tool', label: 'เครื่องมือ' },
];

const CATEGORY_BY_GROUP: Record<string, { key: string; label: string }[]> = {
  material: [
    { key: 'ore', label: 'แร่' }, { key: 'gem', label: 'อัญมณี' }, { key: 'herb', label: 'สมุนไพร' },
    { key: 'wood', label: 'ไม้' }, { key: 'monster_part', label: 'ชิ้นส่วนมอนสเตอร์' }, { key: 'ingredient', label: 'วัตถุดิบทำอาหาร' },
  ],
  equipment: [
    { key: 'hat', label: 'หมวก' }, { key: 'top', label: 'เสื้อ' }, { key: 'pants', label: 'กางเกง' },
    { key: 'shoes', label: 'รองเท้า' }, { key: 'gloves', label: 'ถุงมือ' }, { key: 'ring', label: 'แหวน' },
    { key: 'bracelet', label: 'กำไล' }, { key: 'earring', label: 'ต่างหู' },
  ],
  weapon: [{ key: 'sword', label: 'ดาบ' }, { key: 'katana', label: 'ดาบคาตานะ' }, { key: 'bow', label: 'ธนู' }],
  consumable: [{ key: 'potion', label: 'ยา' }, { key: 'food', label: 'อาหาร' }],
  skill: [{ key: 'skill_physical', label: 'สกิลกายภาพ' }, { key: 'skill_magic', label: 'สกิลเวท' }],
  pet: [{ key: 'pet', label: 'สัตว์เลี้ยง' }],
  tool: [{ key: 'pickaxe', label: 'จอบ' }, { key: 'axe', label: 'ขวาน' }, { key: 'sickle', label: 'เคียว' }],
};

const SKILL_KINDS = [
  { key: 'physical', label: 'โจมตีกายภาพ' },
  { key: 'magic', label: 'โจมตีเวท' },
  { key: 'heal', label: 'รักษา' },
  { key: 'shield', label: 'สร้างโล่' },
  { key: 'buff_atk', label: 'บัฟโจมตี' },
  { key: 'buff_matk', label: 'บัฟเวท' },
  { key: 'poison', label: 'พิษ' },
];

const EQUIP_STATS = ['hp', 'atk', 'def', 'matk', 'mdef', 'spd'];

const STAT_LABEL: Record<string, string> = { hp: 'HP', atk: 'ATK', def: 'DEF', matk: 'MATK', mdef: 'MDEF', spd: 'SPD' };

function CreateCardPanel({ onCreated }: { onCreated: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [description, setDescription] = useState('');
  const [rarity, setRarity] = useState<'C' | 'UC' | 'R' | 'SR' | 'SSR'>('R');
  const [group, setGroup] = useState('material');
  const [category, setCategory] = useState('ore');
  const [tier, setTier] = useState(1);
  const [image, setImage] = useState('');
  const [power, setPower] = useState(20);
  const [duration, setDuration] = useState(3);
  const [skillKind, setSkillKind] = useState('physical');
  const [equipStats, setEquipStats] = useState<Record<string, number>>({ atk: 5 });
  const [consumable, setConsumable] = useState<Record<string, number>>({ heal: 50 });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);   // null = ใช้ราคาอัตโนมัติ
  const [mintCount, setMintCount] = useState(0);

  async function onArtFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) { showToast('ไฟล์ใหญ่เกิน (สูงสุด 2MB)'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error('อ่านไฟล์ไม่สำเร็จ'));
        fr.readAsDataURL(file);
      });
      const r = await api<{ path: string }>('/api/admin/upload-card-art', { method: 'POST', body: { dataBase64: dataUrl } });
      setImage(r.path);
      showToast(`อัปโหลดภาพแล้ว (${r.path})`);
    } catch (e2) {
      showToast(e2 instanceof Error ? e2.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  }

  function pickGroup(g: string) {
    setGroup(g);
    setCategory(CATEGORY_BY_GROUP[g]?.[0]?.key ?? 'ore');
  }

  // ราคาขายแนะนำตามความหายาก + กลุ่ม (เดียวกับสูตร server)
  const BASE_PRICE: Record<string, number> = { C: 30, UC: 50, R: 90, SR: 160, SSR: 280 };
  const suggestedPrice = Math.max(1, Math.round(
    group === 'material' ? BASE_PRICE[rarity] * 0.8
      : group === 'tool' ? BASE_PRICE[rarity] * 3
      : BASE_PRICE[rarity],
  ));

  const preview: CardTemplate = {
    id: 'preview', name: name || 'ชื่อการ์ดใหม่', emoji: emoji || '🃏',
    category: category as CardTemplate['category'], group: (group === 'weapon' ? 'equipment' : group) as CardTemplate['group'],
    rarity, basePrice: 0, description: description || 'คำอธิบายการ์ด',
    shardCost: 0, tier: (group === 'material' || group === 'tool') ? tier : 0,
    ...(image ? { image } : {}),
    ...(group === 'weapon' ? { weaponKind: category as CardTemplate['weaponKind'] } : {}),
    ...((group === 'equipment' || group === 'weapon') && Object.keys(equipStats).length ? { equip: equipStats } : {}),
    ...(group === 'skill' ? { skill: { kind: skillKind as never, power, ...((skillKind.startsWith('buff') || skillKind === 'poison') ? { duration } : {}) } } : {}),
    ...(group === 'pet' ? { pet: { atk: power, hp: equipStats.hp ?? 10 } } : {}),
    ...(group === 'consumable' ? { consumable } : {}),
  };

  async function submit() {
    if (name.trim().length < 2) { showToast('ใส่ชื่อการ์ดอย่างน้อย 2 ตัวอักษร'); return; }
    setBusy(true);
    try {
      const body = {
        name, emoji, description, rarity, group, category,
        basePrice: price ?? suggestedPrice,
        mintCount,
        tier: (group === 'material' || group === 'tool') ? tier : 0,
        ...(image ? { image } : {}),
        ...(group === 'skill' ? { skillKind, power, ...((skillKind.startsWith('buff') || skillKind === 'poison') ? { duration } : {}) } : {}),
        ...((group === 'equipment' || group === 'weapon') ? { stats: equipStats } : {}),
        ...(group === 'pet' ? { power, stats: { hp: equipStats.hp ?? 10 } } : {}),
        ...(group === 'consumable' ? { consumable } : {}),
      };
      const res = await api<{ card: CardTemplate; mintedToSelf: number }>('/api/admin/cards', { method: 'POST', body });
      registerTemplate(res.card);
      showToast(`สร้างการ์ด "${res.card.name}" สำเร็จ! ราคา ${res.card.basePrice} ทอง${res.mintedToSelf > 0 ? ` · ออกให้คุณ ${res.mintedToSelf} ใบเข้าคลังแล้ว` : ''}`);
      setName(''); setDescription(''); setPrice(null); setMintCount(0);
      onCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'สร้างการ์ดไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const num = (label: string, value: number, set: (v: number) => void, min: number, max: number) => (
    <div key={label}>
      <div className="bar-label"><span>{label}</span></div>
      <input className="input" type="number" min={min} max={max} value={value}
        onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 210px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
          <div>
            <div className="bar-label"><span>ชื่อการ์ด</span></div>
            <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="เช่น ดาบราชามังกร" />
          </div>
          <div>
            <div className="bar-label"><span>อีโมจิ</span></div>
            <input className="input" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div>
            <div className="bar-label"><span>กลุ่ม</span></div>
            <select className="input" value={group} onChange={(e) => pickGroup(e.target.value)}>
              {CREATE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
          <div>
            <div className="bar-label"><span>ประเภท</span></div>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(CATEGORY_BY_GROUP[group] ?? []).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <div className="bar-label"><span>ความหายาก</span></div>
            <select className="input" value={rarity} onChange={(e) => setRarity(e.target.value as typeof rarity)}>
              {(['C', 'UC', 'R', 'SR', 'SSR'] as const).map((r) => <option key={r} value={r}>{r} — {RARITY_NAME_TH[r]}</option>)}
            </select>
          </div>
          {(group === 'material' || group === 'tool') && num('เกรด (tier 1-5)', tier, setTier, 1, 5)}
          <div>
            <div className="bar-label"><span>ราคาขาย (ทอง){price == null ? ' — อัตโนมัติ' : ''}</span></div>
            <input className="input" type="number" min={1} value={price ?? suggestedPrice}
              onChange={(e) => setPrice(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          {num('จำนวนที่ออกให้ตัวเอง (0-50)', mintCount, setMintCount, 0, 50)}
        </div>

        <div>
          <div className="bar-label"><span>คำอธิบาย (flavor)</span></div>
          <input className="input" value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} placeholder="ข้อความบนการ์ด" />
        </div>

        {group === 'skill' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div>
              <div className="bar-label"><span>ชนิดสกิล</span></div>
              <select className="input" value={skillKind} onChange={(e) => setSkillKind(e.target.value)}>
                {SKILL_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            {num('พลัง', power, setPower, 1, 999)}
            {(skillKind.startsWith('buff') || skillKind === 'poison') && num('จำนวนเทิร์น', duration, setDuration, 1, 9)}
          </div>
        )}

        {(group === 'equipment' || group === 'weapon') && (
          <div>
            <div className="bar-label"><span>โบนัสสเตตัสเมื่อสวมใส่</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {EQUIP_STATS.map((st) => num(STAT_LABEL[st], equipStats[st] ?? 0,
                (v) => setEquipStats((s) => { const n = { ...s }; if (v === 0) delete n[st]; else n[st] = v; return n; }),
                0, 999))}
            </div>
          </div>
        )}

        {group === 'pet' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {num('พลังโจมตี', power, setPower, 1, 99)}
            {num('HP', equipStats.hp ?? 10, (v) => setEquipStats((s) => ({ ...s, hp: v })), 1, 99)}
          </div>
        )}

        {group === 'consumable' && (
          <div>
            <div className="bar-label"><span>เอฟเฟกต์เมื่อใช้</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
              {num('ฟื้น HP', consumable.heal ?? 0, (v) => setConsumable((c) => ({ ...c, heal: v })), 0, 999)}
              {num('ฟื้นมานา', consumable.mana ?? 0, (v) => setConsumable((c) => ({ ...c, mana: v })), 0, 999)}
              {num('ฟื้นกำลัง', consumable.stam ?? 0, (v) => setConsumable((c) => ({ ...c, stam: v })), 0, 999)}
            </div>
          </div>
        )}

        <div>
          <div className="bar-label">
            <span>ภาพอาร์ต — อัปโหลดไฟล์ หรือใส่ URL (ไม่ใส่ใช้ไอคอนตามประเภท)</span>
            {image && <span style={{ color: 'var(--success)' }}>ใช้ภาพนี้อยู่ ✓</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={image} onChange={(e) => setImage(e.target.value)} placeholder="/card-art/my_card.png หรือ https://..." />
            <label className={`btn${uploading ? ' disabled' : ''}`} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Icon name="sparkles" size={15} /> {uploading ? 'กำลังอัป…' : 'เลือกไฟล์'}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" style={{ display: 'none' }} onChange={(e) => void onArtFile(e)} />
            </label>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', margin: '4px 0 0' }}>รองรับ png / jpg / webp / gif / svg · สูงสุด 2MB · แนะนำอัตราส่วน ~4:3 (จะครอปแบบ cover)</p>
        </div>

        <button className="btn primary big" disabled={busy} onClick={() => void submit()}>
          <Icon name="sparkles" size={16} /> สร้างการ์ดนี้
        </button>
        <p style={{ color: 'var(--muted)', fontSize: '0.74rem', margin: 0 }}>
          การ์ดที่สร้างจะเข้าสู่ระบบทันที: มองให้ผู้เล่นผ่านปุ่ม "จัดการ", อยู่ใน pool กาชา/แคตตาล็อกเควสต์ และแสดงผลทุกหน้า — ราคาฐานคำนวณจากความหายากอัตโนมัติ
        </p>
        <p style={{ color: 'var(--muted)', fontSize: '0.72rem', margin: 0 }}>
          โควตาการผลิตสูงสุดต่อการ์ด 1 แบบ (ระบบทุกทาง กาชา/drop/craft/แอดมิน): SSR 10,000 · SR 50,000 · R 150,000 · UC 500,000 · C 1,000,000 ใบ — เต็มแล้วระบบจะไม่ออกการ์ดใบนั้นเพิ่ม
        </p>
      </div>

      <div>
        <div className="bar-label"><span>พรีวิวสด</span></div>
        <CardView card={preview} />
      </div>
    </div>
  );
}

// ===========================================================================
// Admin Manager — modal จัดการผู้เล่นรายคน
// ===========================================================================
function ManagePlayerModal({ manage, onClose, onChanged }: {
  manage: PlayerDetail | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [goldInput, setGoldInput] = useState('');
  const [ratingInput, setRatingInput] = useState('');
  const [mintPicker, setMintPicker] = useState(false);
  const [mintTemplate, setMintTemplate] = useState<string | null>(null);
  const [mintCount, setMintCount] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (manage) {
      setGoldInput(String(manage.gold));
      setRatingInput(String(manage.rating));
      setMintTemplate(null);
      setMintCount(1);
    }
  }, [manage]);

  if (!manage) return null;

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  const mintCardInfo = mintTemplate ? cardById(mintTemplate) : null;

  return (
    <>
      <Modal title={`จัดการ: ${manage.name} (Lv.${manage.level})`} onClose={onClose}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="stat-grid">
            <div className="stat-cell"><span> ทอง</span><b>{manage.gold.toLocaleString('th-TH')}</b></div>
            <div className="stat-cell"><span> เรตติ้ง</span><b>{manage.rating}</b></div>
            <div className="stat-cell"><span> สถิติ</span><b>{manage.wins}ช {manage.losses}แพ้</b></div>
            <div className="stat-cell"><span> การ์ด</span><b>{manage.cardCount} ใบ</b></div>
            <div className="stat-cell"><span> เดค</span><b>{manage.deckCount} ใบ</b></div>
            <div className="stat-cell"><span> แต้มค้าง</span><b>{manage.statPoints}</b></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div className="bar-label"><span>ตั้งทอง (ค่าใหม่)</span></div>
              <input className="input" type="number" min={0} value={goldInput} onChange={(e) => setGoldInput(e.target.value)} />
            </div>
            <button className="btn primary" disabled={busy} onClick={() => void act(async () => {
              await api(`/api/admin/player/${manage.userId}/gold`, { method: 'POST', body: { gold: Number(goldInput) || 0 } });
              showToast(`ตั้งทอง ${manage.name} = ${Number(goldInput).toLocaleString('th-TH')} แล้ว`);
            })}><Icon name="gold" size={15} /> บันทึกทอง</button>
            <button className="btn" disabled={busy} onClick={() => void act(async () => {
              await api(`/api/admin/player/${manage.userId}/gold`, { method: 'POST', body: { gold: manage.gold + 1000 } });
              showToast(`เติมทอง +1,000 ให้ ${manage.name} แล้ว`);
            })}>+1,000</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <div className="bar-label"><span>ตั้งเรตติ้ง (ขั้นต่ำ 100)</span></div>
              <input className="input" type="number" min={100} value={ratingInput} onChange={(e) => setRatingInput(e.target.value)} />
            </div>
            <button className="btn primary" disabled={busy} onClick={() => void act(async () => {
              await api(`/api/admin/player/${manage.userId}/rating`, { method: 'POST', body: { rating: Number(ratingInput) || 1000 } });
              showToast(`ตั้งเรตติ้ง ${manage.name} = ${ratingInput} แล้ว`);
            })}><Icon name="trophy" size={15} /> บันทึกเรตติ้ง</button>
          </div>

          <div className="panel" style={{ padding: '10px 14px' }}>
            <div className="bar-label"><span>มองการ์ดให้ผู้เล่น</span><span>{mintCardInfo ? `${mintCardInfo.name} × ${mintCount}` : 'ยังไม่เลือกการ์ด'}</span></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setMintPicker(true)}><Icon name="deck" size={15} /> เลือกการ์ด</button>
              <input className="input" style={{ width: 90 }} type="number" min={1} max={50} value={mintCount}
                onChange={(e) => setMintCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>ใบ</span>
              <button className="btn primary" disabled={busy || !mintTemplate} onClick={() => void act(async () => {
                await api(`/api/admin/player/${manage.userId}/mint`, { method: 'POST', body: { templateId: mintTemplate, count: mintCount } });
                showToast(`มอง ${mintCardInfo?.name} × ${mintCount} ให้ ${manage.name} แล้ว`);
              })}><Icon name="sparkles" size={15} /> มองการ์ด</button>
            </div>
          </div>
        </div>
      </Modal>

      <CardPicker
        open={mintPicker}
        title="เลือกการ์ดที่จะมองให้ผู้เล่น"
        selectedId={mintTemplate}
        onSelect={(id) => setMintTemplate(id)}
        onClose={() => setMintPicker(false)}
      />
    </>
  );
}
