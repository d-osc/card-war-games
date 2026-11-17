import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../stores';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

interface LoginResponse {
  token: string;
  user: { id: number; name: string; avatar: string | null };
}

export default function LoginPage() {
  const { config, login } = useStore();
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [devName, setDevName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCredential(credential: string) {
    setBusy(true);
    setError('');
    try {
      const res = await api<LoginResponse>('/api/auth/google', { method: 'POST', body: { credential } });
      await login(res.token, res.user);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!config?.googleClientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const g = window.google;
      if (!g || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: config.googleClientId!,
        callback: (resp) => void handleCredential(resp.credential),
      });
      g.accounts.id.renderButton(googleBtnRef.current, { theme: 'filled_blue', size: 'large', text: 'continue_with', shape: 'pill' });
    };
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.googleClientId]);

  async function devLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<LoginResponse>('/api/auth/dev', { method: 'POST', body: { name: devName } });
      await login(res.token, res.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="logo"></div>
      <div>
        <h1>Card War</h1>
        <p className="tagline">เกมการ์ดผจญภัยแบบ Turn-based — สะสมการ์ด คราฟต์ ประลอง PvP</p>
      </div>

      <div className="login-box panel">
        {config?.googleClientId && (
          <div style={{ display: 'grid', placeItems: 'center', gap: 12 }}>
            <div ref={googleBtnRef} />
          </div>
        )}

        {config?.devLogin && (
          <form onSubmit={devLogin} style={{ display: 'grid', gap: 10, marginTop: config.googleClientId ? 16 : 0 }}>
            {!config.googleClientId && (
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0 }}>
                โหมดพัฒนา: ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID — เข้าสู่ระบบด้วยชื่อได้เลย
              </p>
            )}
            <input
              className="input"
              placeholder="ชื่อผู้เล่น (โหมดพัฒนา)"
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              maxLength={24}
            />
            <button className="btn accent big" disabled={busy || devName.trim().length < 2} type="submit">
               เข้าเล่นเลย
            </button>
          </form>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</p>}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
        เข้าสู่ระบบด้วยบัญชี Google เท่านั้นเมื่อตั้งค่า production
      </p>
    </div>
  );
}
