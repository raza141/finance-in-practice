"use client";

import { useEffect } from "react";

/** Opens the print dialog ("Save as PDF") once the page and its fonts have loaded. */
export function AutoPrint() {
  useEffect(() => {
    void document.fonts.ready.then(() => window.print());
  }, []);
  return null;
}
