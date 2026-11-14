/**
 * "My places": countries a person wants to keep an eye on, saved in this browser only (localStorage).
 * No account and no server: nothing is sent anywhere, and no alerts are sent (alerts are not available yet).
 * Works without storage (private windows): the list then lasts for this visit only.
 */
import { useSyncExternalStore } from "react";

export const PLACES_STORAGE_KEY = "astera-watch-places";
const MAX_PLACES = 20;
const ISO3 = /^[A-Z]{3}$/;

let memory: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(PLACES_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    memory = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string" && ISO3.test(x)).slice(0, MAX_PLACES) : [];
  } catch {
    memory = [];
  }
  return memory;
}

function write(next: string[]) {
  memory = next;
  try {
    window.localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: kept for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PLACES_STORAGE_KEY) {
      memory = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: forget the cached list (tests clear localStorage between cases). */
export function resetPlacesCache() {
  memory = null;
}

export function usePlaces() {
  const places = useSyncExternalStore(subscribe, read, () => [] as string[]);
  return {
    places,
    has: (iso3: string) => places.includes(iso3),
    add: (iso3: string) => {
      const current = read();
      if (!current.includes(iso3) && current.length < MAX_PLACES) write([...current, iso3]);
    },
    remove: (iso3: string) => write(read().filter((p) => p !== iso3)),
    max: MAX_PLACES,
  };
}
