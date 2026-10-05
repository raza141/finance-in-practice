import { siteConfig } from "@/core/config/site";
import type { Course } from "@/domains/courses/types";
import type { PublishedArticle } from "@/domains/journal/types";
import type { Instructor } from "@/domains/team/types";

export type JsonLdNode = Record<string, unknown>;

/**
 * schema.org JSON-LD built from the site's own data (config, courses,
 * journal, instructors), so markup never drifts from what the page shows.
 * Nodes link to each other by @id: the organisation is defined once in the
 * root layout and referenced everywhere else.
 */
export class StructuredData {
  static readonly ORG_ID = `${siteConfig.url}/#organization`;
  static readonly SITE_ID = `${siteConfig.url}/#website`;

  /** Site-wide: who we are and what the site is. Rendered by the root layout. */
  static site(): JsonLdNode {
    const { whatsapp } = siteConfig.contact;
    return StructuredData.graph([
      {
        "@type": "EducationalOrganization",
        "@id": StructuredData.ORG_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        logo: { "@type": "ImageObject", url: `${siteConfig.url}/brand/fip-logo.png` },
        description: siteConfig.description,
        slogan: siteConfig.tagline,
        knowsAbout: ["CFA exam preparation", "FRM exam preparation", "Corporate finance", "Financial risk management", "Quantitative finance", "Python for finance"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: `+${whatsapp.number}`,
          url: `${siteConfig.url}/contact`,
          availableLanguage: ["English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": StructuredData.SITE_ID,
        url: siteConfig.url,
        name: siteConfig.name,
        inLanguage: "en",
        publisher: { "@id": StructuredData.ORG_ID },
      },
    ]);
  }

  /** /about: each published instructor, tied to the organisation. */
  static instructors(instructors: readonly Instructor[]): JsonLdNode {
    return StructuredData.graph([
      ...instructors.map((person) => ({
        "@type": "Person",
        "@id": StructuredData.personId(person),
        name: person.name,
        jobTitle: person.role,
        description: person.bio,
        ...(person.photo && { image: StructuredData.absolute(person.photo) }),
        ...(person.highlights.length > 0 && { knowsAbout: person.highlights }),
        ...(person.links?.length && { sameAs: person.links.map((l) => l.href).filter((href) => href.startsWith("https://")) }),
        worksFor: { "@id": StructuredData.ORG_ID },
        url: `${siteConfig.url}/about`,
      })),
      StructuredData.breadcrumbs([{ name: "Instructor", path: "/about" }]),
    ]);
  }

  /** /journal/[slug]: built only from what the page shows (title, excerpt, dates, author, image, tags). */
  static article(article: PublishedArticle): JsonLdNode {
    const { doc } = article;
    const url = `${siteConfig.url}/journal/${doc.slug}`;
    return StructuredData.graph([
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: doc.title,
        description: doc.excerpt,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        ...(doc.tags.length > 0 && { keywords: doc.tags.join(", ") }),
        ...(doc.category && { articleSection: doc.category }),
        ...(doc.audience.length > 0 && { audience: { "@type": "EducationalAudience", educationalRole: doc.audience.join(", ") } }),
        inLanguage: "en",
        url,
        mainEntityOfPage: url,
        image: doc.featuredImage?.url ? StructuredData.absolute(doc.featuredImage.url) : `${siteConfig.url}/brand/fip-logo.png`,
        author: { "@type": "Person", name: article.authorName, url: `${siteConfig.url}/about` },
        publisher: { "@id": StructuredData.ORG_ID },
        isPartOf: { "@id": StructuredData.SITE_ID },
      },
      StructuredData.breadcrumbs([
        { name: "Research Terminal", path: "/journal" },
        { name: doc.title, path: `/journal/${doc.slug}` },
      ]),
    ]);
  }

  /** /courses/[slug]: Course with an online instance and, when priced, an offer. */
  static course(course: Course): JsonLdNode {
    const url = `${siteConfig.url}/courses/${course.slug}`;
    return StructuredData.graph([
      {
        "@type": "Course",
        "@id": `${url}#course`,
        name: course.title,
        description: course.summary,
        url,
        inLanguage: "en",
        provider: { "@id": StructuredData.ORG_ID },
        ...(course.modules.length > 0 && {
          syllabusSections: course.modules.map((m) => ({
            "@type": "Syllabus",
            name: m.title,
            ...(m.summary && { description: m.summary }),
          })),
        }),
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "Online",
          // Free text like "8 weeks · 16 live sessions"; schema.org accepts text here.
          courseWorkload: course.duration,
          ...(course.startDate && { startDate: StructuredData.dateTime(course.startDate) }),
        },
        ...(course.priceMinor !== null && {
          offers: {
            "@type": "Offer",
            category: "Paid",
            price: (course.priceMinor / 100).toFixed(2),
            priceCurrency: course.currency,
            url,
            availability: "https://schema.org/InStock",
          },
        }),
      },
      StructuredData.breadcrumbs([
        { name: "Learning Tracks", path: "/courses" },
        { name: course.title, path: `/courses/${course.slug}` },
      ]),
    ]);
  }

  /** Home is always the first crumb. */
  static breadcrumbs(trail: readonly { name: string; path: string }[]): JsonLdNode {
    const items = [{ name: "Home", path: "" }, ...trail];
    return {
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        item: `${siteConfig.url}${item.path}`,
      })),
    };
  }

  /** Serialised for a <script type="application/ld+json">; "<" escaped so content can't close the tag. */
  static serialize(node: JsonLdNode): string {
    return JSON.stringify(node).replace(/</g, "\\u003c");
  }

  /** Google wants a full datetime with zone; our dates are calendar days, so start of day in GST (the business's zone). */
  static dateTime(isoDate: string): string {
    return `${isoDate}T00:00:00+04:00`;
  }

  private static graph(nodes: JsonLdNode[]): JsonLdNode {
    return { "@context": "https://schema.org", "@graph": nodes };
  }

  private static personId(person: Instructor): string {
    return `${siteConfig.url}/about#${person.id}`;
  }

  private static absolute(path: string): string {
    return path.startsWith("http") ? path : `${siteConfig.url}${path}`;
  }
}
