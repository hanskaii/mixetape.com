import catalog from "../api/tools.json";
import { permissions } from "./api-overview";

/**
 * The MCP tools, from the catalog the app publishes at /mcp/tools.json (`pnpm tools:sync`).
 * Grouped by the permission each needs, in the order the API keys page lists them.
 */

type Schema = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  items?: Schema;
  anyOf?: Schema[];
  title?: string;
  properties?: Record<string, Schema>;
  required?: string[];
};

export type Tool = {
  name: string;
  description: string;
  permission: string;
  platforms: string[];
  inputSchema: Schema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
};

export const tools = catalog.tools as Tool[];

export function toolGroups() {
  return permissions
    .map((permission) => ({
      ...permission,
      tools: tools.filter((tool) => tool.permission === permission.name),
    }))
    .filter((group) => group.tools.length);
}

/** A field's type in words: "text", "list of text", "one of: a, b", "per platform"… */
export function typeOf(schema: Schema): string {
  if (schema.anyOf) return "object, per platform";
  if (schema.enum) return `one of: ${schema.enum.filter((value) => value !== null).join(", ")}`;
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  if (type === "array") return `list of ${schema.items ? typeOf(schema.items) : "values"}`;
  return (
    { string: "text", integer: "whole number", number: "number", boolean: "true / false" }[
      type ?? ""
    ] ??
    type ??
    "any"
  );
}

/** A tool's arguments: name, type, whether required, what it is. */
export function fieldsOf(tool: Tool) {
  const required = tool.inputSchema.required ?? [];
  return Object.entries(tool.inputSchema.properties ?? {}).map(([name, schema]) => ({
    name,
    type: typeOf(schema),
    required: required.includes(name),
    description: schema.description,
  }));
}

/** The first sentence of a description, for lists. */
export const firstSentence = (text: string) => text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
