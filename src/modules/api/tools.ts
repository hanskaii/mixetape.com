import { storageTools } from "#/modules/storage/storage.tools";
import { socialTools } from "#/modules/social/social.tools";
import { libraryTools } from "#/modules/library/library.tools";
import { requireScope, type Caller } from "./api-keys.service";
import { Input, type Tool } from "./tool";

/**
 * Every tool, from every module, in the order agents see them. Each module owns its tools;
 * storage knows nothing of scheduling, it only hands back `r2://` URLs. MCP (/mcp) and REST
 * (/api/v1/tools/:name) both serve this list, and each tool needs one API-key permission.
 */
export const TOOLS: Tool[] = [...socialTools, ...libraryTools, ...storageTools];

export const findTool = (name: string) => TOOLS.find((tool) => tool.name === name);

/** The tools a caller may use, as agents see them. */
export function toolsFor(caller: Caller) {
  return TOOLS.filter((tool) => caller.scopes.includes(tool.scope)).map(
    ({ name, description, scope, inputSchema, annotations }) => ({
      name,
      description: `${description} [permission: ${scope}]`,
      inputSchema,
      ...(annotations && { annotations }),
    }),
  );
}

/** Runs a tool as the caller, after checking the caller's permission for it. */
export async function runTool(caller: Caller, tool: Tool, args: Record<string, unknown>) {
  requireScope(caller, tool.scope);
  return tool.run(caller.userId, new Input(args));
}
