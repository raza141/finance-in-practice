interface LogoProps {
  /** Rendered height in px; width follows the 132:48 glyph ratio. */
  height?: number;
  withWordmark?: boolean;
  className?: string;
}

/**
 * The [ F | P ] matrix-bracket monogram: Finance (theory) encapsulated in
 * Practice (code). Cyan brackets, ink letterforms, hairline gold divider.
 * Letterforms are stroked paths, so the glyph never depends on font loading.
 */
export function Logo({ height = 32, withWordmark = false, className = "" }: LogoProps) {
  const width = (height * 132) / 48;
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 132 48"
        role="img"
        aria-label="Finance in Practice"
        fill="none"
        strokeLinecap="square"
        strokeLinejoin="miter"
      >
        {/* [ and ] */}
        <path d="M15 6H6V42H15" stroke="var(--color-quant)" strokeWidth={3.5} />
        <path d="M117 6H126V42H117" stroke="var(--color-quant)" strokeWidth={3.5} />
        {/* F */}
        <path d="M30 37V11H47M30 24H43" stroke="var(--color-ink)" strokeWidth={3.5} />
        {/* | */}
        <path d="M66 8V40" stroke="var(--color-gold)" strokeWidth={1.5} strokeLinecap="butt" />
        {/* P */}
        <path
          d="M86 37V11H96.5A6.5 6.5 0 0 1 96.5 24H86"
          stroke="var(--color-ink)"
          strokeWidth={3.5}
        />
      </svg>
      {withWordmark && (
        <span className="font-serif text-[15px] leading-tight font-bold tracking-tight text-ink">
          Finance <span className="font-normal text-muted italic">in</span> Practice
        </span>
      )}
    </span>
  );
}
