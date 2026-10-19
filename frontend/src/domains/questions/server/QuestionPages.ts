import "server-only";

import type { Metadata } from "next";
import { cache } from "react";

import { siteConfig } from "@/core/config/site";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Question } from "../types";
import { QuestionRepository } from "./QuestionRepository";

/**
 * Loaders for the public /cfa pages. Each returns null while the owner's
 * "public pages" switch is off (or the database is unreachable), so the pages
 * 404 and nothing reaches search engines before launch. Wrapped in cache() so
 * generateMetadata and the page share one query.
 */
export class QuestionPages {
  /** The repository, or null when the pages are switched off. */
  static readonly repo = cache(async (): Promise<QuestionRepository | null> => {
    try {
      const repo = QuestionRepository.fromEnv();
      return repo && (await repo.switches()).pagesOn ? repo : null;
    } catch (error) {
      console.error("cfa questions: could not load", error);
      return null;
    }
  });

  static readonly bySlug = cache(async (topic: string, slug: string): Promise<Question | null> => {
    try {
      return (await (await QuestionPages.repo())?.liveBySlug(topic, slug)) ?? null;
    } catch (error) {
      console.error("cfa questions: could not load question", error);
      return null;
    }
  });

  static readonly latest = cache(async (): Promise<Question | null> => {
    try {
      return (await (await QuestionPages.repo())?.latest()) ?? null;
    } catch (error) {
      console.error("cfa questions: could not load latest", error);
      return null;
    }
  });

  /** Title, description, canonical and social tags. `canonicalPath` is always the permanent URL. */
  static metadata(q: Question, { title, url }: { title?: string; url?: string } = {}): Metadata {
    const path = QuestionTaxonomy.path(q);
    const topic = QuestionTaxonomy.topic(q.topic)?.name ?? q.topic;
    const level = QuestionTaxonomy.levelLabel(q.level);
    const description =
      q.description || `${level} ${topic} practice question: ${q.title}. Pick your answer, then see the full worked solution and the common exam trap.`;
    const heading = title ?? `${q.title} | ${level} Question`;
    return {
      title: { absolute: `${heading} | ${siteConfig.name}` },
      description,
      alternates: { canonical: path },
      openGraph: { type: "article", title: heading, description, url: url ?? `${siteConfig.url}${path}`, publishedTime: q.publishAt?.toISOString() },
      twitter: { card: "summary_large_image", title: heading, description },
    };
  }

  /** The link-preview card for a question. */
  static ogCard(q: Question | null): { eyebrow: string; title: string; subtitle: string; titleSize: number } {
    if (!q) return { eyebrow: "CFA® practice", title: "CFA Question of the Day", subtitle: "One exam-style question a day, fully worked", titleSize: 76 };
    return {
      eyebrow: `${QuestionTaxonomy.levelLabel(q.level)} · ${QuestionTaxonomy.topic(q.topic)?.name ?? q.topic}`,
      title: q.title,
      subtitle: "Question of the day · Can you solve it?",
      titleSize: q.title.length > 60 ? 56 : 68,
    };
  }
}
