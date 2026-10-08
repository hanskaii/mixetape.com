import { defineCollection } from "astro:content";
// `z` re-exported from `astro:content` is deprecated; import it from
// `astro/zod` (the pattern nimbus-docs' own schema helpers document).
import { z } from "astro/zod";
import {
  apiCollection,
  docsCollection,
  partialsCollection,
} from "@cloudflare/nimbus-docs/content";

export const collections = {
  docs: defineCollection(
    docsCollection({
      schemaFields: {
        // Nimbus docs are agent-friendly by default. Set `audience: human`
        // to flag a page that's written primarily for human readers.
        audience: z.literal("human").optional(),
        // The title search results show, when the page's own title (its H1) is a word that
        // only makes sense in the sidebar ("Codex", "YouTube").
        seoTitle: z.string().optional(),
      },
    }),
  ),
  partials: defineCollection(partialsCollection()),
  api: defineCollection(apiCollection()),
};
