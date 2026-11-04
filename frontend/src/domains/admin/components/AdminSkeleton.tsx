import { Bone } from "@/domains/mocks/components/MockSkeletons";

/** Any admin page while it loads: the sidebar stays (it's the layout), the page area shimmers as a heading, figures and a table. */
export function AdminSkeleton() {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-2">
        <Bone className="h-3 w-32" />
        <Bone className="h-8 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bone key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 bg-surface/40 p-4">
            <Bone className="size-8 shrink-0 rounded-full" />
            <Bone className="h-4 flex-1" />
            <Bone className="hidden h-4 w-24 sm:block" />
            <Bone className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
