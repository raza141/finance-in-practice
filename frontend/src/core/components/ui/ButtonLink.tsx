import Link from "next/link";
import type { ComponentProps } from "react";

import { RAISED_GOLD, RAISED_PLAIN } from "./buttonStyles";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Gold = conversion. Use only for revenue actions.
  primary: RAISED_GOLD,
  // Cyan outline = exploration / technical.
  secondary: RAISED_PLAIN,
  ghost: "text-muted transition-colors duration-200 hover:text-ink",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
