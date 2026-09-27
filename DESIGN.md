# mixetape design system

## Direction

**A publishing desk with a pulse.** mixetape should feel like a small, capable studio for scheduling video: warm paper around a focused dark work surface, clear ink typography, and a single yellow signal that points to the next action. The visual reference is the supplied Null Motion landing page; its layout language is adapted to mixetape's real publishing workflow and platform support.

The interface has two modes of density. The public page is spacious and editorial. The signed-in workspace is compact, scannable, and built for repeated use. Both share the same colors, type, borders, and control shapes.

## Product truth

- mixetape currently schedules and publishes to YouTube through the user's own OAuth credentials.
- People can provide a video URL or upload a file, choose metadata and visibility, then post now or schedule a time.
- Scheduled work shows upcoming and historical status, with retry and cancel actions where available.
- API keys allow scripts to schedule through the same service.
- mixetape is agent-first: MCP and the REST API are primary interfaces, and the workspace supervises the same queue (see PRODUCT.md).
- The roadmap platforms (X, Instagram, LinkedIn, Facebook, TikTok, Bluesky, Threads, Pinterest, Google Business) may appear only with a clear "Soon" label, never as supported destinations. Their logos live in `public/icons/platforms/` and sit on a small white tile so dark marks stay legible in both themes.

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas `--background` | `#f7f5f0` | `#141413` | Page background |
| Ink `--foreground` | `#0b0b0b` | `#f6f4ee` | Primary text |
| Paper `--card` | `#fffefa` | `#20201e` | Cards and panels |
| Muted `--muted` | `#f1eee7` | `#2d2c28` | Quiet controls and grouped rows |
| Secondary text `--muted-foreground` | `#656159` | `#aaa69d` | Supporting copy |
| Rule `--border` | `#e4e0d7` | `#3b3933` | Hairline divisions |
| Signal `--primary` | `#ffd21f` | `#ffd21f` | Primary actions and active states |
| Signal ink `--primary-foreground` | `#0b0b0b` | `#0b0b0b` | Text on yellow |
| Warm emphasis `--editorial` | `#9a6300` | `#f1b94b` | Serif emphasis and small highlights |
| Danger `--destructive` | `#b93f34` | `#f28b7b` | Errors and destructive actions |

Yellow is a functional signal. Keep most surfaces neutral so scheduled status, active navigation, and primary actions remain unmistakable. Platform red belongs only to the YouTube mark or platform-specific content.

## Typography

- **Figtree** for interface text. Body copy is 15–16px with comfortable line height. Labels are 13–14px, never so small that essential settings are hard to scan.
- **Instrument Serif** for short, italic editorial emphasis in public display headings. It is an accent, not a body font.
- **Geist Mono** for dates, times, API keys, URLs, and technical snippets.
- Public hero: `clamp(3.5rem, 7vw, 6rem)`, medium weight, tight tracking, approximately 0.98 line height.
- Workspace heading: 32–40px, medium weight. Section heading: 20–24px, semibold.
- Eyebrows: 11–12px mono, uppercase, letter spacing around 0.16em.

## Composition

- Public content uses a centered 1120px canvas. The hero has an asymmetric text/visual split, a generous top margin, and a strong dark publishing preview.
- Signed-in pages use a centered content region up to 1040px. Group forms and lists in paper panels with room around them.
- The header floats within the page canvas, with a translucent paper surface, 20px corners, thin border, and restrained blur.
- Use a 4px spacing grid. Common gaps: 8, 12, 16, 24, 32, 48, and 80px.
- Cards use 18–22px corners and 1px warm borders. Buttons and fields use 10–12px corners. Small status badges may remain pills.
- The dark preview is a single high-contrast feature. Use its warm glow sparingly and keep application panels mostly flat.

## Components and states

- **Primary button:** yellow fill, near-black text, slight inset edge; clear hover and focus states. Secondary button: paper fill and visible warm border. Icon buttons have at least 36px hit areas.
- **Fields:** paper or subtle muted fill, 1px border, 12px corners, yellow-tinted focus ring. Labels remain visible for important forms; placeholder copy is supplementary.
- **Tabs:** active item uses the signal color, inactive items use quiet ink. Keep visible focus indicators.
- **Cards and lists:** paper background, warm border, 20px corners; separate list rows with hairline rules. Avoid heavy repeated shadows.
- **Status:** use text and icon or shape with color. Do not rely on color alone. Scheduled, uploaded, failed, and published should remain distinguishable.
- **Dialogs:** match paper panels and maintain clear overlay contrast in both themes.
- **Motion:** short 150–250ms transitions for focus, hover, and entering sections. Respect `prefers-reduced-motion`.

## Responsive behavior

- On narrow screens, stack the hero and publishing preview, use full-width CTAs, and allow navigation to wrap or scroll without clipping.
- Work forms collapse to one column. Status rows wrap while preserving action labels and tap targets.
- Keep page gutters at least 16px on mobile and 24px on desktop.

## Implementation

- Shared controls in `src/components/ui` use Base UI and StyleX. Their colors read the CSS custom properties in `src/styles.css` through `tokens.stylex.ts`.
- Page composition may use Tailwind utilities. New visual motifs should use the shared tokens instead of scattering hard-coded colors.
- Preserve dark mode via the existing `.dark` class and the current theme toggle.
- Avoid decorative claims, prices, videos, or platform logos that do not reflect features available in this repository.
