import type { JsonValue } from "#/database/schema";
import type { ApiScope } from "./api-keys.service";
import { ServiceError } from "./errors";

/**
 * One thing an agent can do. Each feature module declares its own tools (e.g.
 * social.tools.ts, storage.tools.ts); api/tools.ts gathers them for MCP and REST.
 * A tool is a thin adapter: it reads its arguments and calls its module's service.
 */

export type Tool = {
  name: string;
  description: string;
  scope: ApiScope;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  run: (userId: string, input: Input) => Promise<unknown>;
};

/** A tool's arguments, read with the type each one should have. */
export class Input {
  constructor(private readonly args: Record<string, unknown>) {}

  private bad(name: string, what: string): never {
    throw new ServiceError(`${name} must be ${what}`);
  }

  string(name: string): string {
    const value = this.optionalString(name);
    if (!value) throw new ServiceError(`${name} is required`);
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

export const READ_ONLY = { readOnlyHint: true };
