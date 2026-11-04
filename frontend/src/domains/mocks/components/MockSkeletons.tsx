import type { ReactNode } from "react";

/**
 * What a mock page shows while the server loads it (each route's loading.tsx): the page's own shape
 * in shimmering placeholders, so a click answers at once instead of a blank screen.
 */

/** One placeholder block; size and shape come from `className`. */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`shimmer rounded-md ${className}`} />;
}

/** The frame: the bar with the logo's place, then the page. Announced once to screen readers. */
function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="status" className="-mt-20 min-h-screen bg-canvas bg-grid-lines">
      <span className="sr-only">Loading {label}…</span>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Bone className="h-7 w-40" />
          <Bone className="h-9 w-32 rounded-btn" />
        </div>
      </header>
      {children}
    </div>
  );
}

const CARD = "rounded-2xl border border-line bg-surface/60 p-5 sm:p-6";

/** The instruction screen: title, four facts, the tools and the timing cards, the Begin bar. */
export function InstructionsSkeleton() {
  return (
    <Frame label="the exam instructions">
      <div className="page-container grid max-w-4xl gap-6 py-8 lg:py-12">
        <div className="grid gap-2">
          <Bone className="h-3 w-40" />
          <Bone className="h-8 w-2/3" />
          <Bone className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-2 rounded-2xl border border-line bg-surface/60 p-4">
              <Bone className="h-3 w-16" />
              <Bone className="h-6 w-20" />
            </div>
          ))}
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className={`grid gap-4 ${CARD}`}>
            <Bone className="h-3 w-32" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Bone className="size-8 shrink-0 rounded-lg" />
                <div className="grid flex-1 gap-1.5">
                  <Bone className="h-4 w-24" />
                  <Bone className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className={`grid gap-3 ${CARD}`}>
            <Bone className="h-3 w-36" />
            {[0, 1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
        <Bone className="h-20 w-full rounded-2xl" />
      </div>
    </Frame>
  );
}

/** The exam: the timer bar, the question numbers, a question with three options. */
export function ExamSkeleton() {
  return (
    <Frame label="your exam">
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[13rem_1fr]">
        <div className="grid h-fit grid-cols-8 gap-1.5 sm:grid-cols-12 lg:grid-cols-5">
          {Array.from({ length: 20 }, (_, i) => (
            <Bone key={i} className="h-9" />
          ))}
        </div>
        <div className={`grid content-start gap-4 ${CARD}`}>
          <Bone className="h-3 w-28" />
          <Bone className="h-5 w-full" />
          <Bone className="h-5 w-11/12" />
          <Bone className="h-5 w-3/5" />
          <div className="mt-2 grid gap-3">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Results, notes and the notebook: a heading, a summary row, then cards. */
export function PageSkeleton() {
  return (
    <Frame label="the page">
      <div className="page-container grid gap-6 py-8 lg:py-10">
        <div className="grid gap-2">
          <Bone className="h-3 w-40" />
          <Bone className="h-8 w-1/2" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`grid gap-3 ${CARD}`}>
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </Frame>
  );
}
