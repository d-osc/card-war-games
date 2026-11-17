import { useCallback, useEffect, useRef, useState } from 'react';
import { GUILD_CREATE_COST } from '@cardwar/shared';
import { api } from '../api';
import Icon from '../components/Icon';
import { useStore } from '../stores';
import type { CharacterDTO, GuildChatDTO, GuildDTO } from '../dto';

const GUILD_EMBLEMS = ['pvp', 'shield', 'dragon', 'flame', 'magic', 'dungeon', 'gem', 'guild', 'golem', 'wolf'];

export default function GuildPage() {
  const [myGuild, setMyGuild] = useState<GuildDTO | null>(null);
  const [guilds, setGuilds] = useState<GuildDTO[]>([]);
  const [messages, setMessages] = useState<GuildChatDTO[]>([]);
  const [text, setText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', emblem: '', description: '' });
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const setCharacter = useStore((s) => s.setCharacter);
  const showToast = useStore((s) => s.showToast);

  const load = useCallback(async () => {
    try {
      const mine = await api<{ guild: GuildDTO | null }>('/api/guilds/mine');
      setMyGuild(mine.guild);
      const all = await api<{ guilds: GuildDTO[] }>('/api/guilds');
      setGuilds(all.guilds);
      if (mine.guild) {
        const chat = await api<{ messages: GuildChatDTO[] }>('/api/guilds/messages');
        setMessages(chat.messages);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function createGuild() {
    setBusy(true);
    try {
      const res = await api<{ message: string; guild: GuildDTO; character: CharacterDTO }>('/api/guilds/create', {
        method: 'POST',
        body: form,
      });
      setCharacter(res.character);
      showToast(res.message);
      setShowCreate(false);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'สร้างกิลด์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function join(id: number) {
    try {
      await api(`/api/guilds/${id}/join`, { method: 'POST' });
      showToast('เข้าร่วมกิลด์แล้ว');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'เข้าร่วมไม่สำเร็จ');
    }
  }

  async function leave() {
    if (!window.confirm('ออกจากกิลด์?')) return;
    try {
      await api('/api/guilds/leave', { method: 'POST' });
      showToast('ออกจากกิลด์แล้ว');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ออกไม่สำเร็จ');
    }
  }

  async function kick(userId: number, name: string) {
    if (!window.confirm(`ไล่ ${name} ออกจากกิลด์?`)) return;
    try {
      await api('/api/guilds/kick', { method: 'POST', body: { targetUserId: userId } });
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ไล่ไม่สำเร็จ');
    }
  }

  async function send() {
    if (!text.trim()) return;
    const t = text;
    setText('');
    try {
      await api('/api/guilds/messages/send', { method: 'POST', body: { text: t } });
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
    }
  }

  if (myGuild) {
    const isLeader = myGuild.myRole === 'leader';
    return (
      <div className="page-grid two-col">
        <div className="page-grid">
          <div className="panel hero-card">
            <div className="hero-emoji"><Icon name={myGuild.emblem} size={46} /></div>
            <div className="info">
              <div className="name">{myGuild.name}</div>
              <div className="sub">หัวกิลด์ {myGuild.leaderName} · สมาชิก {myGuild.memberCount}/30 คน {isLeader && <span className="badge gold">คุณคือหัวกิลด์</span>}</div>
              {myGuild.description && <div className="sub" style={{ marginBottom: 0 }}>{myGuild.description}</div>}
            </div>
          </div>

          <div className="panel">
            <div className="section-title">‍‍ สมาชิก</div>
            <table className="table">
              <thead><tr><th>ชื่อ</th><th>Lv</th><th>ตำแหน่ง</th>{isLeader && <th></th>}</tr></thead>
              <tbody>
                {(myGuild.members ?? []).map((m) => (
                  <tr key={m.userId}>
                    <td style={{ fontWeight: 700 }}>{m.userName}</td>
                    <td>{m.level}</td>
                    <td>{m.role === 'leader' ? ' หัวกิลด์' : 'สมาชิก'}</td>
                    {isLeader && (
                      <td>
                        {m.role !== 'leader' && (
                          <button className="btn sm danger" onClick={() => void kick(m.userId, m.userName)}><Icon name="cancel" size={12} /> ไล่</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn danger" onClick={() => void leave()}> ออกจากกิลด์</button>
            </div>
          </div>
        </div>

        <div className="panel chat-panel">
          <div className="section-title"> แชทกิลด์ <span className="hint">อัปเดตทุก 6 วิ</span></div>
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <div className="empty" style={{ padding: 20 }}>ยังไม่มีข้อความ — ทักทายเพื่อนร่วมกิลด์สิ!</div>}
            {messages.map((m) => (
              <div key={m.id} className="msg them">
                <div className="meta">{m.senderName}</div>
                {m.text}
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              className="input"
              placeholder="พิมพ์ข้อความถึงกิลด์..."
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
            />
            <button className="btn accent" onClick={() => void send()}>ส่ง</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="section-title">
           กิลด์ <span className="hint">รวมกลุ่ม แชทร่วม สูงสุด 30 คน/กิลด์</span>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={() => setShowCreate(true)}> ตั้งกิลด์ใหม่ (ค่าธรรมเนียม {GUILD_CREATE_COST} ทอง)</button>
        </div>
      </div>

      <div className="section-title"> กิลด์ทั้งหมด</div>
      <div className="page-grid">
        {guilds.length === 0 && <div className="empty">ยังไม่มีกิลด์ — เป็นคนแรกที่ตั้ง!</div>}
        {guilds.map((g) => (
          <div key={g.id} className="quest-board-row">
            <div className="listing-emoji">{g.emblem}</div>
            <div className="info">
              <div style={{ fontWeight: 800 }}>{g.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>หัวกิลด์ {g.leaderName} · {g.memberCount}/30 คน</div>
              {g.description && <div style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{g.description}</div>}
            </div>
            <button className="btn sm primary" onClick={() => void join(g.id)}>เข้าร่วม</button>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3><Icon name="guild" size={16} /> ตั้งกิลด์ใหม่</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="ชื่อกิลด์ (3-24 ตัวอักษร)" value={form.name} maxLength={24} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="tabs" style={{ margin: 0 }}>
                {GUILD_EMBLEMS.map((em) => (
                  <div key={em} className={`chip${form.emblem === em ? ' active' : ''}`} onClick={() => setForm({ ...form, emblem: em })}><Icon name={em} size={20} /></div>
                ))}
              </div>
              <input className="input" placeholder="คำอธิบายกิลด์ (ไม่บังคับ)" value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <p style={{ color: 'var(--muted)', fontSize: '0.78rem', margin: 0 }}>
                ค่าธรรมเนียมสร้าง {GUILD_CREATE_COST} ทอง เข้าเป็นภาษีของระบบ
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn primary" disabled={busy || form.name.trim().length < 3} onClick={() => void createGuild()}>สร้างกิลด์</button>
              <button className="btn ghost" onClick={() => setShowCreate(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
