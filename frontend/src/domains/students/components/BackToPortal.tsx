import { RAISED_PLAIN } from "@/core/components/ui/buttonStyles";

/** The way out of a mock screen (instructions, paused exam, results) to the portal: a pill with an arrow that nudges left on hover. */
export function BackToPortal({ href = "/student", label = "Back to portal" }: { href?: string; label?: string }) {
  return (
    <a
      href={href}
      className={`group inline-flex h-9 shrink-0 items-center gap-2 rounded-full pr-4 pl-1 text-sm font-semibold whitespace-nowrap ${RAISED_PLAIN}`}
    >
      <span className="grid size-7 place-items-center rounded-full bg-quant/15 transition-transform group-hover:-translate-x-0.5">
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
          <path d="M16 10H4M9 5l-5 5 5 5" />
        </svg>
      </span>
      {label}
    </a>
  );
}
