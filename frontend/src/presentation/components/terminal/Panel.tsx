import type { ReactNode } from "react";

/**
 * Panel — a labelled region of the terminal. No border, no radius, no shadow:
 * panels sit inside the flush grid and inherit its hairlines, so the only
 * chrome a panel owns is its own header rule.
 */
export function Panel({
  title,
  right,
  children,
  bodyClass = "cw-body",
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
}) {
  return (
    <section className="min-w-0">
      <div className="cw-head">
        <span>{title}</span>
        {right !== undefined && <span style={{ color: "var(--cw-dim)" }}>{right}</span>}
      </div>
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
