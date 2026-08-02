import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/** Switches the terminal between the two palettes: midnight and solar. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
    document.documentElement.dataset.pal = next === "light" ? "solar" : "midnight";
    try {
      localStorage.setItem("theme", next);
    } catch (_) {
      /* storage unavailable — the palette still switches for this session */
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle palette"
      className="cw-clock"
      style={{ cursor: "pointer", background: "transparent", color: "var(--cw-fg)", textAlign: "left" }}
    >
      <span className="cw-clock__city">Palette</span>
      <span className="cw-clock__time" style={{ display: "block", fontSize: 13 }}>
        {theme === "dark" ? "MIDNIGHT" : "SOLAR"}
      </span>
    </button>
  );
}
