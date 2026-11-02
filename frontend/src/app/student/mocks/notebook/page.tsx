import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Inline } from "@/domains/journal/components/RichText";
import { drillWeakestTopic, practiceNotebook } from "@/domains/mocks/actions/mocks";
import { ExhibitText } from "@/domains/mocks/components/ExhibitText";
import { MockPageShell } from "@/domains/mocks/components/MockPageShell";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockNotebook } from "@/domains/mocks/services/MockNotebook";
import type { NotebookEntry } from "@/domains/mocks/types";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "Mistakes notebook", robots: { index: false, follow: false } };

const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short" });
// ponytail: every entry's exhibits are rendered on the server; past this, the oldest wait until newer ones clear.
const SHOWN = 100;

/** Every question the student has got wrong, across all their mocks and drills, until they get it right twice in a row. */
export default async function NotebookPage({ searchParams }: PageProps<"/student/mocks/notebook">) {
  const [student, { notice }] = await Promise.all([StudentAuth.current(), searchParams]);
  if (!student) redirect("/student");
  const book = MockNotebook.build(await MockSession.repo().notebookRows(student.id));
  const shown = book.slice(0, SHOWN);
  const topics = [...new Set(shown.map((e) => e.topic.trim()))];
  const practice = Math.min(book.length, MockNotebook.PRACTICE_MAX);

  return (
    <MockPageShell>
      <div className="mx-auto grid max-w-3xl gap-6">
        <section className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8">
          <h1 className="text-3xl font-normal italic">Mistakes notebook</h1>
          <p className="mt-2 text-muted">
            Every question you&rsquo;ve got wrong or left blank, from all your mocks. A question leaves once you get it right {MockNotebook.RIGHT_TO_CLEAR} times in a row.
          </p>
          {notice === "no-drill" && (
            <p role="status" className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-3 text-sm">
              There are no new practice questions in your weakest topics yet. Practise your notebook instead, or ask your tutor for more.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {book.length > 0 && (
              <form action={practiceNotebook}>
                <button type="submit" className="h-10 rounded-btn bg-gold px-5 text-sm font-semibold text-canvas hover:bg-gold-bright">
                  Practise {practice === book.length ? "all" : `the newest ${practice}`} ({practice})
                </button>
              </form>
            )}
            <form action={drillWeakestTopic}>
              <button type="submit" className="h-10 rounded-btn border border-line px-5 text-sm hover:border-quant/60">
                {MockContract.DRILL_SIZE} new questions from my weakest topic
              </button>
            </form>
          </div>
        </section>

        {book.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface/60 p-6 text-muted">Nothing here yet. Questions you miss in a mock land here, so you can come back to them.</p>
        ) : (
          topics.map((topic) => (
            <section key={topic} aria-labelledby={`t-${topic}`} className="grid gap-3">
              <h2 id={`t-${topic}`} className="text-xl font-normal italic">
                {topic}
              </h2>
              {shown
                .filter((e) => e.topic.trim() === topic)
                .map((e) => (
                  <Entry key={e.id} e={e} />
                ))}
            </section>
          ))
        )}
        {book.length > SHOWN && <p className="text-sm text-muted">Showing your newest {SHOWN} of {book.length}. Older ones appear as you clear these.</p>}
      </div>
    </MockPageShell>
  );
}

/** One question, folded: the question and where it stands; open for the case, the options, why their pick tempts, and the explanation. */
function Entry({ e }: { e: NotebookEntry }) {
  const toClear = MockNotebook.RIGHT_TO_CLEAR - e.streak;
  return (
    <details className="group rounded-2xl border border-line bg-surface/60 open:border-quant/40">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
        <span className="min-w-0 line-clamp-2 group-open:line-clamp-none">
          <Inline text={e.question} />
        </span>
        <span className="shrink-0 text-right text-xs text-muted">
          Wrong {e.timesWrong}×
          <span className="block">{toClear === 1 ? "1 more right to clear" : `${toClear} right to clear`}</span>
          <span className="block">{DAY.format(new Date(e.at))}</span>
        </span>
      </summary>
      <div className="grid gap-3 border-t border-line p-4">
        {e.vignette && (
          <div className="max-h-80 overflow-y-auto rounded-lg border border-line bg-canvas/40 p-4 text-sm text-ink/90">
            <ExhibitText text={e.vignette} />
          </div>
        )}
        <ExhibitText text={e.question} />
        <ul className="grid gap-2">
          {MockContract.LETTERS.map((letter, i) => {
            const right = letter === e.correct;
            const picked = letter === e.lastWrong;
            return (
              <li key={letter} className={`rounded-lg border-2 px-4 py-2.5 ${right ? "border-emerald-400 bg-emerald-400/10" : picked ? "border-red-400 bg-red-400/10" : "border-line"}`}>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-sm text-muted">{letter}</span>
                  <span className="min-w-0 flex-1">
                    <Inline text={e.options[i]} />
                  </span>
                  {picked && <span className="text-xs text-muted">Your last answer</span>}
                  {right && <span className="text-xs font-semibold text-emerald-300">Correct</span>}
                </span>
                {!right && e.why[i] && (
                  <span className={`mt-1 block pl-7 text-sm ${picked ? "text-ink/90" : "text-muted"}`}>
                    <Inline text={e.why[i]} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {!e.lastWrong && <p className="text-sm text-muted">You left it blank last time.</p>}
        {e.explanation && (
          <section className="border-l-2 border-emerald-400/60 pl-4">
            <h3 className="text-sm font-semibold">Explanation</h3>
            <div className="mt-1 text-ink/90">
              <ExhibitText text={e.explanation} />
            </div>
          </section>
        )}
      </div>
    </details>
  );
}
