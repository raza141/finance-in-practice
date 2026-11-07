"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * A two-column page whose side panel folds away from tablets up (768px: iPads, laptops): closed it's a slim rail and the
 * main area takes the room; a tap on the rail opens it. Phones stack the panel under the main area, always open.
 */
export function SidePanel({ label, main, rail, children }: { label: string; main: ReactNode; rail: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? PanelRightClose : PanelRightOpen;
  return (
    <div className={`grid items-start gap-6 ${open ? "md:grid-cols-[minmax(0,1fr)_20rem] lg:grid-cols-[minmax(0,1fr)_22rem]" : "md:grid-cols-[minmax(0,1fr)_3.5rem]"}`}>
      {main}
      <aside aria-label={label} className="grid gap-3 md:sticky md:top-24">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`hidden items-center gap-2 rounded-2xl border border-white/10 bg-canvas/70 p-3 text-sm text-muted backdrop-blur-md transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-quant md:flex ${open ? "" : "flex-col"}`}
        >
          <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0" />
          <span className={open ? "" : "sr-only"}>{open ? "Hide" : "Show"} {label.toLowerCase()}</span>
          {!open && rail}
        </button>
        <div className={`grid gap-6 ${open ? "" : "md:hidden"}`}>{children}</div>
      </aside>
    </div>
  );
}
