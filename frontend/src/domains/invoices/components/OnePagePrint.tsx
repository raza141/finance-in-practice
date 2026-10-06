"use client";

import { useEffect } from "react";

/** A4 height in CSS pixels (297mm at 96dpi), less a little slack for rounding. */
const PAGE_HEIGHT_PX = 1120;

/** Full-bleed A4 with only the invoice: no site chrome, no browser margins or headers. */
const PRINT_CSS =
  "@media print{body>:not(main){display:none!important}html,body{background:#fff!important}main{padding-top:0!important}@page{size:A4;margin:0}}";

/**
 * Keeps the printed / saved-as-PDF invoice on one A4 page: just before printing,
 * the invoice is laid out at A4 width and zoomed down only if it would spill over.
 */
export function OnePagePrint() {
  useEffect(() => {
    const before = () => {
      const invoice = document.querySelector<HTMLElement>("[data-invoice]");
      if (!invoice) return;
      invoice.style.zoom = "";
      invoice.style.width = "210mm";
      invoice.style.maxWidth = "none";
      invoice.style.zoom = String(Math.min(1, PAGE_HEIGHT_PX / invoice.scrollHeight));
    };
    const after = () => {
      const invoice = document.querySelector<HTMLElement>("[data-invoice]");
      invoice?.style.removeProperty("zoom");
      invoice?.style.removeProperty("width");
      invoice?.style.removeProperty("max-width");
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return <style>{PRINT_CSS}</style>;
}
