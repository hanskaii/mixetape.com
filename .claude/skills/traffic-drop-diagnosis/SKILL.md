---
name: traffic-drop-diagnosis
description: >
  Diagnose a fall in search traffic or clicks: is it real, how big, when exactly, broad or
  narrow, own-site or external cause, and whether to act, wait or investigate. Use when a user
  says "my traffic dropped," "did an update hit me," "is this a tracking issue," "why did clicks
  fall," or "what should I do right now." Not a routine monitoring setup (seo-health-monitoring),
  not a fix list, and not a migration plan; it ends in a diagnosis and a decision.
---

# Traffic Drop Diagnosis

Turns "traffic fell" into a ranked, evidence-backed diagnosis and an act / wait / investigate decision, before any page is edited. This is the full workflow behind the broad-vs-narrow fork in `seo-growth-stage-strategy` Step 3. Stage gate: apply that skill first; real emergencies (technical break, security issue, manual action) bypass it.

---

## Step 0 — Ask before assuming

1. **When did it start**; a one-day step or a slope over weeks?
2. **Which metric and source** — Search Console clicks, analytics sessions, Bing? Did clicks fall, or only impressions?
3. **How big**, versus which comparison period?
4. **What changed on the site** — deploys, redesign, migration, CMS or plugin updates, robots/noindex, redirects, bulk content, tracking or consent?
5. **Anything else** — an alert, a Search Console message, a rumored update, a server incident?

Search Console and Bing Webmaster Tools are free and need ownership verification. They are worth connecting, but never block on it: without them, work from analytics, server logs and live checks at reduced precision, and say so. If a search or analytics MCP or a CSV export is available, use it.

**If none of this can be answered:** pull whatever is observable (analytics, exports, live site, deploy history), date the drop from the daily series, and label every finding **inferred** or **confirmed**.

---

## Step 1 — Confirm it is real

- Read Search Console's **"Data anomalies"** page and the **Google Search Status Dashboard** live; both change. Note any entry overlapping the drop and which metrics it says were affected. Some logged errors affected impressions, CTR and average position while clicks were unaffected; others (for example Discover entries) affected clicks too. Read the entry; never assume.
- **Clicks are the most reliable metric.** Impressions, CTR and position are derived and move with SERP layout, reporting changes and query mix. Never conclude a ranking loss from impressions or position movement alone; impressions down with clicks steady is a reporting or layout signal until proven otherwise.
- Rule out measurement: tracking removed or broken, consent or tag changes, new filters, wrong property, new bot or internal traffic. Search Console clicks and analytics sessions measure different things and will not match; Search Console is the source for Google search performance, analytics for on-site behavior; compare each source's own trend (`measurement-discipline`).
- Rule out calendar effects: day-of-week, holidays, seasonality (compare year-over-year; Search Console history is limited, so check current retention and export what you need), and incomplete recent days (the newest data can be preliminary; drop it).
- Check for non-human traffic: a country or device cluster with very low engagement and about one page per session (a heuristic; re-verify).
- Chart and table totals can differ; compare like with like.
- Cross-check Bing: Google down while Bing holds points to a Google-specific cause.

**Decision rule:** analytics fell but Search Console clicks held means a measurement problem; fix tracking and stop. If nothing survives these checks, report "no real drop."

## Step 2 — Size and date it

Compare equal-length periods (same weekdays) against the prior period and year-over-year. Record onset to the day, size in clicks (absolute and %), and step vs slope. A step suggests a discrete event (deploy, update, outage, penalty); a slope suggests competition, demand or decay. Align onset with the deploy log.

## Step 3 — Broad or narrow

Broad: many unrelated pages and queries fell together. Narrow: one page, template or topic fell. Broad points to technical, update or demand causes; narrow to content, template or competitor causes. Do not edit pages in response to a broad event.

## Step 4 — Segment

Use pages present in both periods. Split by **page group or template** (sort by clicks difference; aggregate by URL pattern), **brand vs non-brand**, intent type (fact lookup vs tool or transactional), **device, country, search type, search appearance**, and **new vs established pages**.
- Concentration in one page family or query class is stronger evidence than a uniform drop. Check whether the footprint shrank (fewer pages earning impressions) or only per-page performance fell. Data follows Google's chosen canonical, so canonical or redirect changes move page-level data between URLs.
- View live results for the top losing queries: new competitors, AI answers or other SERP features that answer without a click (AI feature traffic counts in Search Console web totals). Classify each query first; SERP-feature ceilings are not fixable by rewrites.

## Step 5 — Own-site causes

Line the change log up against the onset. Check: deploys and template edits; migrations and redirects (`site-migration-safety`); robots.txt, noindex, canonicals, status codes, errors, speed and outages (`technical-seo-audit`, server logs, Crawl stats); index coverage (`indexing-crawl-health-audit`); internal-link or navigation changes; removed or consolidated content; content edits; same-intent overlap (`duplicate-intent-audit`); page quality (`page-quality-audit`). Verify live state; never trust a prior report's claim that something was fixed. If nothing changed in the window, say so.

## Step 6 — External causes

- **Update windows:** read Google's ranking-update list on the Status Dashboard live. A candidate must start on or before the onset; an update that began after the drop cannot explain it. Google advises waiting until a rollout completes, then comparing about a week afterwards with the week before it began.
- **Manual actions and Security issues** in Search Console: check both.
- **Demand and competitors:** check declining queries in Google Trends and against peers.
- **Link loss** (`backlink-profile-audit`) only if segmentation points at pages that depended on lost links.

## Step 7 — Decide: act, wait or investigate

- **Act now:** a confirmed technical fault (blocked, noindexed, erroring, broken redirects, broken tracking), a manual action, a security issue.
- **Wait:** during an active rollout; drops within normal range; small position moves of a few places.
- **Investigate further:** a concentrated segment with no explanation yet.
- Attribute to an update only with matching onset and a consistent pattern; otherwise record "unattributed."
- **Gate:** if a quality or spam cause is suspected, route to `page-quality-audit` and `duplicate-intent-audit`; make targeted, measured changes one at a time, per `seo-growth-stage-strategy`.

## Step 8 — What NOT to do

- Mass edits across many pages, or reverting good changes, in reaction to a broad drop.
- Disavowing links, deleting content or noindexing pages at scale without evidence tying them to the loss.
- Chasing impressions, CTR or position instead of clicks; rewriting titles for queries capped by SERP features.
- Bulk publishing, consolidating or mass redirecting during an active rollout; it muddies attribution.
- Stacking a second change on a page inside a measurement window.

## Step 9 — Recovery monitoring

Log the diagnosis and any change with a baseline (`change-and-decision-log`). Re-measure clicks weekly by the same segments, starting after any rollout ends. Some fixes show within days; quality-related recovery can take months and is not guaranteed (check Google's current guidance). Set a review date and escalation trigger. Hand ongoing tracking to `seo-health-monitoring`.

---

## Output shape

1. **Confirmed real:** yes/no, the checks that decided it, inferred vs confirmed.
2. **Onset date** and step vs slope.
3. **Size:** clicks, % and comparison basis.
4. **Broad or narrow**, with the segment that shows it.
5. **Ranked hypotheses:** evidence for and against each; what is ruled out.
6. **Recommended action or no-action**, and what not to touch.
7. **Monitor:** metrics, segments, cadence, duration, review date, escalation trigger.
