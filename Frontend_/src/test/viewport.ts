import { act } from "@testing-library/react";

/**
 * Controllable window width for tests: matchMedia answers (min-width: Npx) queries from `width` and notifies
 * listeners on resize. Also provides a no-op ResizeObserver (Radix measures its triggers; jsdom has none).
 */
export function installViewport(initial = 1440) {
  let width = initial;
  const listeners = new Set<() => void>();
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = globalThis.ResizeObserver;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = Number(/min-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        get matches() {
          return Number.isFinite(min) ? width >= min : false;
        },
        media: query,
        onchange: null,
        addEventListener: (_: string, l: () => void) => listeners.add(l),
        removeEventListener: (_: string, l: () => void) => listeners.delete(l),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  return {
    set(next: number) {
      width = next;
    },
    resizeTo(next: number) {
      act(() => {
        width = next;
        listeners.forEach((l) => l());
      });
    },
    restore() {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
      globalThis.ResizeObserver = originalResizeObserver;
      listeners.clear();
    },
  };
}
