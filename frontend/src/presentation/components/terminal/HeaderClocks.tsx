import { useEffect, useState } from "react";

/** The four venues whose session overlap sets crypto's daily volume curve. */
const ZONES = [
  { city: "New York", tz: "America/New_York" },
  { city: "London", tz: "Europe/London" },
  { city: "Frankfurt", tz: "Europe/Berlin" },
  { city: "Tokyo", tz: "Asia/Tokyo" },
] as const;

function timeIn(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(at);
}

/** Clocks live in the header, not in a panel: they are chrome, not content. */
export default function HeaderClocks() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <>
      {ZONES.map((z) => (
        <div className="cw-clock" key={z.city}>
          <div className="cw-clock__city">{z.city}</div>
          <div className="cw-clock__time">{now ? timeIn(z.tz, now) : "--:--"}</div>
        </div>
      ))}
    </>
  );
}
