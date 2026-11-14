import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { DataProvider } from "@/data/DataProvider";
import { DataError } from "@/data/errors";
import { useEvents } from "@/data/hooks";
import { createUnavailableRepositories } from "@/data/http/unavailableRepositories";
import { createMockRepositories } from "@/data/mock/mockRepositories";
import type { Repositories } from "@/data/repositories";
import { axeViolations } from "@/test/axe";
import { QueryState } from "./QueryState";
import { EmptyState, ErrorState, LoadingState, UnavailableState } from "./States";

describe("state components", () => {
  it("loading is a polite, busy status", () => {
    render(<LoadingState label="Loading events" />);
    const s = screen.getByRole("status");
    expect(s).toHaveAttribute("aria-busy", "true");
    expect(s).toHaveAttribute("aria-live", "polite");
    expect(s).toHaveTextContent("Loading events …");
  });

  it("empty is a status with its message", () => {
    render(<EmptyState title="No events">No events match these filters.</EmptyState>);
    expect(screen.getByRole("status")).toHaveTextContent("No eventsNo events match these filters.");
  });

  it("error is an alert with a working Retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Failed." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("unavailable is a status without Retry", () => {
    render(<UnavailableState message="Locked until a suitable pair exists." />);
    expect(screen.getByRole("status")).toHaveTextContent("Not available yet");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["light", "dark"] as const)("all four states have no axe violations (%s)", async (theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    const { container } = render(
      <ThemeProvider>
        <LoadingState />
        <EmptyState>Nothing.</EmptyState>
        <ErrorState message="Failed." onRetry={() => {}} detail={["x"]} />
        <UnavailableState message="Not connected." />
      </ThemeProvider>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("QueryState maps every data situation to the right state", () => {
  function Events() {
    const q = useEvents();
    return (
      <QueryState query={q} loadingLabel="Loading events" isEmpty={(d) => d.length === 0} empty={<EmptyState title="No events" />}>
        {(events) => <p>{events.length} events</p>}
      </QueryState>
    );
  }
  function renderWith(repositories: Repositories): void {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <DataProvider repositories={repositories}>{children}</DataProvider>
      </QueryClientProvider>
    );
    render(<Events />, { wrapper: Wrapper });
  }

  it("loading, then data", async () => {
    renderWith(createMockRepositories());
    expect(screen.getByRole("status")).toHaveTextContent("Loading events …");
    expect(await screen.findByText("6 events")).toBeInTheDocument();
  });

  it("empty data → empty state", async () => {
    renderWith(createMockRepositories({ scenario: "empty" }));
    expect(await screen.findByText("No events")).toBeInTheDocument();
  });

  it("unavailable (http mode) → unavailable state, no Retry", async () => {
    renderWith(createUnavailableRepositories());
    expect(await screen.findByText("Not available yet")).toBeInTheDocument();
    expect(screen.getByText(/backend API isn't connected yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("network error → alert with Retry that refetches", async () => {
    const base = createMockRepositories();
    let calls = 0;
    const flaky: Repositories = {
      ...base,
      events: {
        ...base.events,
        listEvents: (q) => (++calls === 1 ? Promise.reject(new DataError("network", "Request failed.")) : base.events.listEvents(q)),
      },
    };
    renderWith(flaky);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load the data");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("6 events")).toBeInTheDocument();
    await waitFor(() => expect(calls).toBe(2));
  });

  it("invalid response → alert explaining the data couldn't be used (not repaired)", async () => {
    const base = createMockRepositories();
    renderWith({
      ...base,
      events: { ...base.events, listEvents: () => Promise.reject(new DataError("invalid-response", "Invalid event data", ["event X: provenance missing"])) },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("The data couldn't be used");
    expect(screen.getByText("event X: provenance missing")).toBeInTheDocument();
  });

  it("not found → 'Not found' state", async () => {
    const base = createMockRepositories();
    renderWith({ ...base, events: { ...base.events, listEvents: () => Promise.reject(new DataError("not-found", "Event list not found.")) } });
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});
