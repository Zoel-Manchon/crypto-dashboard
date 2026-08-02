import { useEffect, useRef, useState } from "react";

export interface PriceFlash {
  /** direction of the most recent change, null until the second tick */
  dir: "up" | "down" | null;
  /** true for a short window right after a change — drives the colour flash */
  flashing: boolean;
  /** absolute move since the first price this session */
  sessionDelta: number | null;
}

/**
 * Tracks how a price is moving, not just what it is.
 *
 * A number that changes without announcing it reads as static — the eye needs
 * the transition, not the value. This colours the headline for 450ms on every
 * change, which is long enough to register and short enough not to smear when
 * ticks arrive several times a second.
 */
export function usePriceFlash(price: number | null | undefined): PriceFlash {
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [flashing, setFlashing] = useState(false);
  const prev = useRef<number | null>(null);
  const first = useRef<number | null>(null);

  useEffect(() => {
    if (price === null || price === undefined || !Number.isFinite(price)) return;
    if (first.current === null) first.current = price;
    const before = prev.current;
    prev.current = price;
    if (before === null || before === price) return;

    setDir(price > before ? "up" : "down");
    setFlashing(true);
    const t = window.setTimeout(() => setFlashing(false), 450);
    return () => window.clearTimeout(t);
  }, [price]);

  const sessionDelta =
    price !== null && price !== undefined && first.current !== null ? price - first.current : null;

  return { dir, flashing, sessionDelta };
}
