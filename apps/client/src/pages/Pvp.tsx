import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DECK_MIN } from '@cardwar/shared';
import { api } from '../api';
import { useStore } from '../stores';
import { getSocket } from '../socket';
import Icon from '../components/Icon';
import type { LeaderRow } from '../dto';

// ===========================================================================
// สนามประลอง PvP — เข้าคิวจับคู่ผู้เล่นจริง (เรตติ้งใกล้กันที่สุด)
// หรือสร้างห้อง 1v1 สู้กับเพื่อนด้วยโค้ดห้อง
// ===========================================================================
export default function PvpPage() {
  const character = useStore((s) => s.character);
  const showToast = useStore((s) => s.showToast);
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    void api<{ leaderboard: LeaderRow[] }>('/api/leaderboard').then((r) => setLeaders(r.leaderboard)).catch(() => {});
  }, [character?.rating]);

  useEffect(() => {
    const socket = getSocket();
    const onStarted = (msg: { battleId: string }) => {
      setSearching(false);
      setRoomCode(null);
      navigate(`/battle?b=${encodeURIComponent(msg.battleId)}`);
    };
    const onError = (msg: { message: string }) => {
      setSearching(false);
      showToast(msg.message);
    };
    const onQueueJoined = () => setSearching(true);
    const onQueueCancelled = () => setSearching(false);
    const onRoomCreated = (msg: { code: string }) => setRoomCode(msg.code);
    const onRoomExpired = () => { setRoomCode(null); showToast('ห้องหมดอายุ (2 นาที) — สร้างใหม่อีกครั้งได้เลย'); };
    const onRoomCancelled = () => setRoomCode(null);
    const onRoomError = (msg: { message: string }) => showToast(msg.message);
    socket.on('challenge:started', onStarted);
    socket.on('queue:matched', onStarted);
    socket.on('battle:error', onError);
    socket.on('queue:error', onError);
    socket.on('queue:joined', onQueueJoined);
    socket.on('queue:cancelled', onQueueCancelled);
    socket.on('room:created', onRoomCreated);
    socket.on('room:expired', onRoomExpired);
    socket.on('room:cancelled', onRoomCancelled);
    socket.on('room:error', onRoomError);
    return () => {
      socket.off('challenge:started', onStarted);
      socket.off('queue:matched', onStarted);
      socket.off('battle:error', onError);
      socket.off('queue:error', onError);
      socket.off('queue:joined', onQueueJoined);
      socket.off('queue:cancelled', onQueueCancelled);
      socket.off('room:created', onRoomCreated);
      socket.off('room:expired', onRoomExpired);
      socket.off('room:cancelled', onRoomCancelled);
      socket.off('room:error', onRoomError);
    };
  }, [navigate, showToast]);

  function findMatch() {
    if (!character || character.deckCount < DECK_MIN) {
      showToast(`เดคต้องมีอย่างน้อย ${DECK_MIN} ใบก่อนเข้าคิว (ตอนนี้ ${character?.deckCount ?? 0})`);
      return;
    }
    setSearching(true);
    getSocket().emit('pvp:queue');
  }

  function cancelSearch() {
    getSocket().emit('pvp:cancel');
    setSearching(false);
  }

  function createRoom() {
    if (!character || character.deckCount < DECK_MIN) {
      showToast(`เดคต้องมีอย่างน้อย ${DECK_MIN} ใบก่อนสร้างห้อง (ตอนนี้ ${character?.deckCount ?? 0})`);
      return;
    }
    getSocket().emit('room:create');
  }

  function joinRoom() {
    if (!character || character.deckCount < DECK_MIN) {
      showToast(`เดคต้องมีอย่างน้อย ${DECK_MIN} ใบก่อนเข้าร่วมห้อง (ตอนนี้ ${character?.deckCount ?? 0})`);
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      showToast('ใส่โค้ดห้องที่เพื่อนส่งให้ (5 ตัว)');
      return;
    }
    getSocket().emit('room:join', { code });
  }

  if (!character) return null;
  const deckOk = character.deckCount >= DECK_MIN;

  return (
    <div className="page-grid">
      <div className="panel" style={{ textAlign: 'center', padding: '26px 16px' }}>
        <div className="pvp-hero-icon"><Icon name="pvp" size={64} /></div>
        <h3 style={{ margin: '6px 0' }}>สนามประลอง PvP</h3>
        <div className="bar-label" style={{ justifyContent: 'center' }}><span> เรตติ้ง {character.rating} ·  {character.wins}ชนะ {character.losses}แพ้</span></div>
        <div className="bar rating lg" style={{ maxWidth: 360, margin: '0 auto 6px' }}>
          <div className="fill" style={{ width: `${Math.min(100, (character.rating / 2000) * 100)}%` }} />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
          จับคู่กับผู้เล่นจริงแบบ real-time — ระบบเลือกคนที่เรตติ้งใกล้เราที่สุดจากคิว สุ่มฝั่งเริ่ม เทิร์นละ 60 วินาที
          ชนะได้เรตติ้ง+ทอง แพ้เสียเรตติ้ง
        </p>
        {!deckOk && (
          <div className="panel" style={{ borderColor: 'var(--danger)', marginBottom: 12, padding: '10px 14px' }}>
             เดคต้องมีอย่างน้อย {DECK_MIN} ใบก่อนเข้าคิว (ตอนนี้ {character.deckCount} — ไม่มีขีดจำกัดสูงสุด)
          </div>
        )}
        {searching ? (
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn accent big searching-pulse" onClick={cancelSearch}> กำลังหาคู่… (แตะเพื่อยกเลิก)</button>
          </div>
        ) : (
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <button className="btn primary big" disabled={!deckOk} onClick={findMatch}>
               เข้าคิวประลอง
            </button>
          </div>
        )}

        <div className="pvp-room-divider">— หรือสู้กับเพื่อน 1 ต่อ 1 —</div>

        {roomCode ? (
          <div className="room-waiting">
            <div className="room-code">{roomCode}</div>
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', margin: 0 }}>
              ส่งโค้ดนี้ให้เพื่อน แล้วให้เขากด "เข้าร่วมห้อง" ในหน้านี้ — ห้องอยู่ได้ 2 นาที
            </p>
            <button className="btn" onClick={() => { getSocket().emit('room:cancel'); setRoomCode(null); }}>
              <Icon name="cancel" size={15} /> ปิดห้อง
            </button>
          </div>
        ) : (
          <div className="room-actions">
            <button className="btn" disabled={!deckOk} onClick={createRoom}>
              <Icon name="social" size={15} /> สร้างห้อง
            </button>
            <span className="room-or">หรือ</span>
            <input
              className="input room-code-input"
              type="text"
              placeholder="โค้ดห้อง"
              maxLength={5}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
            />
            <button className="btn primary" disabled={!deckOk} onClick={joinRoom}>เข้าร่วมห้อง</button>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="section-title"> อันดับผู้เล่น (เรตติ้งสูงสุด 20)</div>
        {leaders.length === 0 ? (
          <div className="empty">ยังไม่มีผู้เล่นในอันดับ — เป็นคนแรกที่ลงสนาม!</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>#</th><th>ผู้เล่น</th><th>Lv</th><th>เรตติ้ง</th><th>สถิติ</th></tr>
            </thead>
            <tbody>
              {leaders.map((row, i) => (
                <tr key={i} className={row.name === character.name ? 'me' : ''}>
                  <td className="rank">{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{row.name}</td>
                  <td>{row.level}</td>
                  <td style={{ fontWeight: 800, color: 'var(--gold)' }}>{row.rating}</td>
                  <td>{row.wins}ช {row.losses}แพ้</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
