export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

const TOKEN_KEY = 'cw_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      // ตั้ง content-type เฉพาะตอนมี body — Fastify ปัดต้นข้อความว่างทิ้งถ้าระบุ json โดยไม่มี body
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? `เกิดข้อผิดพลาด (${res.status})`);
  }
  return data as T;
}
