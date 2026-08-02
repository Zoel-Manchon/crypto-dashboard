import { useEffect, useState } from "react";
import { currentSession, login, pullPrefs, register } from "../../infrastructure/auth/cloud-sync";

type Mode = "login" | "register";

/** Front-door auth screen. Signing in pulls cloud prefs, then enters the
 *  dashboard. Guest mode enters without an account (market data is public —
 *  this gate is UX, not access control; only /api/prefs is protected). */
export default function LoginGate() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or chose guest before)? Straight to the terminal.
  useEffect(() => {
    try {
      if (currentSession() || localStorage.getItem("cw.guest")) location.replace("/");
    } catch {
      /* storage unavailable — stay on the gate */
    }
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const s = mode === "login" ? await login(username, password) : await register(username, password);
      try {
        await pullPrefs(s); // hydrate this browser with the cloud copy
      } catch {
        /* prefs pull is best-effort at the door */
      }
      location.replace("/");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e).toUpperCase());
      setBusy(false);
    }
  }

  function guest() {
    try {
      localStorage.setItem("cw.guest", "1");
    } catch {
      /* ignore */
    }
    location.replace("/");
  }

  const inputStyle = {
    backgroundColor: "var(--bg-row)",
    color: "var(--text)",
    border: "1px solid var(--grid)",
    width: "100%",
  } as const;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-6 py-5 text-center" style={{ borderColor: "var(--grid)" }}>
          <div className="text-2xl font-extrabold tracking-widest" style={{ color: "var(--color-accent)" }}>
            CRYPTO·WATCH
          </div>
          <div className="label mt-1">TERMINAL ACCESS</div>
        </div>

        <div className="flex gap-px border-b" style={{ backgroundColor: "var(--grid)", borderColor: "var(--grid)" }}>
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className="flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: mode === m ? "var(--bg-panel)" : "var(--bg-row)",
                color: mode === m ? "var(--color-accent)" : "var(--text-dim)",
              }}
            >
              {m === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-6 py-6">
          <label className="label" htmlFor="lg-user">USERNAME</label>
          <input
            id="lg-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="px-3 py-2 text-sm font-bold"
            style={inputStyle}
            placeholder="3-32 CHARS · A-Z 0-9 _"
          />
          <label className="label" htmlFor="lg-pass">PASSWORD</label>
          <input
            id="lg-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && username && password.length >= 8 && submit()}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="px-3 py-2 text-sm font-bold"
            style={inputStyle}
            placeholder="MIN 8 CHARACTERS"
          />

          {error && (
            <p className="label" style={{ color: "var(--color-down)" }}>✕ {error}</p>
          )}

          <button
            onClick={submit}
            disabled={busy || !username || password.length < 8}
            className="mt-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--cw-on-accent)",
              opacity: busy || !username || password.length < 8 ? 0.5 : 1,
            }}
          >
            {busy ? "…" : mode === "login" ? "→ ENTER TERMINAL" : "→ REGISTER & ENTER"}
          </button>

          <button
            onClick={guest}
            disabled={busy}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest"
            style={{ backgroundColor: "transparent", color: "var(--text-dim)", border: "1px solid var(--grid-strong)" }}
          >
            CONTINUE AS GUEST
          </button>

          <p className="label mt-1 text-center" style={{ color: "var(--text-faint)" }}>
            AN ACCOUNT SYNCS WATCHLIST · ALERTS · HOLDINGS ACROSS BROWSERS
          </p>
        </div>
      </div>
    </div>
  );
}
