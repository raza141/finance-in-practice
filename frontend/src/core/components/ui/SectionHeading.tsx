interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  id?: string;
}

export function SectionHeading({ eyebrow, title, lede, align = "left", id }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    // Only the lede is capped (readable line length); short titles stay on one line on desktop.
    <div className={centered ? "text-center" : ""} data-anim="reveal">
      <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl leading-tight font-bold sm:text-4xl">
        {title}
      </h2>
      {lede && <p className={`mt-4 max-w-2xl text-base ${centered ? "mx-auto" : ""} leading-relaxed text-muted sm:text-lg`}>{lede}</p>}
    </div>
  );
}
