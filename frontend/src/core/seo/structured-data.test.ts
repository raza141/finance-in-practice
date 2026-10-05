import { describe, expect, it } from "vitest";

import type { Course } from "@/domains/courses/types";
import { JournalFramework } from "@/domains/journal/services/JournalFramework";
import type { PublishedArticle } from "@/domains/journal/types";
import type { Instructor } from "@/domains/team/types";

import { StructuredData, type JsonLdNode } from "./StructuredData";

const nodes = (data: JsonLdNode) => data["@graph"] as JsonLdNode[];
const byType = (data: JsonLdNode, type: string) => nodes(data).find((n) => n["@type"] === type)!;

const COURSE: Course = {
  id: "c1",
  slug: "cfa-level-1",
  title: "CFA Level I",
  summary: "Exam prep.",
  category: "Fixed Income",
  startDate: "2026-11-01",
  duration: "8 weeks · 16 live sessions",
  priceMinor: 150000,
  currency: "AED",
  isActive: true,
  syllabus: [{ title: "Ethics", topics: ["Code and Standards"] }],
  brochureUrl: null,
};

describe("StructuredData", () => {
  it("defines the organisation and website once, linked by @id", () => {
    const site = StructuredData.site();
    expect(site["@context"]).toBe("https://schema.org");
    const org = byType(site, "EducationalOrganization");
    expect(org["@id"]).toBe(StructuredData.ORG_ID);
    expect(org.url).toBe("https://financeinpractice.me");
    expect((org.contactPoint as JsonLdNode).telephone).toMatch(/^\+971\d+$/);
    expect(byType(site, "WebSite").publisher).toEqual({ "@id": StructuredData.ORG_ID });
  });

  it("marks up a journal article from its visible fields, with real dates and author", () => {
    const doc = { ...JournalFramework.newDocument("Explainer", "three-ways-to-compute-var"), title: "Three ways to compute VaR", excerpt: "Summary.", tags: ["Risk", "FRM"] };
    const article: PublishedArticle = {
      id: "a1",
      doc: { ...doc, featuredImage: { url: "https://cdn.example.com/var.png", alt: "VaR", caption: "" } },
      authorName: "Muhammad Ahmed Raza",
      datePublished: "2026-10-04T05:00:00.000Z",
      dateModified: "2026-10-06T08:00:00.000Z",
    };
    const data = StructuredData.article(article);
    const post = byType(data, "Article");
    expect(post.headline).toBe(doc.title);
    expect(post.datePublished).toBe(article.datePublished);
    expect(post.dateModified).toBe(article.dateModified);
    expect(post.image).toBe("https://cdn.example.com/var.png");
    expect(post.author).toMatchObject({ "@type": "Person", name: "Muhammad Ahmed Raza" });
    expect(post.keywords).toBe("Risk, FRM");
    expect(post.publisher).toEqual({ "@id": StructuredData.ORG_ID });
    expect(nodes(data).some((n) => n["@type"] === "FAQPage")).toBe(false);
    const crumbs = byType(data, "BreadcrumbList").itemListElement as JsonLdNode[];
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(crumbs[2].item).toBe("https://financeinpractice.me/journal/three-ways-to-compute-var");
  });

  it("marks up a course with an online instance and a priced offer", () => {
    const course = byType(StructuredData.course(COURSE), "Course");
    expect(course.provider).toEqual({ "@id": StructuredData.ORG_ID });
    expect(course.hasCourseInstance).toMatchObject({ courseMode: "Online", startDate: "2026-11-01T00:00:00+04:00" });
    expect(course.offers).toMatchObject({ price: "1500.00", priceCurrency: "AED", category: "Paid" });
  });

  it("omits the offer and start date when they are on request", () => {
    const course = byType(StructuredData.course({ ...COURSE, priceMinor: null, startDate: null }), "Course");
    expect(course.offers).toBeUndefined();
    expect(course.hasCourseInstance).not.toHaveProperty("startDate");
  });

  it("links instructors to the organisation and keeps only https profiles", () => {
    const person: Instructor = {
      id: "raza",
      name: "Muhammad Ahmed Raza",
      role: "Lead Instructor",
      photo: "/team/raza.jpg",
      bio: "Bio.",
      education: [],
      background: "",
      highlights: ["CFA", "FRM"],
      links: [
        { label: "LinkedIn", href: "https://www.linkedin.com/in/example" },
        { label: "Mail", href: "mailto:x@example.com" },
      ],
      sortOrder: 1,
      isActive: true,
    };
    const node = byType(StructuredData.instructors([person]), "Person");
    expect(node.worksFor).toEqual({ "@id": StructuredData.ORG_ID });
    expect(node.image).toBe("https://financeinpractice.me/team/raza.jpg");
    expect(node.sameAs).toEqual(["https://www.linkedin.com/in/example"]);
  });

  it("escapes < so page text cannot close the script tag", () => {
    const out = StructuredData.serialize({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});
