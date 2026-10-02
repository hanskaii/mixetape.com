/**
 * An error meant for the caller: its message is shown as-is (REST `error.message`, MCP tool
 * error) with its HTTP status and a stable `code` a program can branch on. Anything else is
 * reported as an unexpected failure.
 */

/** Codes a caller can rely on; the message may be reworded, the code is not. */
export const ERROR_CODES = {
  invalid_request: "The request is malformed, e.g. the body is not a JSON object",
  invalid_field: "A field has the wrong type or value (see field)",
  missing_field: "A required field is missing (see field)",
  unknown_field: "A field this endpoint does not take, often a typo (see field)",
  unauthorized: "No valid API key",
  missing_permission: "The API key lacks the permission this needs",
  forbidden: "Not allowed for this caller",
  not_found: "Not found, or not yours",
  method_not_allowed: "The path exists but not with this method",
  invalid_post_state: "The post's status does not allow this, e.g. cancelling a published post",
  account_needs_reconnect: "The channel must be connected again before it can post",
  file_not_ready: "The file's upload is not finished",
  media_not_supported: "The platform cannot take these files as one post",
  not_supported_by_platform: "The platform has no such feature",
  nothing_to_publish: "The selection or group has no files",
  already_exists: "Something with that name already exists",
  conflict: "Not possible in the current state",
  idempotency_key_reused: "The Idempotency-Key was used before with a different request",
  idempotency_in_progress: "A request with this Idempotency-Key is still running",
  source_unreachable: "The file at the given URL could not be fetched; check it is public",
  platform_error: "The platform refused or failed the call; the message says why",
  rate_limited: "Too many requests; wait Retry-After seconds",
  platform_unavailable: "mixetape cannot connect that platform yet",
  internal_error: "Something failed on mixetape's side",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

const BY_STATUS: Record<number, ErrorCode> = {
  400: "invalid_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  405: "method_not_allowed",
  409: "conflict",
  429: "rate_limited",
  503: "platform_unavailable",
};

export class ServiceError extends Error {
  readonly code: ErrorCode;
  /** The input field the error is about, when there is one. */
  readonly field?: string;

  constructor(
    message: string,
    readonly status = 400,
    detail: { code?: ErrorCode; field?: string } = {},
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = detail.code ?? BY_STATUS[status] ?? (status >= 500 ? "internal_error" : "conflict");
    this.field = detail.field;
  }
}

/** The JSON body every failed REST request answers with. */
export function errorBody(error: ServiceError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.field && { field: error.field }),
    },
  };
}
