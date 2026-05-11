import type { ListResult } from "@/types/domain";

export type Unsubscribe = () => void;

export interface ReadService<T, F = void> {
  list(filter?: F): Promise<ListResult<T>>;
  get(id: string): Promise<T | null>;
  subscribe(onUpdate: (snapshot: ListResult<T>) => void, filter?: F, intervalMs?: number): Unsubscribe;
}

/** Helper: build a poll-based subscription out of a list() method. */
export function pollSubscription<T, F>(
  list: (filter?: F) => Promise<ListResult<T>>,
  onUpdate: (snapshot: ListResult<T>) => void,
  filter?: F,
  intervalMs = 10_000,
): Unsubscribe {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    try {
      onUpdate(await list(filter));
    } catch {
      /* swallow — surface via store later */
    }
  };
  void tick();
  const h = setInterval(tick, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(h);
  };
}

export const nowIso = () => new Date().toISOString();
