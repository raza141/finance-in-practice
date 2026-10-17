"use client";

import { useEffect } from "react";

import { recordInvoiceView } from "../actions/views";

/**
 * Records the view from the browser rather than on render, so email link
 * scanners that fetch the page without running scripts don't count as the client.
 * Neither does the WhatsApp gateway (whatsapp-gateway/), which prints it to a PDF.
 */
export function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    // The WhatsApp gateway printing the PDF isn't the client opening it.
    if (navigator.userAgent.includes("FIPWhatsAppGateway")) return;
    void recordInvoiceView(token);
  }, [token]);
  return null;
}
