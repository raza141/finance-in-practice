import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The brand lock (docs/brand.md): colours come from the @theme tokens, fonts from the root layout.
 * A failure here means a screen went off-brand: use a token, or change the guide and this list on purpose.
 */
const SRC = join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
const sources = files(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, "utf8") }));

/** Screens that copy another product's own look on purpose (a Google review card, a WhatsApp chat, a Google result). */
const LOOKALIKES = ["domains/testimonials/components/GoogleReviews.tsx", "domains/whatsapp/components/MessageTypes.tsx", "domains/whatsapp/components/TemplateEditor.tsx", "domains/journal/components/admin/ArticlePanels.tsx"];
/** Categorical colours: one hue per course on the admin schedule. */
const CATEGORICAL = ["domains/schedule/components/ScheduleBoard.tsx"];
/** Tailwind hues with a job in the guide (§3): red errors, emerald correct, violet mocks (overdue is gold: one gold), indigo topics, slate done. */
const HUES = new Set(["red", "emerald", "violet", "indigo", "slate"]);

const UTIL = "(?:bg|text|border|from|to|via|fill|stroke|ring|outline|decoration|shadow|accent|divide|placeholder|caret)";

describe("brand lock", () => {
  it("uses colour tokens, not hex values, in classes", () => {
    const bad = sources
      .filter((f) => !LOOKALIKES.includes(f.path))
      .flatMap((f) => [...f.text.matchAll(new RegExp(`\\b${UTIL}-\\[#[0-9a-fA-F]{3,8}\\]`, "g"))].map((m) => `${f.path}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  it("uses only the Tailwind hues the guide gives a job", () => {
    const bad = sources
      .filter((f) => !CATEGORICAL.includes(f.path))
      .flatMap((f) =>
        [...f.text.matchAll(new RegExp(`\\b${UTIL}-(gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate)-\\d`, "g"))]
          .filter((m) => !HUES.has(m[1]))
          .map((m) => `${f.path}: ${m[0]}`),
      );
    expect(bad).toEqual([]);
  });

  it("loads fonts once, in the root layout", () => {
    const loaders = sources.filter((f) => f.text.includes("next/font")).map((f) => f.path);
    expect(loaders).toEqual(["app/layout.tsx"]);
    const adHoc = sources.filter((f) => /\bfont-\[|fontFamily:/.test(f.text) && f.path !== "core/seo/OgImage.tsx").map((f) => f.path);
    expect(adHoc).toEqual([]);
  });

  it("fills with one gold: solid, never faded", () => {
    const bad = sources.flatMap((f) => [...f.text.matchAll(/\bbg-gold\/\d+/g)].map((m) => `${f.path}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  it("draws icons with Lucide, not emoji", () => {
    const bad = sources.filter((f) => f.path.endsWith(".tsx") && /\p{Emoji_Presentation}|[⚑⚐☰⏸⏱▶✎]/u.test(f.text)).map((f) => f.path);
    expect(bad).toEqual([]);
  });

  it("keeps the brand tokens at their values", () => {
    const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
    for (const [token, value] of Object.entries({ canvas: "#0b1120", surface: "#151e32", line: "#24304a", gold: "#d4af37", quant: "#22d3ee", ink: "#f8fafc", muted: "#aab6c8" })) {
      expect(css).toContain(`--color-${token}: ${value};`);
    }
    for (const font of ["--font-inter", "--font-merriweather", "--font-jetbrains-mono"]) expect(css).toContain(font);
  });
});
