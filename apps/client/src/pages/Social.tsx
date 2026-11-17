import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useStore } from '../stores';
import type { ChatMsgDTO, FriendsResponse } from '../dto';
import Icon from '../components/Icon';

function timeShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SocialPage() {
  const [friends, setFriends] = useState<FriendsResponse>({ friends: [], incoming: [], outgoing: [] });
  const [addName, setAddName] = useState('');
  const [selected, setSelected] = useState<{ userId: number; name: string } | null>(null);
  const [messages, setMessages] = useState<ChatMsgDTO[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const showToast = useStore((s) => s.showToast);

  const loadFriends = useCallback(async () => {
    try {
      setFriends(await api<FriendsResponse>('/api/social/friends'));
    } catch {
      // ignore
    }
  }, []);

  const loadChat = useCallback(async (userId: number) => {
    try {
      const res = await api<{ messages: ChatMsgDTO[] }>(`/api/social/messages/${userId}`);
      setMessages(res.messages);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!selected) return;
    void loadChat(selected.userId);
    const t = setInterval(() => void loadChat(selected.userId), 4000);
    return () => clearInterval(t);
  }, [selected, loadChat]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function addFriend() {
    if (!addName.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ message: string }>('/api/social/friends/request', { method: 'POST', body: { targetName: addName.trim() } });
      showToast(res.message);
      setAddName('');
      await loadFriends();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function respond(friendshipId: number, accept: boolean) {
    await api('/api/social/friends/respond', { method: 'POST', body: { friendshipId, accept } }).catch(() => {});
    await loadFriends();
  }

  async function removeFriend(friendshipId: number) {
    if (!window.confirm('ลบเพื่อนคนนี้?')) return;
    await api('/api/social/friends/remove', { method: 'POST', body: { friendshipId } }).catch(() => {});
    if (selected) setSelected(null);
    await loadFriends();
  }

  async function send() {
    if (!selected || !text.trim()) return;
    const t = text;
    setText('');
    try {
      await api('/api/social/messages/send', { method: 'POST', body: { toUserId: selected.userId, text: t } });
      await loadChat(selected.userId);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
    }
  }

  return (
    <div className="social-layout">
      <div className="page-grid">
        <div className="panel">
          <div className="section-title"> เพื่อน ({friends.friends.length})</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="input" placeholder="เพิ่มเพื่อนด้วยชื่อตัวละคร" value={addName} onChange={(e) => setAddName(e.target.value)} />
            <button className="btn accent" disabled={busy || !addName.trim()} onClick={() => void addFriend()}><Icon name="social" size={15} /> เพิ่ม</button>
          </div>

          {friends.incoming.length > 0 && (
            <>
              <div className="bar-label"><span>คำขอเป็นเพื่อนที่รอคุณตอบ</span></div>
              {friends.incoming.map((r) => (
                <div key={r.friendshipId} className="friend-row" style={{ marginBottom: 8 }}>
                  <div className="who"><div className="name"> {r.name} (Lv.{r.level})</div></div>
                  <button className="btn sm primary" onClick={() => void respond(r.friendshipId, true)}><Icon name="check" size={13} /> รับ</button>
                  <button className="btn sm ghost" onClick={() => void respond(r.friendshipId, false)}><Icon name="cancel" size={13} /> ปฏิเสธ</button>
                </div>
              ))}
            </>
          )}

          {friends.outgoing.length > 0 && (
            <>
              <div className="bar-label"><span>คำขอที่คุณส่งไป (รอตอบรับ)</span></div>
              {friends.outgoing.map((r) => (
                <div key={r.friendshipId} className="friend-row" style={{ marginBottom: 8, opacity: 0.7 }}>
                  <div className="who"><div className="name"> {r.name}</div></div>
                </div>
              ))}
            </>
          )}

          {friends.friends.length === 0 ? (
            <div className="empty">ยังไม่มีเพื่อน — ใส่ชื่อตัวละครเพื่อนด้านบนเพื่อส่งคำขอ</div>
          ) : friends.friends.map((f) => (
            <div key={f.friendshipId} className={`friend-row${selected?.userId === f.userId ? ' selected' : ''}`} style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => setSelected({ userId: f.userId, name: f.name })}>
              <div className="listing-emoji"><Icon name="profile" size={26} /></div>
              <div className="who">
                <div className="name">{f.name}</div>
                <div className="sub">Lv.{f.level} ·  {f.rating}</div>
              </div>
              <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); void removeFriend(f.friendshipId); }}><Icon name="cancel" size={12} /> ลบ</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel chat-panel">
        {selected ? (
          <>
            <div className="section-title"> แชทกับ {selected.name} <span className="hint">อัปเดตอัตโนมัติทุก 4 วิ</span></div>
            <div className="chat-log" ref={logRef}>
              {messages.length === 0 && <div className="empty" style={{ padding: 20 }}>เริ่มบทสนทนา — พิมพ์ข้อความแรกเลย!</div>}
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.fromMe ? 'me' : 'them'}`}>
                  <div className="meta">{m.senderName} · {timeShort(m.createdAt)}</div>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                className="input"
                placeholder="พิมพ์ข้อความ..."
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              />
              <button className="btn accent" onClick={() => void send()}><Icon name="cardPlay" size={14} /> ส่ง</button>
            </div>
          </>
        ) : (
          <div className="empty" style={{ padding: '60px 20px' }}>
             เลือกเพื่อนจากรายการด้านซ้ายเพื่อเริ่มแชท
            <br /><span style={{ fontSize: '0.78rem' }}>(ส่งข้อความได้เฉพาะเพื่อนที่ตอบรับแล้ว)</span>
          </div>
        )}
      </div>
    </div>
  );
}
