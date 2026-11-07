import { Bone } from "@/domains/mocks/components/MockSkeletons";

/** The portal while it loads (its sessions, plan, mocks and account): the bar with its tabs, then cards in place. */
export function PortalSkeleton() {
  return (
    <div role="status" className="-mt-20 min-h-screen bg-canvas bg-grid-lines">
      <span className="sr-only">Loading your portal…</span>
      <header className="nav-line sticky top-0 z-30 bg-canvas">
        <div className="page-container flex h-16 items-center justify-between gap-6">
          <Bone className="h-7 w-40" />
          <div className="hidden gap-6 lg:flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-10 w-14" />
            ))}
          </div>
          <Bone className="h-9 w-24 rounded-btn" />
        </div>
      </header>
      <div className="page-container grid gap-6 pt-8 pb-28 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3 rounded-3xl border border-ink/10 bg-canvas/70 p-6">
              <Bone className="h-3 w-24" />
              <Bone className="h-6 w-3/4" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-5/6" />
            </div>
          ))}
        </div>
        <Bone className="h-48 w-full rounded-3xl" />
      </div>
    </div>
  );
}

/** A card still loading inside the portal (the class feed): heading and lines in shimmer. */
export function CardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-3 rounded-3xl border border-ink/10 bg-canvas/70 p-6">
      <span className="sr-only">Loading {label}…</span>
      <Bone className="h-3 w-28" />
      <Bone className="h-4 w-3/4" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-2/3" />
    </div>
  );
}
