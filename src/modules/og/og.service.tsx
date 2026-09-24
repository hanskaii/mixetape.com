import type { ReactNode } from "react";
import { siteConfig } from "#/config/site";

export interface OGCardProps {
  title: string;
  subtitle?: string;
  author: string;
  tags?: string[];
  date?: string;
}

export function renderDefaultOG({
  title,
  subtitle,
  author,
  tags = [],
  date,
}: OGCardProps): ReactNode {
  const displayTags = tags.length > 0 ? tags.slice(0, 3) : ["Article"];
  const displayAuthor = author || siteConfig.author.name;
  const siteDomain = siteConfig.url.replace(/^https?:\/\//, "");

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#09090b",
        padding: "64px 76px",
        fontFamily: "sans-serif",
        position: "relative",
        border: "1px solid #27272a",
      }}
    >
      {/* Top Header: Tag Pill + Site Branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          {displayTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#e4e4e7",
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                padding: "6px 16px",
                borderRadius: "8px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <span
          style={{
            fontSize: "17px",
            fontWeight: 600,
            color: "#71717a",
            letterSpacing: "-0.2px",
          }}
        >
          {siteDomain || siteConfig.name}
        </span>
      </div>

      {/* Main Content: Title & Subtitle */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h1
          style={{
            fontSize: title.length > 50 ? "46px" : "58px",
            fontWeight: 800,
            color: "#fafafa",
            lineHeight: 1.15,
            margin: 0,
            letterSpacing: "-1.5px",
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              fontSize: "22px",
              color: "#a1a1aa",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* Footer: Author & Date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid #27272a",
          paddingTop: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "9999px",
              backgroundColor: "#27272a",
              border: "1px solid #3f3f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "17px",
              fontWeight: 700,
              color: "#fafafa",
            }}
          >
            {displayAuthor.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#f4f4f5" }}>
            {displayAuthor}
          </span>
        </div>
        {date ? (
          <span style={{ fontSize: "16px", color: "#71717a", fontWeight: 500 }}>{date}</span>
        ) : null}
      </div>
    </div>
  );
}

// ponytail: Single clean default template; templateId param kept for caller compatibility
export function renderOGTemplate(_templateId?: string, params?: OGCardProps): ReactNode {
  return renderDefaultOG(
    params || { title: siteConfig.title, author: siteConfig.author.name, tags: [] },
  );
}
