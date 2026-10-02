import spec from "../api/openapi.json";
import { platformLabel } from "./platforms";

/**
 * The REST reference's overview, from the OpenAPI document. The site builds no tag pages
 * (/api/tags/*): a tag is a resource's group of operations, listed on the overview and in
 * the sidebar. These helpers give the overview its facts and keep the text outputs
 * (Markdown, llms.txt) free of links to pages that do not exist.
 */

type Operation = {
  operationId: string;
  summary?: string;
  tags?: string[];
  "x-permission"?: string;
  "x-platforms"?: string[];
};

export const baseUrl = spec.servers[0]?.url ?? "";

/** What each permission allows. */
export const permissions = Object.entries(
  (spec.components.securitySchemes.apiKey as { "x-permissions"?: Record<string, string> })[
    "x-permissions"
  ] ?? {},
).map(([name, description]) => ({ name, description }));

const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
  Object.entries(methods as Record<string, unknown>)
    .filter(
      (entry): entry is [string, Operation] =>
        typeof entry[1] === "object" && entry[1] !== null && "operationId" in entry[1],
    )
    .map(([method, operation]) => ({ method: method.toUpperCase(), path, ...operation })),
);

const hrefOf = (operation: Operation) =>
  `/api/${(operation.tags?.[0] ?? "").replace(/\s+/g, "-")}/${operation.operationId}`;

/** An operation's permission and platforms, by its operationId (the last part of its URL). */
export function operationFacts(operationId: string) {
  const operation = operations.find((candidate) => candidate.operationId === operationId);
  return operation
    ? { permission: operation["x-permission"], platforms: operation["x-platforms"] }
    : null;
}

/** Every resource's operations, in the document's order, with their reference URLs. */
export function groups() {
  return spec.tags.map((tag) => ({
    name: tag.name,
    description: tag.description,
    operations: operations
      .filter((operation) => operation.tags?.[0] === tag.name)
      .map((operation) => ({
        label: operation.summary ?? operation.operationId,
        method: operation.method,
        path: operation.path,
        permission: operation["x-permission"],
        platforms: operation["x-platforms"],
        href: hrefOf(operation),
      })),
  }));
}

/** The groups as Markdown, in place of the list of links to tag pages. */
export function groupsMarkdown() {
  return groups()
    .map(
      (group) =>
        `## ${group.name}\n\n${group.operations
          .map(
            (op) =>
              `- [${op.label}](${op.href}) — \`${op.method} ${op.path}\` (${platformLabel(op.platforms)})`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
}

/**
 * A text output without the tag pages: the overview's "Sections" list becomes the groups,
 * and a whole tag page (its `# title` block, in llms-full.txt) or a line linking one goes.
 */
export function withoutTagPages(text: string) {
  return text
    .replace(/## Sections\n\n(?:- \[[^\]]*\]\([^)]*\/api\/tags\/[^)]*\)\n?)+/g, `${groupsMarkdown()}\n`)
    .replace(/\n# [^\n]+\n\n(?:>[^\n]*\n\n)?Source: \S+\/api\/tags\/[\s\S]*?(?=\n# |$)/g, "\n")
    .split("\n")
    .filter((line) => !/\/api\/tags\//.test(line))
    .join("\n");
}

/** Wraps a text route's GET so its body goes through withoutTagPages. */
export function withoutTagPagesRoute<Context>(get: (context: Context) => Promise<Response> | Response) {
  return async (context: Context) => {
    const response = await get(context);
    if (!response.ok) return response;
    return new Response(withoutTagPages(await response.text()), {
      status: response.status,
      headers: response.headers,
    });
  };
}
