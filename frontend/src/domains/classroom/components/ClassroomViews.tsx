import { siteConfig } from "@/core/config/site";
import { BUTTON, CLASSROOM_BUTTON } from "@/domains/students/components/buttons";
import { TabButton } from "@/domains/students/components/StudentPortal";

import { ClassFeed, type Score } from "../services/ClassFeed";
import type { ClassItem, StudentFeed } from "../types";

/** What the page hands every view: never a rejected promise, so one Google hiccup can't break the portal. */
export type FeedResult = { status: "off" } | { status: "error" } | { status: "ok"; feed: StudentFeed };

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const TARGET = siteConfig.classroom.targetPct;
const KIND: Record<ClassItem["kind"], string> = { quiz: "Quiz", assignment: "Assignment", question: "Question", material: "Material", announcement: "Announcement" };
const KIND_TONE: Record<ClassItem["kind"], string> = {
  quiz: "border-gold/50 text-gold",
  assignment: "border-quant/50 text-quant",
  question: "border-quant/50 text-quant",
  material: "border-[#34a853]/50 text-[#5bb974]",
  announcement: "border-line text-ink/80",
};

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dubai" }).format(new Date(iso));
const dayTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(iso));
const FIRST = 8;
const pctOf = (g: NonNullable<ClassItem["grade"]>) => Math.round((g.points / g.max) * 1000) / 10;

function Status({ item }: { item: ClassItem }) {
  if (item.grade) {
    const pct = pctOf(item.grade);
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pct < TARGET ? "bg-gold/15 text-gold" : "bg-quant/15 text-quant"}`}>
        {item.grade.points}/{item.grade.max} · {pct}%
      </span>
    );
  }
  const text = { todo: item.dueAt ? `Due ${dayTime(item.dueAt)}` : "To do", missing: "Missing", done: "Turned in", returned: "Returned" };
  const tone = { todo: "bg-quant/10 text-quant", missing: "bg-red-400/15 text-red-300", done: "bg-white/5 text-muted", returned: "bg-white/5 text-muted" };
  return item.status ? (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[item.status]}`}>
      {text[item.status]}
      {item.late && item.status !== "missing" ? " · late" : ""}
    </span>
  ) : null;
}

function Item({ item, fresh }: { item: ClassItem; fresh: boolean }) {
  return (
    <li className="grid gap-2 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] tracking-[0.15em] uppercase ${KIND_TONE[item.kind]}`}>{KIND[item.kind]}</span>
        {fresh && <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-canvas uppercase">New</span>}
        <Status item={item} />
      </div>
      <p className="font-semibold text-ink">{item.title}</p>
      {item.text && <p className="text-sm text-ink/75">{item.text}</p>}
      <p className="text-xs text-muted">
        {item.classTitle}
        {item.topic && ` · ${item.topic}`} · posted {day(item.postedAt)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer" className={CLASSROOM_BUTTON}>
            {item.kind === "quiz" && item.status !== "done" && item.status !== "returned" ? "Start in Classroom" : "Open in Classroom"}
          </a>
        )}
        {item.files.map((f) => (
          <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className={`${BUTTON} max-w-64`}>
            <span className="truncate">{f.title}</span>
          </a>
        ))}
      </div>
    </li>
  );
}

const unavailable = (
  <section className={CARD}>
    <p className="text-sm text-muted">Couldn&rsquo;t reach Google Classroom just now. Your classes below still open directly.</p>
  </section>
);

/** Classroom tab, right-hand bar: the latest posts (quizzes, mocks, homework, files, announcements), newest first. */
export async function ClassFeedSidebar({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status === "off") return null;
  if (r.status === "error") return unavailable;
  const { feed } = r;
  const shown = feed.items.slice(0, FIRST);
  return (
    <aside aria-labelledby="feed-heading" className={CARD}>
      <h2 id="feed-heading" className="text-2xl font-normal italic">
        New in your class
      </h2>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing posted yet. Quizzes, homework and files your instructor posts in Classroom appear here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line/60">
          {shown.map((item) => (
            <Item key={`${item.classTitle}-${item.id}`} item={item} fresh={ClassFeed.isNew(item, feed.seenAt)} />
          ))}
        </ul>
      )}
    </aside>
  );
}

/** Classroom tab, under the classrooms: a join reminder when needed, then every post folded by topic (native <details>, no JS). */
export async function ClassTopics({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status !== "ok") return null;
  const { feed } = r;
  const notJoined = feed.classes.filter((c) => !c.joined);
  const groups = ClassFeed.byTopic(feed.items);
  const manyClasses = new Set(groups.map((g) => g.classTitle)).size > 1;
  if (notJoined.length === 0 && groups.length === 0) return null;
  return (
    <>
      {notJoined.length > 0 && (
        <p className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink">
          You haven&rsquo;t joined {notJoined.map((c) => c.title).join(", ")} yet. Press <span className="font-semibold">Join Google Classroom</span> above with{" "}
          <span className="font-semibold">{feed.email}</span>, or tell your instructor which Google account you use there. Until then you see the titles of shared
          posts, but can&rsquo;t open them.
        </p>
      )}
      {groups.length > 0 && (
        <section aria-labelledby="topics-heading" className={CARD}>
          <h2 id="topics-heading" className="text-2xl font-normal italic">
            Everything, by topic
          </h2>
          <div className="mt-3 divide-y divide-line/60">
            {groups.map((g) => (
              <details key={`${g.classTitle}-${g.topic}`} className="group py-1">
                <summary className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm text-ink hover:text-quant">
                  <span className="font-semibold">
                    {g.topic}
                    {manyClasses && <span className="font-normal text-muted"> · {g.classTitle}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {g.items.length} {g.items.length === 1 ? "post" : "posts"}
                    <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
                  </span>
                </summary>
                <ul className="divide-y divide-line/60">
                  {g.items.map((item) => (
                    <Item key={`${item.classTitle}-${item.id}`} item={item} fresh={false} />
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Marks over time as a small inline SVG (no chart library). */
function Chart({ scores, W, className }: { scores: Score[]; W: number; className: string }) {
  const H = 220;
  const pad = { l: 36, r: 16, t: 34, b: 28 };
  const x = (i: number) => pad.l + (scores.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (scores.length - 1)) * (W - pad.l - pad.r));
  const y = (pct: number) => pad.t + (1 - pct / 100) * (H - pad.t - pad.b);
  const line = scores.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.pct).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Marks: ${scores.map((m) => `${m.title} ${m.pct}%`).join(", ")}`} className={`mt-4 w-full ${className}`}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="rgb(255 255 255 / 0.07)" />
          <text x={pad.l - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="rgb(148 163 184)">
            {g}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(TARGET)} y2={y(TARGET)} stroke="rgb(212 175 55 / 0.8)" strokeDasharray="6 6" />
      {/* Legend above the plot, so it never sits on a score. */}
      <line x1={W - pad.r - 92} x2={W - pad.r - 72} y1={8} y2={8} stroke="rgb(212 175 55 / 0.8)" strokeDasharray="4 4" />
      <text x={W - pad.r} y={12} textAnchor="end" fontSize="11" fill="rgb(212 175 55)">
        Target {TARGET}%
      </text>
      <path d={line} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" strokeLinejoin="round" />
      {scores.map((m, i) => (
        <g key={m.id}>
          <circle cx={x(i)} cy={y(m.pct)} r="5" fill={m.pct < TARGET ? "rgb(212 175 55)" : "rgb(34 211 238)"} />
          <text x={x(i)} y={y(m.pct) - 10} textAnchor="middle" fontSize="11" fill="rgb(226 232 240)">
            {m.pct}%
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="rgb(148 163 184)">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

const BOOK = "inline-flex h-9 items-center rounded-md bg-gold px-3.5 text-sm font-semibold text-canvas hover:bg-gold-bright";

/** Progress tab: every returned mark, overall and per Classroom topic (mocks are one topic), each weak spot with a way to book a review. */
export async function ProgressPanel({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status === "off") return null;
  if (r.status === "error") return unavailable;
  const p = ClassFeed.progress(r.feed.items);
  const { last, average, best, count } = p.overall;
  if (!last) {
    return (
      <section className={CARD}>
        <h2 className="text-2xl font-normal italic">Your progress</h2>
        <p className="mt-3 text-sm text-muted">Your quiz, test and mock marks appear here once your instructor returns them in Classroom.</p>
      </section>
    );
  }
  const stats: [string, string][] = [
    ["Latest mark", `${last.pct}%`],
    ["Average", average === null ? "—" : `${average}%`],
    ["Best", best === null ? "—" : `${best}%`],
    ["Marked", String(count)],
  ];
  return (
    <div className="grid gap-6">
      {last.pct < TARGET && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gold/40 bg-gold/10 p-5 backdrop-blur-md">
          <p className="text-sm text-ink">
            {last.title}: <span className="font-semibold">{last.pct}%</span>, below your {TARGET}% target. A review session on what you missed helps most
            now.
          </p>
          <TabButton tab="book" notes={`Review after ${last.title} (${last.pct}%)`} className={BOOK}>
            Book a review session
          </TabButton>
        </section>
      )}
      <section aria-labelledby="progress-heading" className={CARD}>
        <h2 id="progress-heading" className="text-2xl font-normal italic">
          Your progress
        </h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line p-4">
              <dt className={LABEL}>{k}</dt>
              <dd className="mt-1 text-2xl font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <h3 className={`${LABEL} mt-6`}>By topic</h3>
        <ul className="mt-3 grid gap-4">
          {p.topics.map((t) => (
            <li key={t.name} className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {t.name} <span className="text-muted">· {t.count} marked</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`font-semibold ${t.pct < TARGET ? "text-gold" : "text-quant"}`}>{t.pct}%</span>
                  {t.pct < TARGET && (
                    <TabButton tab="book" notes={`Review: ${t.name} (${t.pct}% average)`} className="inline-flex h-7 items-center rounded-md border border-gold/60 px-2.5 font-mono text-[11px] font-semibold text-gold transition-colors hover:bg-gold/10">
                      Book a review
                    </TabButton>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div className={`h-full rounded-full ${t.pct < TARGET ? "bg-gold" : "bg-quant"}`} style={{ width: `${Math.min(t.pct, 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      {/* Two topics a row on wide screens, so each chart stays a readable size. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {p.topics.map((t) => (
        <section key={t.name} aria-label={t.name} className={CARD}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-xl font-normal italic">{t.name}</h2>
            <p className="text-sm text-muted">
              {t.count} marked · average <span className={t.pct < TARGET ? "text-gold" : "text-quant"}>{t.pct}%</span>
            </p>
          </div>
          {/* A trend needs two marks; one mark is just the list. Narrower drawing on phones, so the labels stay readable. */}
          {t.scores.length > 1 && (
            <>
              <Chart scores={t.scores} W={340} className="sm:hidden" />
              <Chart scores={t.scores} W={640} className="hidden sm:block" />
            </>
          )}
          <ol className="mt-4 divide-y divide-line/60 text-sm">
            {t.scores.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="mr-2 font-mono text-muted">{i + 1}</span>
                  {m.title}
                  <span className="text-muted"> · {day(m.at)}</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className={`font-semibold ${m.pct < TARGET ? "text-gold" : "text-quant"}`}>{m.pct}%</span>
                  {m.link && (
                    <a href={m.link} target="_blank" rel="noreferrer" className={BUTTON}>
                      Review
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
      </div>
    </div>
  );
}

/** Overview cards fed by Classroom: due soon, latest mark, what's new. */
export async function OverviewClassCards({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status === "off") return null;
  if (r.status === "error") return null;
  const { feed } = r;
  const missing = ClassFeed.todo(feed.items).filter((i) => i.status === "missing");
  const soon = ClassFeed.dueWithin(feed.items, 7);
  const fresh = feed.items.filter((i) => ClassFeed.isNew(i, feed.seenAt));
  const p = ClassFeed.progress(feed.items);
  const shown = p.latest ?? p.overall.last?.pct ?? null;
  const card = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md";
  return (
    <>
      <section className={card}>
        <h2 className={LABEL}>Google Classroom · to-do</h2>
        <p className="mt-2 text-3xl font-semibold text-ink">{soon.length}</p>
        <p className="text-sm text-muted">due in the next 7 days{missing.length > 0 && <span className="text-red-300"> · {missing.length} missing</span>}</p>
        {soon[0] && <p className="mt-2 truncate text-sm text-ink/90">Next: {soon[0].title}</p>}
        <TabButton tab="classroom" className={`${BUTTON} mt-4`}>
          Open Classroom
        </TabButton>
      </section>
      <section className={card}>
        {/* Mocks when there are any; otherwise the latest quiz or test mark. */}
        <h2 className={LABEL}>{p.mocks.length > 0 ? "Latest mock" : "Latest mark"}</h2>
        <p className={`mt-2 text-3xl font-semibold ${shown !== null && shown < TARGET ? "text-gold" : "text-ink"}`}>{shown === null ? "—" : `${shown}%`}</p>
        <p className="truncate text-sm text-muted">
          {p.mocks.length > 0
            ? `${p.mocks.length} mock${p.mocks.length > 1 ? "s" : ""} · target ${TARGET}%`
            : p.overall.last
              ? `${p.overall.last.title} · target ${TARGET}%`
              : "No marks returned yet"}
          {p.change !== null && ` · ${p.change > 0 ? "+" : ""}${p.change} pts since the first`}
        </p>
        <TabButton tab="progress" className={`${BUTTON} mt-4`}>
          See progress
        </TabButton>
      </section>
      <section className={card}>
        <h2 className={LABEL}>New in your class</h2>
        <p className="mt-2 text-3xl font-semibold text-ink">{fresh.length}</p>
        <p className="truncate text-sm text-muted">{fresh[0] ? `Latest: ${fresh[0].title}` : "Nothing new since your last visit"}</p>
        <TabButton tab="classroom" className={`${BUTTON} mt-4`}>
          See what&rsquo;s new
        </TabButton>
      </section>
    </>
  );
}
