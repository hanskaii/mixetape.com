---
name: content-freshness-audit
description: >
  Audit whether a site has a real mechanism for knowing which published facts are due for
  re-checking, or whether "keep it current" is just an unenforced hope. Use when auditing a
  content-heavy or programmatic-SEO site, when a user asks "how do I know what's gone stale
  on my site," or when reviewing whether a freshness/review process holds up under scale.
  Builds on verify-primary-source (this pack) — that skill checks one fact right now; this
  skill checks whether any fact will ever get re-checked again without someone manually
  remembering to do it.
---

# Content Freshness Audit

Checks whether a site has a structured mechanism for knowing what's stale, and helps build one
where none exists.

---

## Step 0 — Ask before assuming

1. What actually changes on this site, and how often? Freshness risk isn't uniform — timeless
   content, annually-changing content, and constantly-changing content all need different
   treatment.
2. Is there any existing record of *when* something was last checked?
3. Is there a review cadence, and is it tied to *why* something might change (a known external
   trigger), or is it a generic "review everything every N months" template?
4. How many pages exist, and how much does their value/traffic vary? High-value pages usually
   deserve tighter cadences than long-tail ones.
5. Can the site currently tell confirmed-current facts apart from best-guess ones?

**If there's no answer available:** default to assuming no freshness-tracking mechanism exists
yet (the common case for sites that haven't been asked this before) and proceed straight to
Steps 1–2, sampling visible dates/fields directly rather than waiting for a description of the
process.

---

## Step 1 — Check for the false-uniformity anti-pattern

Watch for one identical review value applied across many entries that shouldn't share it (e.g.
every entry in a large, genuinely heterogeneous set showing the same "next review" date or
"verified" flag). Identical values across many distinct entries is a strong signal of an
unverified template, not real per-entry research — flag it before even checking whether the
values themselves are right.

---

## Step 2 — Check whether a "verified" field has stopped discriminating

If a quality/verified field exists, sample its actual value distribution. If it's uniform for a
large, heterogeneous set of entries, the field has likely stopped being maintained meaningfully.
Fix: don't overload one field for two different kinds of verification (e.g. "is the fact
verified" is different from "is the schedule around it verified") — track them separately.

---

## Step 3 — Confirm the anti-hallucination discipline

Any freshness/schedule claim needs a real source or historical pattern behind it:
- Real published schedule exists → cite it, mark **confirmed**.
- No fixed schedule exists → say so explicitly, mark **estimated**, with a one-line basis.
- Never present an estimate as confirmed. A site that can't tell which "next review" dates are
  real vs. guessed has the same problem as one with no review dates at all.

---

## Step 4 — Tier check frequency by value/risk, not uniformly

Checking everything on the same schedule under-checks what matters and wastes effort on what
doesn't. Recommend tiering: high-value/high-risk content checked most frequently, mid-tier on a
longer real cadence, long-tail rarely or only reactively. Confirm with the site owner what
actually correlates with "this page matters more" for their specific site.

---

## Step 5 — Check that structured and human-readable records can't drift apart

If freshness data exists in more than one place (a structured file and a human-readable
doc/table), check whether the human-readable version is generated from the structured source or
hand-maintained in parallel. Parallel hand-maintained copies drift apart by default. Fix:
generate the human-readable version from the structured source.

---

## Output shape

Per content type: whether any freshness mechanism exists and what it captures; any
false-uniformity instances found; whether a verified field has stopped discriminating; whether
freshness claims are sourced or unearned; whether check frequency is tiered; whether records can
drift apart.
