import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { registerTemplate } from '@cardwar/shared';
import { useStore } from './stores';
import { api } from './api';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import CreateCharacterPage from './pages/CreateCharacter';
import LobbyPage from './pages/Lobby';
import InventoryPage from './pages/Inventory';
import DeckPage from './pages/Deck';
import ShopPage from './pages/Shop';
import GatherPage from './pages/Gather';
import CraftPage from './pages/Craft';
import RepairPage from './pages/Repair';
import DungeonPage from './pages/Dungeon';
import PvpPage from './pages/Pvp';
import BattlePage from './pages/Battle';
import QuestsPage from './pages/Quests';
import ProfilePage from './pages/Profile';
import SettingsPage from './pages/Settings';
import MarketPage from './pages/Market';
import SocialPage from './pages/Social';
import GuildPage from './pages/Guild';
import PlayerQuestsPage from './pages/PlayerQuests';
import AdminPage from './pages/Admin';

function Guard({ children }: { children: React.ReactNode }) {
  const { token, character, booted } = useStore();
  const location = useLocation();
  if (!booted) return <div className="page-loading">กำลังโหลด…</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (!character && location.pathname !== '/create') return <Navigate to="/create" replace />;
  return <>{children}</>;
}

function Toast() {
  const toast = useStore((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useStore.getState().showToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast?.text) return null;
  return <div className="toast" key={toast.id}>{toast.text}</div>;
}

export default function App() {
  const boot = useStore((s) => s.boot);
  const animations = useStore((s) => s.settings.animations);
  useEffect(() => {
    void boot();
  }, [boot]);
  // ตั้งค่า: ปิดเอฟเฟกต์เคลื่อนไหวทั้งเกม
  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', !animations);
  }, [animations]);

  // โหลดการ์ด custom ที่แอดมินสร้าง (ถ้ามี) เข้า registry ฝั่ง client
  useEffect(() => {
    void api<{ cards: import('@cardwar/shared').CardTemplate[] }>('/api/cards/custom')
      .then((r) => { for (const t of r.cards ?? []) registerTemplate(t); })
      .catch(() => {});
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/create" element={<CreateCharacterPage />} />
        {/* Lobby — ไม่มี Layout (ไม่มี header/back btn) */}
        <Route
          path="/"
          element={
            <Guard>
              <LobbyPage />
            </Guard>
          }
        />
        <Route
          element={
            <Guard>
              <Layout />
            </Guard>
          }
        >
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/deck" element={<DeckPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/mine" element={<GatherPage zone="mine" />} />
          <Route path="/forest" element={<GatherPage zone="forest" />} />
          <Route path="/craft" element={<CraftPage />} />
          <Route path="/repair" element={<RepairPage />} />
          <Route path="/dungeon" element={<DungeonPage />} />
          <Route path="/pvp" element={<PvpPage />} />
          <Route path="/battle" element={<BattlePage />} />
          <Route path="/quests" element={<QuestsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/guild" element={<GuildPage />} />
          <Route path="/pquests" element={<PlayerQuestsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
