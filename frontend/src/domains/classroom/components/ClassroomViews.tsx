import { siteConfig } from "@/core/config/site";
import { TabButton } from "@/domains/students/components/StudentPortal";

import { ClassFeed, type Progress } from "../services/ClassFeed";
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
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1e8e3e] px-3.5 text-sm font-semibold text-white hover:bg-[#188038]"
          >
            {item.kind === "quiz" && item.status !== "done" && item.status !== "returned" ? "Start in Classroom" : "Open in Classroom"} <span aria-hidden>↗</span>
          </a>
        )}
        {item.files.map((f) => (
          <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="inline-flex h-9 max-w-64 items-center rounded-md border border-line px-3 text-sm text-ink/90 hover:border-quant/60">
            <span className="truncate">{f.title}</span>
            <span aria-hidden className="ml-1.5 text-muted">↗</span>
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

/** Classroom tab, top: everything posted in the student's classes, with their to-do on the side. */
export async function ClassFeedPanel({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status === "off") return null;
  if (r.status === "error") return unavailable;
  const { feed } = r;
  const todo = ClassFeed.todo(feed.items);
  const notJoined = feed.classes.filter((c) => !c.joined);
  // The latest few up front; older posts fold away (native <details>, no JS).
  const shown = feed.items.slice(0, FIRST);
  const older = feed.items.slice(FIRST, 60);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="feed-heading" className={CARD}>
        <h2 id="feed-heading" className="text-2xl font-normal italic">
          New in your class
        </h2>
        {notJoined.length > 0 && (
          <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-ink">
            We can&rsquo;t see you in {notJoined.map((c) => c.title).join(", ")} yet. Join with <span className="font-semibold">{feed.email}</span>{" "}
            using the button below, or tell your instructor which Google account you use there. Until then you see shared posts only.
          </p>
        )}
        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing posted yet. Quizzes, homework and files your instructor posts in Classroom appear here.</p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-line/60">
              {shown.map((item) => (
                <Item key={`${item.classTitle}-${item.id}`} item={item} fresh={ClassFeed.isNew(item, feed.seenAt)} />
              ))}
            </ul>
            {older.length > 0 && (
              <details className="group border-t border-line/60 pt-4">
                <summary className="cursor-pointer text-sm text-quant hover:underline">
                  <span className="group-open:hidden">Show {older.length} earlier posts</span>
                  <span className="hidden group-open:inline">Hide earlier posts</span>
                </summary>
                <ul className="divide-y divide-line/60">
                  {older.map((item) => (
                    <Item key={`${item.classTitle}-${item.id}`} item={item} fresh={false} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
      <aside aria-labelledby="todo-heading" className={`${CARD} lg:sticky lg:top-40`}>
        <h2 id="todo-heading" className={LABEL}>
          Your to-do
        </h2>
        {todo.length === 0 ? (
          <p className="mt-3 text-sm text-muted">All done. Nothing waiting to hand in.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {todo.map((i) => (
              <li key={`${i.classTitle}-${i.id}`} className="grid gap-1 text-sm">
                {i.link ? (
                  <a href={i.link} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-quant">
                    {i.title} <span aria-hidden className="text-muted">↗</span>
                  </a>
                ) : (
                  <span className="font-semibold text-ink">{i.title}</span>
                )}
                <span className={i.status === "missing" ? "text-red-300" : "text-muted"}>
                  {i.status === "missing" ? "Missing" : i.dueAt ? `Due ${dayTime(i.dueAt)}` : "No due date"} · {i.classTitle}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/** Mock scores over time as a small inline SVG (no chart library). */
function Chart({ mocks, W, className }: { mocks: Progress["mocks"]; W: number; className: string }) {
  const H = 220;
  const pad = { l: 36, r: 16, t: 34, b: 28 };
  const x = (i: number) => pad.l + (mocks.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (mocks.length - 1)) * (W - pad.l - pad.r));
  const y = (pct: number) => pad.t + (1 - pct / 100) * (H - pad.t - pad.b);
  const line = mocks.map((m, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(m.pct).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Mock scores: ${mocks.map((m) => `${m.title} ${m.pct}%`).join(", ")}`} className={`mt-4 w-full ${className}`}>
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
      {mocks.map((m, i) => (
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

/** Progress tab: mock trend, stats and the weakest topics, each with a way to book a review. */
export async function ProgressPanel({ result }: { result: Promise<FeedResult> }) {
  const r = await result;
  if (r.status === "off") return null;
  if (r.status === "error") return unavailable;
  const p = ClassFeed.progress(r.feed.items);
  if (p.mocks.length === 0 && p.topics.length === 0) {
    return (
      <section className={CARD}>
        <h2 className="text-2xl font-normal italic">Your progress</h2>
        <p className="mt-3 text-sm text-muted">Your mock and quiz marks appear here once your instructor returns them in Classroom.</p>
      </section>
    );
  }
  const last = p.mocks.at(-1);
  const stats: [string, string][] = [
    ["Latest mock", p.latest === null ? "—" : `${p.latest}%`],
    ["Average", p.average === null ? "—" : `${p.average}%`],
    ["Best", p.best === null ? "—" : `${p.best}%`],
    ["Since first mock", p.change === null ? "—" : `${p.change > 0 ? "+" : ""}${p.change} pts`],
  ];
  return (
    <div className="grid gap-6">
      {last && last.pct < TARGET && (
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
        {p.mocks.length > 0 ? (
          <>
            {/* Narrower drawing on phones, so the labels stay readable. */}
            <Chart mocks={p.mocks} W={340} className="sm:hidden" />
            <Chart mocks={p.mocks} W={640} className="hidden sm:block" />
            <ol className="mt-4 divide-y divide-line/60 text-sm">
              {p.mocks.map((m, i) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="mr-2 font-mono text-muted">{i + 1}</span>
                    {m.title}
                    <span className="text-muted"> · {day(m.at)}</span>
                  </span>
                  <span className="flex items-center gap-4">
                    <span className={`font-semibold ${m.pct < TARGET ? "text-gold" : "text-quant"}`}>{m.pct}%</span>
                    {m.link && (
                      <a href={m.link} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                        Review ↗
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted">No mock marks yet. Mocks are the work your instructor posts under &ldquo;Mock exams&rdquo;.</p>
        )}
      </section>
      {p.topics.length > 0 && (
        <section aria-labelledby="topics-heading" className={CARD}>
          <h2 id="topics-heading" className={LABEL}>
            Quizzes by topic
          </h2>
          <ul className="mt-4 grid gap-4">
            {p.topics.map((t) => (
              <li key={t.name} className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-ink">
                    {t.name} <span className="text-muted">· {t.count} marked</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`font-semibold ${t.pct < TARGET ? "text-gold" : "text-quant"}`}>{t.pct}%</span>
                    {t.pct < TARGET && (
                      <TabButton tab="book" notes={`Review: ${t.name} (${t.pct}% on quizzes)`} className="text-xs text-gold hover:underline">
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
      )}
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
  const card = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md";
  return (
    <>
      <section className={card}>
        <h2 className={LABEL}>Class to-do</h2>
        <p className="mt-2 text-3xl font-semibold text-ink">{soon.length}</p>
        <p className="text-sm text-muted">due in the next 7 days{missing.length > 0 && <span className="text-red-300"> · {missing.length} missing</span>}</p>
        {soon[0] && <p className="mt-2 truncate text-sm text-ink/90">Next: {soon[0].title}</p>}
        <TabButton tab="classroom" className="mt-3 text-sm text-quant hover:underline">
          Open to-do →
        </TabButton>
      </section>
      <section className={card}>
        <h2 className={LABEL}>Latest mock</h2>
        <p className={`mt-2 text-3xl font-semibold ${p.latest !== null && p.latest < TARGET ? "text-gold" : "text-ink"}`}>{p.latest === null ? "—" : `${p.latest}%`}</p>
        <p className="text-sm text-muted">
          {p.mocks.length === 0 ? "No marks returned yet" : `${p.mocks.length} mock${p.mocks.length > 1 ? "s" : ""} · target ${TARGET}%`}
          {p.change !== null && ` · ${p.change > 0 ? "+" : ""}${p.change} pts since the first`}
        </p>
        <TabButton tab="progress" className="mt-3 text-sm text-quant hover:underline">
          See progress →
        </TabButton>
      </section>
      <section className={card}>
        <h2 className={LABEL}>New in your class</h2>
        <p className="mt-2 text-3xl font-semibold text-ink">{fresh.length}</p>
        <p className="truncate text-sm text-muted">{fresh[0] ? `Latest: ${fresh[0].title}` : "Nothing new since your last visit"}</p>
        <TabButton tab="classroom" className="mt-3 text-sm text-quant hover:underline">
          Open Classroom →
        </TabButton>
      </section>
    </>
  );
}
