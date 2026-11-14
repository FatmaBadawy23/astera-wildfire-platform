/** Error kinds the UI distinguishes (see components/states/QueryState). */
export type DataErrorKind = "unavailable" | "not-found" | "network" | "invalid-response" | "unknown";

export class DataError extends Error {
  readonly kind: DataErrorKind;
  readonly detail: string[];

  constructor(kind: DataErrorKind, message: string, detail: string[] = []) {
    super(message);
    this.name = "DataError";
    this.kind = kind;
    this.detail = detail;
  }
}

export function isDataError(error: unknown): error is DataError {
  return error instanceof DataError;
}

export function toDataError(error: unknown): DataError {
  if (isDataError(error)) return error;
  return new DataError("unknown", error instanceof Error ? error.message : String(error));
}

export const BACKEND_UNAVAILABLE_MESSAGE = "The backend API isn't connected yet. This data will be available in a later stage.";
