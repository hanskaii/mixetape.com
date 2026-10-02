import { createFileRoute } from "@tanstack/react-router";
import { siteConfig } from "#/config/site";

// GET /llms.txt — where an agent finds what mixetape is and how to use it: the docs (which
// keep their own llms.txt), the MCP server and the machine-readable API descriptions.
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () => {
        const text = `# ${siteConfig.name}

> ${siteConfig.description}

An agent schedules a post with a media file, a caption and a time; mixetape holds it, editable
and cancellable, publishes it to the connected channel on time and reports back.

## Use it

- [MCP server](${siteConfig.url}/mcp): Streamable HTTP, authenticated with an API key (Authorization: Bearer mxt_…)
- [MCP tools](${siteConfig.url}/mcp/tools.json): every tool with its permission and input schema
- [REST API (OpenAPI 3.1)](${siteConfig.url}/api/v1/openapi.json): base URL ${siteConfig.url}/api/v1
- [API keys](${siteConfig.url}/api-keys): created by the account owner in the workspace

## Docs

- [Documentation index](${siteConfig.docsUrl}/llms.txt)
- [Full documentation](${siteConfig.docsUrl}/llms-full.txt)
- [Connect an agent](${siteConfig.docsUrl}/connect-an-agent/mcp/)
- [REST API overview](${siteConfig.docsUrl}/rest-api/)

## Policies

- [Pricing](${siteConfig.url}/pricing)
- [Privacy Policy](${siteConfig.url}/privacy)
- [Terms of Service](${siteConfig.url}/terms)
`;
        return new Response(text, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
