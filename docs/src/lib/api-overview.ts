import spec from "../api/openapi.json";

/**
 * The API reference's overview, from the OpenAPI document. The site builds no tag pages
 * (/api/tags/*): a tag is a group of operations, listed on the overview and in the
 * sidebar. These helpers give the overview its facts and keep the text outputs
 * (Markdown, llms.txt) free of links to pages that do not exist.
 */

type Operation = { operationId: string; summary?: string; tags?: string[] };

export const baseUrl = spec.servers[0]?.url ?? "";

/** The permission groups, with what each allows (the tags' descriptions). */
export const permissions = spec.tags
  .filter((tag) => tag.name !== "Accounts and posts")
  .map((tag) => ({ name: tag.name, description: tag.description }));

/** Every group's operations, in the document's order, with their reference URLs. */
export function groups() {
  const operations = Object.values(spec.paths).flatMap((methods) =>
    Object.values(methods as Record<string, unknown>).filter(
      (value): value is Operation =>
        typeof value === "object" && value !== null && "operationId" in value,
    ),
  );
  return spec.tags.map((tag) => ({
    name: tag.name,
    operations: operations
      .filter((operation) => operation.tags?.[0] === tag.name)
      .map((operation) => ({
        label: operation.summary ?? operation.operationId,
        href: `/api/${tag.name.replace(/\s+/g, "-")}/${operation.operationId}`,
      })),
  }));
}

/** The groups as Markdown, in place of the list of links to tag pages. */
export function groupsMarkdown() {
  return groups()
    .map(
      (group) =>
        `## ${group.name}\n\n${group.operations.map((op) => `- [${op.label}](${op.href})`).join("\n")}`,
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
