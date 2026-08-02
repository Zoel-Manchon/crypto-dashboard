import { API_BASE_URL } from "../config";

/**
 * Cloud-sync client: register/login against the backend, then push/pull the
 * local dashboard state (watchlist, alerts, holdings, clocks) as one blob.
 * The JWT is kept in localStorage under `cw.token`.
 */

const TOKEN_KEY = "cw.token";
const USER_KEY = "cw.user";

/** The localStorage keys that make up a user's dashboard state. */
export const SYNCED_KEYS = ["cw.favorites", "cw.alerts", "cw.holdings", "cw:clocks"] as const;

export interface Session {
  token: string;
  username: string;
  role: string;
}

export function currentSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const username = localStorage.getItem(USER_KEY);
    return token && username ? { token, username, role: "user" } : null;
  } catch {
    return null;
  }
}

function storeSession(s: Session) {
  localStorage.setItem(TOKEN_KEY, s.token);
  localStorage.setItem(USER_KEY, s.username);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function authRequest(path: string, username: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || `HTTP ${res.status}`);
  }
  const session = (await res.json()) as Session;
  storeSession(session);
  return session;
}

export const register = (u: string, p: string) => authRequest("/api/auth/register", u, p);
export const login = (u: string, p: string) => authRequest("/api/auth/login", u, p);

/** Gather the synced localStorage keys into one JSON object string. */
export function collectLocalPrefs(): string {
  const blob: Record<string, unknown> = {};
  for (const key of SYNCED_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) blob[key] = JSON.parse(raw);
    } catch {
      /* skip malformed entries */
    }
  }
  return JSON.stringify(blob);
}

/** Write a prefs blob back into localStorage (only whitelisted keys). */
export function applyPrefs(prefsJson: string): number {
  let applied = 0;
  try {
    const blob = JSON.parse(prefsJson) as Record<string, unknown>;
    for (const key of SYNCED_KEYS) {
      if (key in blob) {
        localStorage.setItem(key, JSON.stringify(blob[key]));
        applied += 1;
      }
    }
  } catch {
    /* ignore malformed server blob */
  }
  return applied;
}

export async function pushPrefs(session: Session): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/prefs`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ prefs: collectLocalPrefs() }),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "session expired — log in again" : `HTTP ${res.status}`);
}

export async function pullPrefs(session: Session): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/prefs`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) throw new Error(res.status === 401 ? "session expired — log in again" : `HTTP ${res.status}`);
  const body = (await res.json()) as { prefs: string };
  return applyPrefs(body.prefs);
}
