import { describe, it, expect } from "vitest";
import { marked } from "marked";
import { markdownToHtml, repairMathEmphasis, findUnknownMathTags } from "./markdown";

// The formula from the bug report, verbatim.
const REPORTED_FORMULA =
  "$$\\text{TCO}_{\\text{buy}}(t) = C_{\\text{setup}} + \\int_{0}^{t} \\left( C_{\\text{license}}(\\tau) + C_{\\text{integration}}(\\tau) + C_{\\text{vendor_risk}}(\\tau) \\right) d\\tau$$";

describe("markdownToHtml", () => {
  it("case 1: does not mangle the reported LaTeX formula", async () => {
    const html = await markdownToHtml(REPORTED_FORMULA);

    expect(html).not.toContain("<em>");
    expect(html).not.toContain("</em>");
    expect(html).toContain("C_{\\text{setup}}");
    expect(html).toContain("\\int_{0}^{t}");
    expect(html).toContain("C_{\\text{vendor_risk}}");
  });

  it("case 2: keeps two inline formulas separate and intact", async () => {
    const html = await markdownToHtml("The value $x_i$ and $y_j$ are related.");

    expect(html).not.toContain("<em>");
    expect(html).toContain("$x_i$");
    expect(html).toContain("$y_j$");
    // Not merged into a single span.
    expect(html).toContain("$x_i$ and $y_j$");
  });

  it("case 3: ordinary Markdown emphasis still works", async () => {
    const html = await markdownToHtml("some _emphasised_ text");

    expect(html).toContain("<em>emphasised</em>");
  });

  it("case 4: emphasis and math in the same paragraph", async () => {
    const html = await markdownToHtml("this is _real emphasis_ next to $a_1$ math");

    expect(html.match(/<em>/g)).toHaveLength(1);
    expect(html.match(/<\/em>/g)).toHaveLength(1);
    expect(html).toContain("<em>real emphasis</em>");
    expect(html).toContain("$a_1$");
  });

  it("case 5: `$` inside a fenced code block is not treated as math", async () => {
    const html = await markdownToHtml("```bash\necho $HOME and $USER\n```");

    expect(html).toContain("<pre>");
    expect(html).toContain("$HOME");
    expect(html).toContain("$USER");
    expect(html).not.toContain("katex");
  });

  it("case 6: underscores inside a fenced code block are not emphasised", async () => {
    const html = await markdownToHtml(
      "```js\nconst my_var_name = 1;\nconst other_var_here = 2;\n```",
    );

    expect(html).toContain("<pre>");
    expect(html).not.toContain("<em>");
    expect(html).toContain("my_var_name");
    expect(html).toContain("other_var_here");
  });

  it("case 7: inline code keeps its underscores", async () => {
    const html = await markdownToHtml("use `a_b_c` here");

    expect(html).not.toContain("<em>");
    expect(html).toContain("<code>a_b_c</code>");
  });

  it("case 8: markdown with no math matches plain marked output", async () => {
    const source = [
      "# Heading",
      "",
      "- one",
      "- two",
      "",
      "A [link](https://example.com) and **bold** text.",
      "",
    ].join("\n");

    const html = await markdownToHtml(source);

    expect(html).toBe(await marked.parse(source, { async: true }));
    expect(html).toContain("<h1>");
    expect(html).toContain("<li>");
    expect(html).toContain('href="https://example.com"');
  });

  it("case 9: literal placeholder text in the source is not corrupted", async () => {
    const source = "MATHPLACEHOLDERx0 appears literally next to $b_2$ math";

    const html = await markdownToHtml(source);

    expect(html).toContain("MATHPLACEHOLDERx0");
    expect(html).toContain("$b_2$");
    expect(html).not.toContain("<em>");
  });
});

describe("repairMathEmphasis", () => {
  const CORRUPTED = "$$\\text{TCO}<em>{\\text{buy}}(t) = C</em>{\\text{setup}}$$";
  const REPAIRED = "$$\\text{TCO}_{\\text{buy}}(t) = C_{\\text{setup}}$$";

  it("case 10: restores underscores eaten inside a math region", () => {
    expect(repairMathEmphasis(CORRUPTED)).toBe(REPAIRED);
  });

  it("case 11: preserves emphasis outside any math region", () => {
    const input = `<p><em>hello</em></p>\n<p>${CORRUPTED}</p>`;

    expect(repairMathEmphasis(input)).toBe(`<p><em>hello</em></p>\n<p>${REPAIRED}</p>`);
  });

  it("case 12: returns a document with no math unchanged", () => {
    const input = "<p>plain <em>emphasis</em> and <strong>bold</strong></p>";

    expect(repairMathEmphasis(input)).toBe(input);
  });

  it("case 13: is idempotent", () => {
    const once = repairMathEmphasis(CORRUPTED);

    expect(repairMathEmphasis(once)).toBe(once);
  });

  it("reports tags it cannot invert instead of guessing", () => {
    expect(findUnknownMathTags(REPAIRED)).toEqual([]);
    expect(findUnknownMathTags("$$a<code>b</code>c$$")).toEqual(["code"]);
  });
});
