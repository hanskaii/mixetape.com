import type { JsonValue } from "#/database/schema";
import { ServiceError } from "./errors";

/**
 * Arguments as an MCP tool or a REST endpoint received them, read with the type each one
 * should have. Both interfaces validate through this, so a bad field reads the same way.
 */
export class Input {
  constructor(private readonly args: Record<string, unknown>) {}

  private bad(name: string, what: string): never {
    throw new ServiceError(`${name} must be ${what}`, 400, { code: "invalid_field", field: name });
  }

  /** The argument as sent — e.g. to tell an explicit null (clear it) from leaving it out. */
  raw(name: string): unknown {
    return this.args[name];
  }

  string(name: string): string {
    const value = this.optionalString(name);
    if (!value)
      throw new ServiceError(`${name} is required`, 400, { code: "missing_field", field: name });
    return value;
  }

  optionalString(name: string): string | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "string" ? value : this.bad(name, "text");
  }

  number(name: string): number | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "number" && Number.isFinite(value) ? value : this.bad(name, "a number");
  }

  boolean(name: string): boolean | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "boolean" ? value : this.bad(name, "true or false");
  }

  strings(name: string): string[] | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value
      : this.bad(name, "a list of text");
  }

  object(name: string): Record<string, JsonValue> | undefined {
    const value = this.args[name];
    if (value === undefined || value === null) return undefined;
    return typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, JsonValue>)
      : this.bad(name, "an object");
  }
}

/** A JSON Schema object with the given properties. */
export function object(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object", properties, ...(required.length && { required }) };
}

/**
 * Refuses arguments a schema does not name. Without it a typo (`schedueldAt`) is dropped
 * silently and the post goes out without what the caller meant to set.
 */
export function rejectUnknown(
  args: Record<string, unknown>,
  known: Iterable<string>,
  /** Also accepted, but not offered in the message (e.g. a path parameter repeated). */
  tolerated: Iterable<string> = [],
) {
  const listed = [...known];
  const allowed = new Set([...listed, ...tolerated]);
  const unknown = Object.keys(args).find((name) => !allowed.has(name));
  if (unknown)
    throw new ServiceError(
      `${unknown} is not a field here; it takes ${listed.join(", ") || "no fields"}`,
      400,
      { code: "unknown_field", field: unknown },
    );
}
