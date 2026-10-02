import type { Need } from "#/modules/social/providers";
import type { ApiScope } from "./api-keys.service";
import type { Input } from "./input";

/**
 * One thing an agent can do over MCP. Each feature module declares its own tools (e.g.
 * social.tools.ts, storage.tools.ts); api/tools.ts gathers them for the MCP server. A tool
 * is a thin adapter: it reads its arguments and calls its module's service. The REST API is
 * separate (*.rest.ts) and calls the same services.
 */

export type Tool = {
  name: string;
  description: string;
  scope: ApiScope;
  /** What it needs from the platform; left out, it works on every platform. */
  needs?: Need;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
  /**
   * A write that must not happen twice: it takes an optional idempotencyKey, and a call
   * repeated with the same key gets the first call's answer.
   */
  idempotent?: boolean;
  run: (userId: string, input: Input) => Promise<unknown>;
};

export const READ_ONLY = { readOnlyHint: true };
