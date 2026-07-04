// Simple in-memory fixed-window rate limiter.
//
// NOTE: this is per-instance (single-process) only. Each serverless instance /
// worker keeps its own Map, so under a multi-instance deployment an attacker
// gets `limit` attempts PER instance. For production effectiveness use a shared
// store (e.g. Upstash Redis) instead.
//
// Entries are evicted lazily (expired-on-touch + a sweep past a size cap), so a
// stream of unique keys (e.g. attacker-supplied usernames) cannot grow the Map
// without bound.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

function sweep(now: number): void {
  for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
}

/** True if `key` is still under `limit` for the current window. Does NOT mutate
 *  (so a bare check never creates an entry — only recordHit does). */
export function underLimit(key: string, limit: number): boolean {
  const w = windows.get(key);
  if (!w || Date.now() >= w.resetAt) return true;
  return w.count < limit;
}

/** Count one hit against `key`. Call this only on the events you want to limit
 *  (e.g. a FAILED login) so successful requests are never penalised. */
export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  if (windows.size >= MAX_KEYS) sweep(now);
  const w = windows.get(key);
  if (!w || now >= w.resetAt) windows.set(key, { count: 1, resetAt: now + windowMs });
  else w.count++;
}
