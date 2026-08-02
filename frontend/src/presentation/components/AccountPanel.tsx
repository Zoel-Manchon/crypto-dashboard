import { useEffect, useState } from "react";
import {
  type Session,
  currentSession,
  login,
  logout,
  pullPrefs,
  pushPrefs,
  register,
} from "../../infrastructure/auth/cloud-sync";

type Mode = "login" | "register";

export default function AccountPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  useEffect(() => {
    setSession(currentSession());
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      await action();
    } catch (e) {
      setMsg({ text: String(e instanceof Error ? e.message : e).toUpperCase(), err: true });
    } finally {
      setBusy(false);
    }
  }

  const submit = () =>
    run(async () => {
      const s = mode === "login" ? await login(username, password) : await register(username, password);
      setSession(s);
      setPassword("");
      if (mode === "login") {
        const n = await pullPrefs(s);
        setMsg({ text: n > 0 ? "SIGNED IN · CLOUD STATE PULLED — RELOAD TO APPLY" : "SIGNED IN" });
      } else {
        await pushPrefs(s);
        setMsg({ text: "ACCOUNT CREATED · LOCAL STATE PUSHED TO CLOUD" });
      }
    });

  const doPush = () => session && run(async () => { await pushPrefs(session); setMsg({ text: "PUSHED — WATCHLIST · ALERTS · HOLDINGS · CLOCKS SAVED" }); });
  const doPull = () => session && run(async () => {
    const n = await pullPrefs(session);
    setMsg({ text: n > 0 ? `PULLED ${n} SECTIONS — RELOAD TO APPLY` : "NOTHING STORED IN CLOUD YET" });
  });

  const inputStyle = {
    backgroundColor: "var(--bg-row)",
    color: "var(--text)",
    border: "1px solid var(--grid)",
  };
  const btn = (accent: boolean) => ({
    backgroundColor: accent ? "var(--color-accent)" : "var(--bg-row)",
    color: accent ? "#050506" : "var(--text)",
    border: accent ? "none" : "1px solid var(--grid-strong)",
    opacity: busy ? 0.5 : 1,
  });

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center gap-4 px-4 py-4">
        {session ? (
          <>
            <span className="label">
              SIGNED IN AS <span style={{ color: "var(--color-accent)" }}>{session.username.toUpperCase()}</span>
            </span>
            <div className="flex gap-2">
              <button onClick={doPush} disabled={busy} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(true)}>
                ⇡ PUSH TO CLOUD
              </button>
              <button onClick={doPull} disabled={busy} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(false)}>
                ⇣ PULL FROM CLOUD
              </button>
              <button
                onClick={() => { logout(); setSession(null); setMsg({ text: "SIGNED OUT — LOCAL DATA UNTOUCHED" }); }}
                disabled={busy}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={btn(false)}
              >
                SIGN OUT
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setMsg(null); }}
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: mode === m ? "var(--color-accent)" : "var(--bg-row)",
                    color: mode === m ? "#050506" : "var(--text-dim)",
                  }}
                >
                  {m === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
                </button>
              ))}
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="USERNAME"
              autoComplete="username"
              className="px-3 py-1.5 text-sm font-bold uppercase"
              style={inputStyle}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
              placeholder="PASSWORD (MIN 8)"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="px-3 py-1.5 text-sm font-bold"
              style={inputStyle}
            />
            <button
              onClick={submit}
              disabled={busy || !username || password.length < 8}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
              style={btn(true)}
            >
              {busy ? "…" : mode === "login" ? "→ SIGN IN" : "→ REGISTER"}
            </button>
          </>
        )}
      </div>

      <p className="border-t px-4 py-2 label" style={{ borderColor: "var(--grid)", color: msg?.err ? "var(--color-down)" : "var(--text-faint)" }}>
        {msg
          ? msg.text
          : session
            ? "SYNCS WATCHLIST · ALERTS · HOLDINGS · CLOCKS — ARGON2 + JWT, PER-USER IN POSTGRES"
            : "OPTIONAL — CREATE AN ACCOUNT TO SYNC YOUR WATCHLIST, ALERTS, HOLDINGS AND CLOCKS ACROSS BROWSERS"}
      </p>
    </div>
  );
}
