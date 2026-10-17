interface SectionHeadingProps {
  /** Only where it adds what the title doesn't (a name, "free", context); never a restatement of the title. */
  eyebrow?: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  id?: string;
}

export function SectionHeading({ eyebrow, title, lede, align = "left", id }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    // Only the lede is capped (readable line length); short titles stay on one line on desktop.
    <div className={centered ? "text-center" : ""}>
      {eyebrow && <p className="mb-3 font-mono text-xs tracking-[0.2em] text-quant uppercase">{eyebrow}</p>}
      <h2 id={id} className="text-3xl leading-[1.1] font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {lede && <p className={`mt-4 max-w-2xl text-base ${centered ? "mx-auto" : ""} leading-relaxed text-muted sm:text-lg`}>{lede}</p>}
    </div>
  );
}
