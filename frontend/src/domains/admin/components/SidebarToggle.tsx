"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect } from "react";

const KEY = "admin-sidebar-hidden";
const ATTR = "data-admin-sidebar-hidden";

/** Hides the admin sidebar on desktop for more working room; remembered per browser. The label swaps via CSS. */
export function SidebarToggle() {
  useEffect(() => {
    try {
      document.documentElement.toggleAttribute(ATTR, localStorage.getItem(KEY) === "1");
    } catch {}
  }, []);

  const toggle = () => {
    const hidden = document.documentElement.toggleAttribute(ATTR);
    try {
      localStorage.setItem(KEY, hidden ? "1" : "0");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="mb-4 hidden h-8 items-center rounded-btn border border-line px-3 font-mono text-[11px] tracking-wider text-muted uppercase transition-colors hover:text-ink md:inline-flex"
    >
      <span className="admin-sidebar-hide inline-flex items-center gap-1.5">
        <PanelLeftClose aria-hidden className="size-4" /> Hide menu
      </span>
      <span className="admin-sidebar-show inline-flex items-center gap-1.5">
        <PanelLeftOpen aria-hidden className="size-4" /> Show menu
      </span>
    </button>
  );
}
