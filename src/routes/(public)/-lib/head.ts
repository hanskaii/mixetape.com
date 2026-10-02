import { siteConfig } from "#/config/site";

/**
 * The head of a public page: its title and description, repeated for share cards, and the
 * canonical URL. Every public page goes through this so none ships without them.
 */
export function publicHead({
  path,
  title,
  description,
}: {
  /** The page's path, e.g. "/privacy"; the landing page is "/". */
  path: string;
  title: string;
  description: string;
}) {
  const url = `${siteConfig.url}${path}`;
  const image = `${siteConfig.url}${siteConfig.ogImage}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: siteConfig.name },
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
