/**
 * An error meant for the caller: its message is shown as-is (REST `error`, MCP tool error)
 * with its HTTP status. Anything else is reported as an unexpected failure.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
