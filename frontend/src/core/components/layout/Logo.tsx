import Image from "next/image";

import logo from "../../../../public/brand/fip-logo.png";

interface LogoProps {
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * The FiP brand lockup (monogram, wordmark and tagline) from
 * public/brand/fip-logo.png. Light artwork: render on dark surfaces only.
 */
export function Logo({ height = 32, className = "", priority = false }: LogoProps) {
  const width = Math.round((height * logo.width) / logo.height);
  return (
    <Image
      src={logo}
      alt="Finance in Practice"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
