import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { toDataError } from "@/data/errors";
import { EmptyState, ErrorState, LoadingState, UnavailableState } from "./States";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  loadingLabel?: string;
  /** When true for the data, the empty state is shown instead of children. */
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  /** Shown when the query is disabled (e.g. nothing selected yet). */
  idle?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Maps a query to the four standard states so every page handles them the same way:
 * loading → LoadingState; "unavailable" → UnavailableState; "not-found" → EmptyState;
 * network / invalid-response / unknown → ErrorState with Retry; empty data → EmptyState.
 */
export function QueryState<T>({ query, loadingLabel, isEmpty, empty, idle, children }: QueryStateProps<T>) {
  if (query.isPending) {
    if (query.fetchStatus === "idle") return <>{idle ?? null}</>;
    return <LoadingState label={loadingLabel} />;
  }
  if (query.isError) {
    const error = toDataError(query.error);
    if (error.kind === "unavailable") return <UnavailableState message={error.message} />;
    if (error.kind === "not-found") return <EmptyState title="Not found">{error.message}</EmptyState>;
    const title = error.kind === "invalid-response" ? "The data couldn't be used" : "Couldn't load the data";
    return <ErrorState title={title} message={error.message} detail={error.detail} onRetry={() => void query.refetch()} />;
  }
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState />}</>;
  return <>{children(query.data)}</>;
}
