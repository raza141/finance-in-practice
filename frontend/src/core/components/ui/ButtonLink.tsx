import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Gold = conversion. Use only for revenue actions.
  primary:
    "bg-gold text-canvas hover:bg-gold-bright shadow-[0_0_0_1px_rgb(212_175_55/0.4),0_8px_30px_-8px_rgb(212_175_55/0.5)]",
  // Cyan outline = exploration / technical.
  secondary: "border border-quant/60 text-quant hover:border-quant hover:bg-quant/10",
  ghost: "text-muted hover:text-ink",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-mono font-semibold whitespace-nowrap transition-colors duration-200 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
