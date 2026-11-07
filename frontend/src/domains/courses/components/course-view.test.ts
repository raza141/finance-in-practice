import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Course } from "../types";
import { CourseView } from "./CourseView";

/** The university course has no exam ticker, no weights and two modes: the page must still render every module and its prices. */
describe("CourseView with the university-finance seed", () => {
  const seed = JSON.parse(readFileSync(new URL("../../../../scripts/db/seeds/university-finance.json", import.meta.url), "utf8"));
  const course: Course = { id: "u", ...seed };

  it("renders all eight modules and the fallback options", () => {
    const html = renderToStaticMarkup(createElement(CourseView, { course, testimonials: [], packages: [], booking: null }));
    for (const m of course.modules) expect(html).toContain(m.title.replace(/&/g, "&amp;"));
    expect(html).toContain("AED 950 / 10 hours");
  });
});
