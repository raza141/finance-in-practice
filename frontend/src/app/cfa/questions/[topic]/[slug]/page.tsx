import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { StructuredData } from "@/core/seo/StructuredData";
import { QuestionView } from "@/domains/questions/components/QuestionView";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";

// Rendered on first request and cached (ISR); saving in admin revalidates it at
// once, and a scheduled question goes live within five minutes of its time.
export const revalidate = 300;

export function generateStaticParams(): { topic: string; slug: string }[] {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/cfa/questions/[topic]/[slug]">): Promise<Metadata> {
  const { topic, slug } = await params;
  const q = await QuestionPages.bySlug(topic, slug);
  return q ? QuestionPages.metadata(q) : { title: "Question not found", robots: { index: false } };
}

/** The permanent, canonical page of one question. */
export default async function QuestionPage({ params }: PageProps<"/cfa/questions/[topic]/[slug]">) {
  const { topic, slug } = await params;
  const q = await QuestionPages.bySlug(topic, slug);
  if (!q) notFound();
  const related = (await (await QuestionPages.repo())?.related(q)) ?? [];
  return (
    <>
      <JsonLd data={StructuredData.question(q)} />
      <QuestionView q={q} related={related} />
    </>
  );
}
