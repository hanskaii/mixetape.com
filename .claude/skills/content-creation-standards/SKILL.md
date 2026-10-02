---
name: content-creation-standards
description: >
  Apply this pack's standards *while creating* new content, not just when auditing existing
  content. Use whenever a user is about to publish a new page, expand a site with new content,
  or asks "how do I make sure this new page is done right." This is the creation-time
  counterpart to the audit skills in this pack — the goal is for new pages to pass every other
  skill's bar on day one, instead of needing a later audit to catch problems.
---

# Content Creation Standards

A pre-publish checklist that pulls together this pack's other skills, applied at the moment of
creating something new rather than after the fact. Catching an issue before publishing is
always cheaper than finding it in a later audit.

---

## Step 0 — Ask before assuming

1. What kind of page is this (a data-driven tool, a comparison, a long-form guide, a hub page)?
   Different types have different bars for some of the checks below.
2. Does this fit an existing template/pattern on the site, or is it a genuinely new format?
3. Is this part of a batch (many similar pages at once), or a one-off? A batch multiplies any
   mistake made once across every page in it — worth extra care before the first one ships.
4. Per `seo-growth-stage-strategy` (this pack): is this site still in a coverage-building stage
   (where shipping more matters more) or a mature stage (where getting each page fully right
   matters more)? Calibrate how much scrutiny to apply before publishing accordingly.

**If none of the above is answered:** run the full checklist below regardless — creation-time
diligence is the one place where "unknown context" should default to *more* scrutiny, not less,
since it's cheaper to fully check a page once before it ships than to find a problem after.

---

## Step 1 — Before writing: confirm it's not a duplicate

Run the equivalent of `duplicate-intent-audit` (this pack) *before* creating the page: does
this exact entity+content-type combination already exist under any naming convention? For
comparison-style content, does the reversed pair already exist? Rejecting a duplicate before
it's built is far cheaper than merging it later.

---

## Step 2 — While writing: factual and structural checklist

- **Accuracy**: every checkable claim traced to its authoritative source before publishing
  (`verify-primary-source`, this pack) — not written from assumption.
- **Non-commodity value**: at least one thing a reader can't get by going straight to the raw
  source data (`page-quality-audit`, this pack) — a worked example, an insight, a genuine
  analysis, not just a restated table.
- **Honest attribution**: no fabricated expert byline; honest disclosure if AI assisted in
  production (`page-quality-audit`, this pack).
- **Hedged, not overclaimed**: any projected/estimated figure states its assumptions plainly
  (`page-quality-audit`, this pack).
- **Regulatory/legal check**: if the content touches a licensed-advice domain or includes
  affiliate links, the disclosure and disclaimer requirements are met *from the first
  publish*, not retrofitted later (`legal-regulatory-compliance`, this pack).

---

## Step 3 — Before publishing: technical and structural checklist

- Title and meta description are unique, within current truncation limits, and the title/meta
  make a claim that the page body actually supports (`technical-seo-audit` + `protected-field-
  audit`, this pack) — checking this *before* publish avoids ever creating the "title says one
  thing, body says another" problem `protected-field-audit` exists to catch after the fact.
- Structured data, if used, matches a currently-supported type and matches what's actually
  visible on the page (`technical-seo-audit`, this pack).
- Heading hierarchy is correct and uses semantic variants, not repeated keyword stuffing
  (`technical-seo-audit`, this pack).

---

## Step 4 — At publish time: linking, both directions

- **Outbound**: this new page links out to the other pages it should, from genuine body
  content with descriptive anchor text, not just a footer list.
- **Inbound**: identify every *existing* page that should now link to this new one, and add
  those links as part of publishing it — not as a separate task to remember later
  (`internal-linking-audit`, this pack, covers the fuller audit version of this; at
  creation-time, do the version scoped to just this one new page).

---

## Output shape

A pass/fail checklist against Steps 1–4 for the specific page (or, if a batch, a note on
whether every item in the batch was checked or just a sample), with any failed item flagged as
a blocker before publishing, not a "fix later" note.
