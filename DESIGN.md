---
name: kit
description: High-performance edge starter kit, blog, and portfolio for hanssn
colors:
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  destructive-foreground: "oklch(0.985 0 0)"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Geist Mono Variable, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "calc(0.625rem - 4px)"
  md: "calc(0.625rem - 2px)"
  lg: "0.625rem"
  xl: "calc(0.625rem + 4px)"
  2xl: "1rem"
  4xl: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "oklch(0.35 0 0)"
  button-secondary:
    backgroundColor: "oklch(0.97 0 0)"
    textColor: "oklch(0.205 0 0)"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.4xl}"
    padding: "2px 8px"
    height: "20px"
  input-default:
    backgroundColor: "oklch(0.922 0 0 / 0.3)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.4xl}"
    padding: "4px 12px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.2xl}"
    padding: "24px"
---

# Design System: kit

## Overview

**Creative North Star: "The Monolithic Edge"**

The design system embodies the precision, economy, and focus of high-performance systems engineering. Visual expression is rooted in stark monochrome contrast, razor-thin borders, and purposeful typography rather than decorative ornamentation. The interface recedes to highlight technical prose, architecture schemas, and real-time telemetry metrics.

Every surface is balanced between structural discipline (dense, structured grid layouts and subtle 1px border rings) and organic touchpoints (full-pill contours on interactive buttons, badges, and search inputs). The dark and light themes are exact tonal inversions engineered in OKLCH, ensuring uncompromised legibility and razor-sharp contrast across high-DPI displays.

**Key Characteristics:**
- **Austere Monochrome Balance:** Deep obsidian darks and crisp paper whites driven by OKLCH color space.
- **Pill vs. Box Geometry:** Continuous `rounded-4xl` full pills for controls juxtaposed against `rounded-2xl` structural cards.
- **Typographic Hierarchy:** Geometric `Manrope` for impactful headings, `Geist` for body reading, and `Geist Mono` for metrics, telemetry, and code.
- **Zero-Shadow Tonal Depth:** Surfaces are flat and layered using 1px rings (`ring-1 ring-foreground/10`) and background contrast rather than heavy drop shadows.

## Colors

The palette is strictly monochromatic and perceptual, built using OKLCH to preserve uniform contrast across themes.

### Primary
- **Obsidian / Pure White** (`oklch(0.205 0 0)` light / `oklch(0.985 0 0)` dark): The primary contrast anchor, applied to core action buttons, active navigation markers, and prominent headlines.

### Neutral
- **Canvas Background** (`oklch(1 0 0)` light / `oklch(0.145 0 0)` dark): The baseline canvas foundation across public and application routes.
- **Surface Card** (`oklch(1 0 0)` light / `oklch(0.205 0 0)` dark): Container background for grouped widgets, telemetry panels, and list items.
- **Subtle Muted / Secondary** (`oklch(0.97 0 0)` light / `oklch(0.269 0 0)` dark): Low-contrast backgrounds for table headers, secondary buttons, and tag chips.
- **Muted Foreground** (`oklch(0.556 0 0)` light / `oklch(0.708 0 0)` dark): Secondary text, timestamps, captions, and metric metadata.
- **Structural Border & Input** (`oklch(0.922 0 0)` light / `oklch(0.269 0 0)` dark): 1px hairline perimeter dividers and input borders.

### Destructive
- **Signal Coral** (`oklch(0.577 0.245 27.325)` light / `oklch(0.396 0.141 25.723)` dark): Reserved strictly for destructive actions, error badges, and critical telemetry alerts.

### Named Rules
**The Rarity of Accent Rule.** The interface is deliberately monochrome. Color is never decorative; it is strictly reserved for syntax highlighting, map telemetry pins, and error states.

## Typography

**Display & Heading Font:** `Manrope` (with `ui-sans-serif`, `system-ui`, `sans-serif` fallback)  
**Body Font:** `Geist Variable` (with `ui-sans-serif`, `sans-serif` fallback)  
**Label & Code Font:** `Geist Mono Variable` (with `ui-monospace`, `monospace` fallback)

**Character:** Technical editorial rigor. Sharp, modern geometric headings paired with readable body typography and authentic engineer-grade monospace for code and telemetry data.

### Hierarchy
- **Display** (800 weight, `clamp(2rem, 5vw, 3.5rem)`, 1.1 line-height, -0.03em tracking): Main hero title and major page headlines.
- **Headline** (700 weight, `1.875rem` / `30px`, 1.2 line-height, -0.02em tracking): Section titles, article headers, and modal headers.
- **Title** (600 weight, `1.25rem` / `20px`, 1.35 line-height, -0.01em tracking): Card headers, widget group names, and sub-headings.
- **Body** (400 weight, `0.9375rem` / `15px`, 1.65 line-height): Article prose, paragraphs, and description text. Max line length 65–75ch for prose.
- **Label / Code** (500 weight, `0.75rem` / `12px`, 0.05em tracking, uppercase where contextual): Pill badges, table column headers, timestamps, and metadata tags.

### Named Rules
**The Monospace Proof Rule.** Any factual runtime data (hashes, IPs, latencies, timestamps, code snippets, memory allocations) must render in `Geist Mono`.

## Layout

The layout uses a centered responsive container with strict spatial rhythm based on a 4px/8px incremental grid.

- **Public Views (`/`, `/about`, `/blog`):** Centered max-width column (`max-w-4xl` / `max-w-3xl`) with generous vertical flow (`py-8` to `py-16`) and 16px horizontal gutter on mobile.
- **Application Views (`/dashboard`, `/settings`):** Responsive sidebar shell with sticky header and fluid multi-column grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`).
- **Spacing Scale:** Micro spacing (4px, 8px, 12px) inside components; structural spacing (16px, 24px, 32px, 48px) for section divisions.

## Elevation & Depth

Surfaces are flat by default. Depth is conveyed strictly through tonal layering and 1px border rings rather than blurry drop shadows.

- **Rest State:** Flat background with `ring-1 ring-foreground/10` or `border border-border`.
- **Interactive State:** Hover effects use background tint transitions (`hover:bg-muted` or `hover:bg-input/50`) and subtle translation (`active:translate-y-px`).
- **Overlays / Popovers:** Floating dialogs, command palettes, and dropdown menus utilize a crisp 1px ring and backdrop blur (`backdrop-blur-md`) with minimal ambient diffusion (`shadow-lg`).

### Named Rules
**The Tonal Boundary Rule.** Containers define boundaries through subtle surface value contrast (`bg-card` on `bg-background`) and crisp 1px rings, never through heavy drop shadows.

## Shapes

- **Interactive Controls (Buttons, Inputs, Badges, Tabs):** Continuous full-pill radius (`rounded-4xl` / `9999px`).
- **Structural Containers (Cards, Modals, Drawers):** Soft rectangular radius (`rounded-2xl` / `16px`).
- **Inner Nested Elements (Images inside cards, table rows):** Scaled inner radius (`rounded-xl` / `12px` or `rounded-lg` / `8px`).

## Components

### Buttons
- **Shape:** Full-pill geometry (`rounded-4xl`).
- **Primary:** `bg-primary text-primary-foreground hover:bg-primary/80`, height 36px (`h-9`), horizontal padding 12px (`px-3`), font size 14px (`text-sm`).
- **Secondary:** `bg-secondary text-secondary-foreground hover:bg-secondary/80`.
- **Outline:** `border-border bg-input/30 hover:bg-input/50 hover:text-foreground`.
- **Ghost:** `hover:bg-muted hover:text-foreground`.
- **Destructive:** `bg-destructive/10 text-destructive hover:bg-destructive/20`.

### Badges & Chips
- **Shape:** Pill radius (`rounded-4xl`), height 20px (`h-5`), text 12px (`text-xs`), padding 2px 8px (`px-2 py-0.5`).
- **Variants:** `default` (filled contrast), `secondary` (tonal gray), `outline` (hairline border on input tint).

### Cards & Panels
- **Corner Style:** Soft rounded rectangle (`rounded-2xl`).
- **Background:** `bg-card` with `ring-1 ring-foreground/10`.
- **Padding:** 24px default (`p-6`), 16px compact (`p-4`).

### Inputs & Fields
- **Shape:** Pill radius (`rounded-4xl`), height 36px (`h-9`), padding 4px 12px (`px-3 py-1`).
- **Background & Border:** `border border-input bg-input/30 placeholder:text-muted-foreground`.
- **Focus:** `focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50`.

### Navigation & Header
- **App Header:** Top-anchored with subtle border-b, backdrop blur (`backdrop-blur-sm`), and quick navigation links.
- **Active Navigation Indicator:** Subtle high-contrast pill marker with smooth transition.

## Do's and Don'ts

### Do:
- **Do** use `rounded-4xl` for buttons, badges, tags, and text inputs to maintain the established pill interaction language.
- **Do** use `rounded-2xl` for cards, dialogs, and outer container panels.
- **Do** render all telemetry, timestamps, code blocks, and metrics in `Geist Mono`.
- **Do** rely on 1px rings (`ring-1 ring-foreground/10`) and surface contrast rather than drop shadows for hierarchy.
- **Do** format colors using OKLCH CSS variables for consistent light/dark inversion.

### Don't:
- **Don't** introduce saturated primary brand colors (e.g. bright blues/purples) for general UI; the system is deliberately monochrome.
- **Don't** use sharp rectangular corners (`rounded-none` or `rounded-sm`) on interactive buttons or badges.
- **Don't** apply heavy drop shadows (`shadow-2xl` or colored glow shadows) to cards or content surfaces.
- **Don't** use generic sans-serif for numbers or telemetry where monospace alignment is required.
