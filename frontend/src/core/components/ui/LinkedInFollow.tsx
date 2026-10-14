import { siteConfig } from "@/core/config/site";

/** LinkedIn's "in" mark (one path, no image request). */
export const LINKEDIN_GLYPH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.65 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

/**
 * "Follow Finance in Practice" on the company LinkedIn page. `button`: the
 * blue LinkedIn card (same look as an instructor's Connect button); `pill`: a
 * compact outline link for footers and secondary spots.
 */
export function LinkedInFollow({ variant = "button", note = "Exam tips, articles and new courses", className = "" }: { variant?: "button" | "pill"; note?: string; className?: string }) {
  const href = siteConfig.contact.linkedinUrl;
  if (variant === "pill") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-full border border-[#0A66C2]/60 bg-[#0A66C2]/10 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-[#0A66C2]/25 ${className}`}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="#0A66C2" aria-hidden className="rounded-[3px] bg-white">
          <path d={LINKEDIN_GLYPH} />
        </svg>
        Follow us on LinkedIn
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-3 rounded-xl bg-[#0A66C2] py-2.5 pr-5 pl-2.5 text-white shadow-[0_10px_34px_-12px_rgb(10_102_194/0.9)] transition hover:-translate-y-0.5 hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quant ${className}`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2" aria-hidden>
          <path d={LINKEDIN_GLYPH} />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Follow {siteConfig.name}</span>
        <span className="text-xs text-white/75">{note}</span>
      </span>
    </a>
  );
}
