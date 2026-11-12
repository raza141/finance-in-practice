import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookButton } from "@/core/components/ui/BookButton";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { ScoreShare } from "@/domains/mocks/server/ScoreShare";
import { MockGrader } from "@/domains/mocks/services/MockGrader";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export async function generateMetadata({ params }: PageProps<"/share/score/[token]">): Promise<Metadata> {
  const s = ScoreShare.fromEnv()?.read((await params).token);
  const title = s ? `${MockGrader.percent(s.score, s.total)}% on ${s.title}` : "Mock exam score";
  // One student's score: shareable, never a search result.
  return { title, description: "An exam-style mock taken with Finance in Practice.", robots: { index: false, follow: true } };
}

/** What a student's LinkedIn post links to: their score, then the two ways in (try the diagnostic quiz, or book). */
export default async function SharedScorePage({ params }: PageProps<"/share/score/[token]">) {
  const s = ScoreShare.fromEnv()?.read((await params).token);
  if (!s) notFound();
  const pct = MockGrader.percent(s.score, s.total);
  return (
    <section aria-labelledby="score-heading" className="page-container max-w-3xl py-14 lg:py-20">
      <div className="rounded-3xl border border-ink/10 bg-canvas/70 p-6 text-center backdrop-blur sm:p-10">
        <ClipboardCheck aria-hidden strokeWidth={1.75} className="mx-auto size-8 text-quant" />
        <h1 id="score-heading" className="mt-4 text-2xl font-normal italic sm:text-3xl">
          {s.title}
        </h1>
        <p className="mt-6 font-mono text-6xl font-bold tabular-nums sm:text-7xl">{pct}%</p>
        <p className="mt-2 font-mono text-sm text-muted tabular-nums">
          {s.score} / {s.total} · {DATE.format(new Date(`${s.date}T00:00:00Z`))}
        </p>
        <div className="btn-group mx-auto mt-8 justify-center">
          <BookButton />
          <ButtonLink href="/cfa/diagnostic" variant="secondary">
            Try the free 10-question test
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
