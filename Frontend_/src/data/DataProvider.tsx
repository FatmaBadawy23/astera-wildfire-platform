import { createContext, useContext, useState, type ReactNode } from "react";
import { getDataMode, type DataMode } from "@/app/env";
import { createUnavailableRepositories } from "./http/unavailableRepositories";
import { createMockRepositories, readMockScenario } from "./mock/mockRepositories";
import type { Repositories } from "./repositories";

/** Simulated mock latency so loading states are visible in development; none in tests or production. */
const MOCK_DELAY_MS = import.meta.env.DEV && import.meta.env.MODE !== "test" ? 250 : 0;

export function createRepositories(mode: DataMode = getDataMode()): Repositories {
  if (mode === "http") return createUnavailableRepositories();
  return createMockRepositories({ delayMs: MOCK_DELAY_MS, scenario: readMockScenario() });
}

const RepositoriesContext = createContext<Repositories | null>(null);

/** Provides the data adapter selected by VITE_DATA_MODE. Tests may pass their own repositories. */
export function DataProvider({ repositories, children }: { repositories?: Repositories; children: ReactNode }) {
  const [repos] = useState(() => repositories ?? createRepositories());
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error("useRepositories must be used inside <DataProvider>");
  return repos;
}
