"use client";

import { useEffect } from "react";

import { recordInvoiceView } from "../actions/views";

/**
 * Records the view from the browser rather than on render, so email link
 * scanners that fetch the page without running scripts don't count as the client.
 */
export function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    void recordInvoiceView(token);
  }, [token]);
  return null;
}
