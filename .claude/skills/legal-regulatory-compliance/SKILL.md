---
name: legal-regulatory-compliance
description: >
  Audit a site for regulatory/legal exposure — practicing-without-a-license risk on
  professional-advice content, affiliate disclosure compliance, and privacy-law basics. Use
  when auditing any site that gives advice in a licensed-profession domain (financial, legal,
  medical, tax) or uses affiliate links. Distinct from page-quality-audit (this pack), which
  covers honesty/trust signals — this skill covers actual regulatory exposure.
---

# Legal & Regulatory Compliance Audit

Checks whether content crosses into regulated territory it isn't licensed for, and whether
paid/affiliate relationships are disclosed the way the law actually requires — not just the
way that feels reasonable.

---

## Step 0 — Ask before assuming

1. Does the content give advice in any professionally-licensed domain (financial, legal,
   medical, tax, engineering, etc.)? If not, most of this skill doesn't apply — confirm before
   running the full checklist.
2. Are there affiliate links, sponsorships, free products received, or any other material
   connection to something being recommended?
3. Is user data collected (forms, accounts, analytics, cookies)? Determines whether
   privacy-law checks are relevant.
4. What jurisdiction(s) does the audience/business operate in? Regulatory requirements are
   jurisdiction-specific — confirm which ones actually apply before checking against a specific
   country's rules.

**If jurisdiction is unknown:** default to checking against the most commonly-cited baseline
(US FTC-style disclosure rules, WCAG-based accessibility expectations) as a working assumption,
run the checks on that basis, and explicitly note that jurisdiction-specific confirmation is
still recommended before treating the findings as final.

---

## Step 1 — Practicing-without-a-license risk

If content touches a licensed-profession domain, check that it stays on the *educational/
general-information* side of the line, not the *personalized professional advice* or
*representation* side. Concretely:
- No implication of preparing filings, representing someone before an authority, or giving
  advice tied to a specific individual's exact situation, unless the site is actually operated
  by licensed professionals in that capacity.
- No fee charged specifically for individualized advice unless properly licensed to do so.
- A clear disclaimer stating the content is general/educational, not professional advice for
  the reader's specific situation, and naming what the operators are *not* (e.g. not a law
  firm, not a CPA firm) if that could otherwise be assumed.

**Verify the specific regulatory framework for the relevant profession and jurisdiction before
writing disclaimer language** — the exact rule (e.g. which body regulates the practice, what
counts as "representation") varies by domain and by country/state, and changes over time.

---

## Step 2 — Affiliate/sponsorship disclosure

Check, for every affiliate link or sponsored placement:
- **The disclosure is at the point of the link/recommendation itself**, not only in a footer or
  a separate disclosure page — a reader needs to see it before engaging with the link, not
  after.
- **Clear, plain language** a typical reader would understand — not legal jargon, not buried in
  small print, not relying on an icon/abbreviation alone.
- **Every material connection is covered**, not just direct payment — free products, discounts,
  exclusive access, and affiliate commissions all count.
- Any customer review or testimonial content is genuine, not fabricated or manipulated —
  regulators have specifically targeted fake/incentivized reviews as their own violation
  category, separate from affiliate-disclosure rules.

**Do not hardcode a specific penalty dollar figure into audit output or client-facing
material** — the relevant maximum civil penalty is set by regulation and adjusts periodically;
different sources checked even close together in time can show different current figures.
State that penalties are real and material, verify the current maximum from the regulator's own
site if a specific number is needed, and don't rely on a cached figure.

---

## Step 3 — Privacy/data-collection basics

If any user data is collected: check for a visible privacy policy describing what's collected
and why, a cookie/tracking disclosure if applicable, and that the stated practices actually
match what the site's own code does (a policy promising something the implementation doesn't
do is its own compliance risk, not just a documentation gap).

---

## Step 4 — Accessibility (a real, rising legal-risk category, not just a UX nicety)

Web accessibility lawsuits are common and increasing, regardless of whether a specific formal
regulation applies to this site's size/type. Courts commonly use **WCAG 2.1 Level AA** (with
2.2 AA increasingly referenced) as the practical yardstick when evaluating a claim, even for
businesses with no explicit deadline of their own. Check for the basics that drive most real
claims: images missing alt text, insufficient color contrast, forms/interactive elements not
usable via keyboard alone, and video/audio content with no captions or transcript. Confirm the
current specific standard and any applicable deadlines for the site's actual jurisdiction and
entity type before finalizing findings — formal requirements and deadlines for different entity
types have shifted before and can shift again.

---

## Output shape

Per area checked (licensed-advice boundary, affiliate disclosure, privacy, accessibility):
compliant / at-risk findings with specifics, and — for anything genuinely legal-risk-bearing
rather than a content quality issue — an explicit recommendation to have a qualified
professional review before publishing, not a confident final answer from this audit alone.
