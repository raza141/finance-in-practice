import { ArrowLeft } from "lucide-react";
import { RAISED_PLAIN } from "@/core/components/ui/buttonStyles";

/** The way out of a mock screen (instructions, paused exam, results) to the portal: a pill with an arrow that nudges left on hover. */
export function BackToPortal({ href = "/student?tab=mocks", label = "Back to portal" }: { href?: string; label?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex h-9 shrink-0 items-center gap-2 rounded-btn pr-4 pl-1 text-sm font-semibold whitespace-nowrap ${RAISED_PLAIN}`}
    >
      <span className="grid size-7 place-items-center rounded-md [corner-shape:squircle] bg-quant/15 transition-transform group-hover:-translate-x-0.5">
        <ArrowLeft aria-hidden strokeWidth={2} className="size-4" />
      </span>
      {label}
    </a>
  );
}
