"use client";

import type { ComponentProps, MouseEvent } from "react";

import { siteConfig } from "@/core/config/site";

import { ButtonLink } from "./ButtonLink";

type BookButtonProps = Omit<ComponentProps<typeof ButtonLink>, "href" | "children"> & { label?: string };

/**
 * The one booking CTA. Pages with their own `#book` panel (home, courses,
 * consulting) scroll to it in place; every other page goes to the home panel.
 */
export function BookButton({ label = siteConfig.navCta.label, onClick, ...props }: BookButtonProps) {
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const panel = document.getElementById("book");
    if (!panel) return;
    event.preventDefault();
    panel.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", "#book");
  };
  return (
    <ButtonLink {...props} href={siteConfig.navCta.href} onClick={go}>
      {label}
    </ButtonLink>
  );
}
