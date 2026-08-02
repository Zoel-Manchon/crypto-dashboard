/**
 * A single hold switch for the live price feed.
 *
 * The socket stays connected while held — frames still arrive, they just aren't
 * propagated to subscribers. That way "hold" is instant in both directions and
 * never costs a reconnect, which matters on a terminal you leave open all day.
 */

let paused = false;
const listeners = new Set<(paused: boolean) => void>();

export function isFeedPaused(): boolean {
  return paused;
}

export function setFeedPaused(next: boolean): void {
  if (paused === next) return;
  paused = next;
  for (const l of listeners) l(paused);
}

export function onFeedPauseChange(listener: (paused: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
