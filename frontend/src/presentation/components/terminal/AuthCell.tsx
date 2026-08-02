import { useEffect, useState } from "react";
import { currentSession, logout, type Session } from "../../../infrastructure/auth/cloud-sync";

/**
 * Identity in the header.
 *
 * The sign-in gate existed all along at /login, but once you picked "continue
 * as guest" the flag stuck in localStorage and there was no way back to it from
 * inside the terminal — the account layer became invisible even though it was
 * fully wired. This is the way back: who you are, and one action.
 *
 * Signing out clears the guest flag too, otherwise the gate would be skipped on
 * the next load and you'd land straight back in as nobody.
 */
export default function AuthCell() {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    setSession(currentSession());
    try {
      setGuest(localStorage.getItem("cw.guest") === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);

  function signOut() {
    logout();
    try {
      localStorage.removeItem("cw.guest");
    } catch {
      /* ignore */
    }
    location.replace("/login");
  }

  if (!session) {
    return (
      <a
        href="/login"
        className="cw-clock"
        style={{ display: "block", textDecoration: "none", color: "var(--cw-accent)" }}
      >
        <span className="cw-clock__city">{guest ? "Guest" : "Account"}</span>
        <span className="cw-clock__time" style={{ display: "block", fontSize: 13 }}>
          SIGN IN
        </span>
      </a>
    );
  }

  return (
    <button
      onClick={signOut}
      className="cw-clock"
      title={`Signed in as ${session.username} — click to sign out`}
      style={{ cursor: "pointer", background: "transparent", color: "var(--cw-fg)", textAlign: "left" }}
    >
      <span className="cw-clock__city">{session.username}</span>
      <span className="cw-clock__time" style={{ display: "block", fontSize: 13 }}>
        SIGN OUT
      </span>
    </button>
  );
}
