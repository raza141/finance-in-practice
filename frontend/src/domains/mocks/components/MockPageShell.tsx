import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/core/components/layout/Logo";
import { BackToPortal } from "@/domains/students/components/BackToPortal";

/** The frame of a mock's revision pages (results, notebook, notes): the logo, Back to portal, and the still grid. Prints as plain paper. */
export function MockPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative -mt-20 min-h-screen overflow-clip print:mt-0 print:bg-white print:text-black">
      {/* The page's grid, still: no animation behind a mock's results. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-canvas bg-grid-lines print:hidden" />
      <header className="sticky top-0 z-30 bg-canvas bg-grid-lines bg-fixed print:hidden">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Finance in Practice website">
            <Logo height={30} priority />
          </Link>
          <BackToPortal />
        </div>
      </header>
      <div className="page-container relative py-8 lg:py-10 print:py-0">{children}</div>
    </div>
  );
}
