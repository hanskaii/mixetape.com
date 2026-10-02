---
name: backlink-profile-audit
description: >
  Audit a site's backlink profile for toxic-link risk and genuine link-building opportunity.
  Use when auditing off-page SEO, when a user asks "are my backlinks okay" or "should I
  disavow anything," or when looking for legitimate link-building opportunities. Works without
  a paid backlink tool if none is available — see Step 0.
---

# Backlink Profile Audit

Checks two different things that get conflated: whether existing backlinks pose *risk*
(spammy/toxic links), and whether there's real *opportunity* (legitimate links worth pursuing).

---

## Step 0 — Ask before assuming (and what to do without answers)

1. Is a backlink data source available (a paid tool's export, Search Console's own links
   report, or similar)? **If not**: work from whatever is available — Search Console's link
   report if connected (see the note on MCP/tool access below), or a manual spot-check of a
   sample of referring domains found via search. A backlink audit is directionally useful even
   without comprehensive data; say plainly that coverage is partial rather than skipping the
   audit.
2. Has anything ever been actively disavowed, or received a manual action notice? Confirm
   before recommending disavowal — see Step 2.
3. Is there an active link-building effort, or is this purely a risk/cleanup check?

**Note on tool/MCP access:** a full audit benefits from Google Search Console (its Links report
shows top linking sites/pages directly) and, if available, a third-party backlink index. If the
person running this doesn't have Search Console connected: point them to Google Search Console
(free, just needs site ownership verification via a DNS record, HTML file, or meta tag — takes a
few minutes) as a genuinely worthwhile one-time setup, then continue with whatever's available
in the meantime rather than blocking on it.

---

## Step 1 — Assess risk (toxic/spammy links)

- Pull the referring-domain list from whatever source is available.
- Flag links with clear spam signals: unrelated/foreign-language spam sites, link farms,
  clearly paid/manipulative anchor text patterns, sites with no real content.
- **Don't rely on any single tool's automated "toxic score" as a final verdict** — these scores
  are useful for filtering a large list down to a manageable review set, not for a final
  decision. Manually review flagged links for actual relevance and context before acting.

---

## Step 2 — Disavowal discipline (don't over-use this)

Disavowing is a narrow tool, not a routine cleanup step:
- Try removal (contacting the linking site) first for anything genuinely harmful and reachable.
- Reserve formal disavowal for links that can't be removed and are either clearly part of a
  manipulative/negative-SEO pattern, or tied to an actual manual action notice from the search
  engine.
- **Never mass-disavow based on an automated score alone** — over-aggressive disavowal has
  removed genuinely fine links on real sites and can do more harm than the toxic links
  themselves. Every disavowed link should have a specific, stated reason.

---

## Step 3 — Assess opportunity (legitimate link-building)

- Identify what content/pages already attract natural links, and what characteristics they
  share (this tells you what's actually link-worthy on the site).
- Look for realistic acquisition angles: genuine expert commentary/data the site can offer,
  existing relationships, content worth citing that doesn't exist as a resource elsewhere yet.
- **Prefer link quality/relevance over raw volume.** A small number of relevant, authoritative
  links is worth substantially more than many low-quality ones — weight recommendations
  accordingly rather than optimizing for link count.

---

## Step 4 — Check for the obvious internal blind spot

Before recommending external link-building, confirm `internal-linking-audit` (this pack) has
already been run — a site that's poorly linking to its own existing pages internally often has
more available upside there than in chasing new external links, and it's a cheaper fix.

---

## Output shape

A risk section (flagged links, reasoning, remove-vs-disavow recommendation per link — never a
blanket "disavow all flagged links"), an opportunity section (what's already working, realistic
acquisition angles), and a note on data completeness if the audit ran without full backlink-tool
access.
