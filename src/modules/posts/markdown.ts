import { marked } from "marked";

/**
 * Markdown → HTML for post content, plus a repair for content that was already
 * converted before the masking existed.
 *
 * `marked` reads `_` as emphasis, so a formula like `C_{setup} + x_{i}` has its
 * underscores paired into `<em>…</em>` and the math is permanently corrupted.
 * Math regions are therefore masked with alphanumeric placeholders before
 * parsing and restored, byte-identical, afterwards.
 *
 * Code is masked before math because `$` is a variable sigil in PHP, Bash, Perl
 * and Make — a `$` inside a code block is never math. Code masking is only a
 * scratch pass: the code regions are put back *before* `marked` runs so that
 * fenced blocks still render as real `<pre><code>` elements. Math placeholders
 * are the only ones that have to survive the parse.
 */

const CODE_PLACEHOLDER_BASE = "CODEPLACEHOLDERx";
const MATH_PLACEHOLDER_BASE = "MATHPLACEHOLDERx";

const FENCED_CODE = /(`{3,})[\s\S]*?\1/g;
const INLINE_CODE = /(`+)[^\n]*?\1/g;

const BLOCK_MATH = /\$\$[\s\S]+?\$\$/g;
const INLINE_MATH = /(^|[^$])(\$[^$\n]+?\$)(?!\$)/g;

/**
 * Pick a placeholder prefix that does not already occur in the source, so a
 * document literally containing `MATHPLACEHOLDERx0` cannot be corrupted.
 * Only `[A-Za-z0-9]` is used, so Markdown has nothing to grab onto.
 */
function uniquePrefix(source: string, base: string): string {
  let prefix = base;
  while (source.includes(prefix)) {
    prefix = `${prefix}z`;
  }
  return prefix;
}

interface MaskResult {
  masked: string;
  stored: string[];
}

function mask(source: string, pattern: RegExp, prefix: string, stored: string[]): string {
  return source.replace(pattern, (match) => {
    const index = stored.length;
    stored.push(match);
    return `${prefix}${index}`;
  });
}

function maskInlineMath(source: string, prefix: string, stored: string[]): string {
  return source.replace(INLINE_MATH, (_match, lead: string, formula: string) => {
    const index = stored.length;
    stored.push(formula);
    return `${lead}${prefix}${index}`;
  });
}

function restore(source: string, prefix: string, stored: string[]): string {
  let result = source;
  // Restore highest index first: `${prefix}1` is a prefix of `${prefix}10`.
  for (let index = stored.length - 1; index >= 0; index--) {
    result = result.split(`${prefix}${index}`).join(stored[index] as string);
  }
  return result;
}

function maskCode(source: string, prefix: string): MaskResult {
  const stored: string[] = [];
  let masked = mask(source, FENCED_CODE, prefix, stored);
  masked = mask(masked, INLINE_CODE, prefix, stored);
  return { masked, stored };
}

function maskMath(source: string, prefix: string): MaskResult {
  const stored: string[] = [];
  let masked = mask(source, BLOCK_MATH, prefix, stored);
  masked = maskInlineMath(masked, prefix, stored);
  return { masked, stored };
}

/**
 * Convert Markdown to HTML without letting Markdown emphasis destroy LaTeX.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const codePrefix = uniquePrefix(markdown, CODE_PLACEHOLDER_BASE);
  const mathPrefix = uniquePrefix(markdown, MATH_PLACEHOLDER_BASE);

  // 1. Hide code so its `$` sigils are never mistaken for math delimiters.
  const code = maskCode(markdown, codePrefix);

  // 2. Hide math so `marked` cannot pair its underscores into emphasis.
  const math = maskMath(code.masked, mathPrefix);

  // 3. Put code back: `marked` renders fenced blocks correctly on its own and
  //    never emphasises inside them, so it only ever needed the math hidden.
  const parseable = restore(math.masked, codePrefix, code.stored);

  const html = await marked.parse(parseable, { async: true });

  // 4. Restore the math exactly as it was written.
  return restore(html, mathPrefix, math.stored);
}

const MATH_TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function repairRegion(region: string): string {
  return region.replace(/<\/?em>/g, "_").replace(/<\/?strong>/g, "__");
}

/**
 * Undo Markdown emphasis that was applied inside math regions before the
 * masking fix existed. Operates only within `$$…$$` / `$…$` spans, so ordinary
 * emphasis elsewhere in the document is untouched.
 *
 * `<em>` and `</em>` each become a single `_`, `<strong>` and `</strong>` each
 * become `__` — the exact inverse of what `marked` did. Any other tag is left
 * alone; see `findUnknownMathTags`.
 */
export function repairMathEmphasis(html: string): string {
  if (!html.includes("$")) return html;

  const blockRepaired = html.replace(BLOCK_MATH, (match) => repairRegion(match));

  return blockRepaired.replace(
    INLINE_MATH,
    (_match, lead: string, formula: string) => `${lead}${repairRegion(formula)}`,
  );
}

/**
 * Tags found inside a math region that `repairMathEmphasis` does not know how
 * to invert. Callers should report these rather than guess at a repair.
 */
export function findUnknownMathTags(html: string): string[] {
  if (!html.includes("$")) return [];

  const found = new Set<string>();

  const collect = (region: string): void => {
    for (const match of region.matchAll(MATH_TAG)) {
      const tag = (match[1] as string).toLowerCase();
      if (tag !== "em" && tag !== "strong") found.add(tag);
    }
  };

  for (const match of html.matchAll(BLOCK_MATH)) collect(match[0]);
  for (const match of html.replace(BLOCK_MATH, "").matchAll(INLINE_MATH)) {
    collect(match[2] as string);
  }

  return [...found];
}
