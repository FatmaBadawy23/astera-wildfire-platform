import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { DataProvider } from "./DataProvider";
import { DataError } from "./errors";
import { createUnavailableRepositories } from "./http/unavailableRepositories";
import { createQueryClient, shouldRetry, useAnalysis, useAvailability, useEvent, useEvents, useRecentEvents } from "./hooks";
import { createMockRepositories } from "./mock/mockRepositories";
import type { Repositories } from "./repositories";

function wrapper(repositories: Repositories) {
  const client = createQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <DataProvider repositories={repositories}>{children}</DataProvider>
    </QueryClientProvider>
  );
}

describe("data hooks", () => {
  it("load data through the injected repositories", async () => {
    const { result } = renderHook(() => useEvents({ countryIso3: "USA" }), { wrapper: wrapper(createMockRepositories()) });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((e) => e.id)).toEqual(["SYN-01"]);
  });

  it("recent events and analysis", async () => {
    const w = wrapper(createMockRepositories());
    const recent = renderHook(() => useRecentEvents(2), { wrapper: w });
    await waitFor(() => expect(recent.result.current.data?.map((e) => e.id)).toEqual(["SYN-06", "SYN-05"]));
    const analysis = renderHook(() => useAnalysis("SYN-01"), { wrapper: w });
    await waitFor(() => expect(analysis.result.current.data?.changedArea.kind).toBe("estimated"));
  });

  it("not-found is reported once, without retries", async () => {
    const { result } = renderHook(() => useEvent("NOPE"), { wrapper: wrapper(createMockRepositories()) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as DataError).kind).toBe("not-found");
    expect(result.current.failureCount).toBe(1);
  });

  it("http mode: 'unavailable' without retries", async () => {
    const { result } = renderHook(() => useEvents(), { wrapper: wrapper(createUnavailableRepositories()) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as DataError).kind).toBe("unavailable");
    expect(result.current.failureCount).toBe(1);
  });

  it("queries without an ID stay idle (nothing selected)", () => {
    const { result } = renderHook(() => useAvailability(undefined), { wrapper: wrapper(createMockRepositories()) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.isPending).toBe(true);
  });

  it("only network errors are retried, at most twice", () => {
    expect(shouldRetry(0, new DataError("network", "x"))).toBe(true);
    expect(shouldRetry(1, new DataError("network", "x"))).toBe(true);
    expect(shouldRetry(2, new DataError("network", "x"))).toBe(false);
    for (const kind of ["unavailable", "not-found", "invalid-response", "unknown"] as const) {
      expect(shouldRetry(0, new DataError(kind, "x"))).toBe(false);
    }
  });
});
