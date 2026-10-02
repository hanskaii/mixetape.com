import { storageTools } from "#/modules/storage/storage.tools";
import { socialTools } from "#/modules/social/social.tools";
import { libraryTools } from "#/modules/library/library.tools";
import { getProvider, platformsWith } from "#/modules/social/providers";
import { requireScope, type Caller } from "./api-keys.service";
import { ServiceError } from "./errors";
import { once } from "./idempotency.service";
import { Input, rejectUnknown } from "./input";
import type { Tool } from "./tool";

/**
 * Every MCP tool, from every module, in the order agents see them. Each module owns its
 * tools; storage knows nothing of scheduling, it only hands back `r2://` URLs. Each tool
 * needs one API-key permission. The REST API is a separate surface (endpoints.ts).
 */
export const TOOLS: Tool[] = [...socialTools, ...libraryTools, ...storageTools];

export const findTool = (name: string) => TOOLS.find((tool) => tool.name === name);

/** The platforms a tool is limited to, by name; nothing when it works on all of them. */
function onlyOn(tool: Tool) {
  if (!tool.needs) return "";
  return `; only on ${platformsWith(tool.needs)
    .map((id) => getProvider(id).name)
    .join(", ")}`;
}

const IDEMPOTENCY_KEY = {
  type: "string",
  description:
    "Any unique text (e.g. a UUID) for this one action. Repeating the call with the same key — say after a timeout — returns the first result instead of doing it twice.",
};

/** A tool's input schema as agents see it: idempotent tools also take an idempotencyKey. */
function inputSchemaOf(tool: Tool) {
  if (!tool.idempotent) return tool.inputSchema;
  const properties = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
  return { ...tool.inputSchema, properties: { ...properties, idempotencyKey: IDEMPOTENCY_KEY } };
}

/** The tools a caller may use, as agents see them. */
export function toolsFor(caller: Caller) {
  return TOOLS.filter((tool) => caller.scopes.includes(tool.scope)).map((tool) => ({
    name: tool.name,
    description: `${tool.description} [permission: ${tool.scope}${onlyOn(tool)}]`,
    inputSchema: inputSchemaOf(tool),
    ...(tool.annotations && { annotations: tool.annotations }),
  }));
}

/** Every tool, for the docs: what it does, its permission, platforms and input. */
export const toolCatalog = () =>
  TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    permission: tool.scope,
    platforms: platformsWith(tool.needs),
    inputSchema: inputSchemaOf(tool),
    ...(tool.annotations && { annotations: tool.annotations }),
  }));

/**
 * Runs a tool as the caller: checks the permission, refuses arguments the tool does not
 * take, and — for an idempotent tool given an idempotencyKey — runs it once per key.
 */
export async function runTool(caller: Caller, tool: Tool, args: Record<string, unknown>) {
  requireScope(caller, tool.scope);
  const { idempotencyKey, ...rest } = args;
  const properties = tool.inputSchema.properties as Record<string, unknown> | undefined;
  if (properties)
    rejectUnknown(args, [
      ...Object.keys(properties),
      ...(tool.idempotent ? ["idempotencyKey"] : []),
    ]);
  if (!tool.idempotent || idempotencyKey === undefined)
    return tool.run(caller.userId, new Input(rest));
  if (typeof idempotencyKey !== "string")
    throw new ServiceError("idempotencyKey must be text", 400, {
      code: "invalid_field",
      field: "idempotencyKey",
    });
  const answer = await once(
    caller.userId,
    idempotencyKey,
    { tool: tool.name, args: rest },
    async () => ({ status: 200, body: await tool.run(caller.userId, new Input(rest)) }),
    "idempotencyKey",
  );
  return answer.body;
}
