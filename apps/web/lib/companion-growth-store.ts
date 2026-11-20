import { useMemo, useSyncExternalStore } from "react";
import { EMPTY_GROWTH, parseGrowth, type Growth } from "./companion-growth";

/* Studigo's growth is kept once per device, not per room (LC-DEC-035), and only the
   companion writes it. Storage can be blocked or full; then growth is simply not
   kept, and nothing here may throw into the room. */

export const GROWTH_KEY = "studigo.companion.growth";

type Store = Pick<Storage, "getItem" | "setItem">;
const listeners = new Set<() => void>();

function device(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGrowth(store: Store | null): Growth {
  if (!store) return EMPTY_GROWTH;
  try {
    return parseGrowth(store.getItem(GROWTH_KEY));
  } catch {
    return EMPTY_GROWTH;
  }
}

export function saveGrowth(store: Store | null, growth: Growth): boolean {
  if (!store) return false;
  try {
    store.setItem(GROWTH_KEY, JSON.stringify(growth));
    return true;
  } catch {
    return false;
  }
}

export function readGrowth(): Growth {
  return loadGrowth(device());
}

export function writeGrowth(growth: Growth) {
  saveGrowth(device(), growth);
  listeners.forEach((notify) => notify());
}

export function subscribeGrowth(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === GROWTH_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

function rawGrowth(): string | null {
  try {
    return device()?.getItem(GROWTH_KEY) ?? null;
  } catch {
    return null;
  }
}

/** His growth on this device, live: it updates when he earns more, or another tab changes it. */
export function useCompanionGrowth(): Growth {
  const raw = useSyncExternalStore(subscribeGrowth, rawGrowth, () => null);
  return useMemo(() => parseGrowth(raw), [raw]);
}
