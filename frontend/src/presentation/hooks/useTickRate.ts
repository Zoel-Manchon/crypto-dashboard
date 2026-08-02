import { useEffect, useRef, useState } from "react";
import { priceStream } from "../../infrastructure/container";

/**
 * Measured ticks per second on the live feed.
 *
 * A pulsing "LIVE" dot proves nothing — it pulses just as happily against a
 * dead socket. This counts real price updates over a rolling two-second window
 * and reports the rate, so the header states a fact instead of a mood.
 */
export function useTickRate(windowMs = 2000): number {
  const [rate, setRate] = useState(0);
  const stamps = useRef<number[]>([]);

  useEffect(() => {
    const unsubscribe = priceStream.subscribe((prices) => {
      const now = Date.now();
      for (let i = 0; i < prices.length; i++) stamps.current.push(now);
    });

    const t = window.setInterval(() => {
      const cutoff = Date.now() - windowMs;
      stamps.current = stamps.current.filter((s) => s >= cutoff);
      setRate(stamps.current.length / (windowMs / 1000));
    }, 500);

    return () => {
      unsubscribe();
      window.clearInterval(t);
    };
  }, [windowMs]);

  return rate;
}
