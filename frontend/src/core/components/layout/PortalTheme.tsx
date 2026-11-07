"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The portal's light/dark switch (docs/brand.md §3). Only /student pages ever go light; the website stays dark.
 * The choice lives on the device; with none, the device's own setting decides.
 */
const KEY = "fip-theme";

/** Runs before first paint (root layout), so a light-theme student never sees a dark flash. Same rule as `apply`. */
export const THEME_PREPAINT = `(function(){try{var t=localStorage.getItem("${KEY}")||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");if(location.pathname.indexOf("/student")===0&&t==="light")document.documentElement.dataset.theme="light"}catch(e){}})();`;

function apply(pathname: string) {
  const choice = localStorage.getItem(KEY) ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  if (pathname.startsWith("/student") && choice === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

/** Keeps the theme right on client-side navigation: leaving the portal for the website turns it back to dark. */
export function PortalThemeSync() {
  const pathname = usePathname();
  useEffect(() => apply(pathname), [pathname]);
  return null;
}

/** Sun/moon button: icons swap by CSS, so the server render never mismatches the device's choice. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = () => {
    localStorage.setItem(KEY, document.documentElement.dataset.theme === "light" ? "dark" : "light");
    apply(location.pathname);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`grid size-9 shrink-0 place-items-center rounded-btn text-muted transition-colors hover:bg-ink/5 hover:text-ink ${className}`}
    >
      <Sun aria-hidden className="size-5 light:hidden" />
      <Moon aria-hidden className="hidden size-5 light:block" />
      <span className="sr-only">Switch light or dark theme</span>
    </button>
  );
}
