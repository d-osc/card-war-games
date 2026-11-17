import { create } from 'zustand';
import { api, getToken, setToken } from './api';
import type { CharacterDTO, MeResponse, QuestDTO } from './dto';

interface AuthConfig {
  googleClientId: string | null;
  devLogin: boolean;
}

export interface GameSettings {
  /** เอฟเฟกต์เคลื่อนไหว/อนิเมชันทั้งเกม */
  animations: boolean;
  /** ปุ่ม Space ตีในมินิเกม */
  keyboardShortcut: boolean;
  /** กดค้าง-ลากเพื่อเลื่อน grid/แถว chip ด้วยเมาส์ */
  dragScroll: boolean;
}

const DEFAULT_SETTINGS: GameSettings = { animations: true, keyboardShortcut: true, dragScroll: true };

function loadSettings(): GameSettings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('cardwar-settings') ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: GameSettings) {
  try { localStorage.setItem('cardwar-settings', JSON.stringify(s)); } catch { /* ไม่เป็นไร */ }
}

interface AuthState {
  token: string | null;
  user: { id: number; name: string; avatar: string | null; isAdmin?: boolean } | null;
  character: CharacterDTO | null;
  quests: QuestDTO[];
  config: AuthConfig | null;
  booted: boolean;
  loading: boolean;
  toast: { id: number; text: string } | null;
  settings: GameSettings;

  boot(): Promise<void>;
  login(token: string, user: { id: number; name: string; avatar: string | null }): Promise<void>;
  logout(): void;
  refresh(): Promise<void>;
  setCharacter(c: CharacterDTO): void;
  setQuests(q: QuestDTO[]): void;
  showToast(text: string): void;
  setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void;
}

let toastId = 0;

export const useStore = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  character: null,
  quests: [],
  config: null,
  booted: false,
  loading: false,
  toast: null,
  settings: loadSettings(),

  async boot() {
    try {
      const config = await api<AuthConfig>('/api/auth/config');
      set({ config });
      if (getToken()) await get().refresh();
    } finally {
      set({ booted: true });
    }
  },

  async login(token, user) {
    setToken(token);
    set({ token });
    await get().refresh();
  },

  logout() {
    setToken(null);
    set({ token: null, user: null, character: null, quests: [] });
  },

  async refresh() {
    if (!getToken()) return;
    set({ loading: true });
    try {
      const me = await api<MeResponse>('/api/me');
      set({ user: me.user, character: me.character, quests: me.quests });
    } catch {
      // token หมดอายุ — ออกจากระบบ
      setToken(null);
      set({ token: null, user: null, character: null });
    } finally {
      set({ loading: false });
    }
  },

  setCharacter(c) {
    set({ character: c });
  },

  setQuests(q) {
    set({ quests: q });
  },

  showToast(text) {
    set({ toast: { id: ++toastId, text } });
  },

  setSetting(key, value) {
    const settings = { ...get().settings, [key]: value };
    saveSettings(settings);
    set({ settings });
  },
}));
