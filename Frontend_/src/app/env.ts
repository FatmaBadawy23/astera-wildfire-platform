/** Data mode selected at build time (VITE_DATA_MODE). Anything other than "http" means mock data. */
export type DataMode = "mock" | "http";

/** Read at call time (not at import) so tests can switch modes with vi.stubEnv. */
export function getDataMode(): DataMode {
  return import.meta.env.VITE_DATA_MODE === "http" ? "http" : "mock";
}
