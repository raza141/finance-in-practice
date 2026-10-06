"use client";

import { useState, type ReactNode } from "react";

import { logShare, type ShareChannel } from "../actions/invoices";

const BUTTON = "inline-flex h-9 items-center rounded-md border border-line px-3 text-sm text-muted transition-colors hover:text-ink";

/**
 * Every way to share an issued document. WhatsApp uses click-to-chat (wa.me),
 * which cannot attach files: the message carries the document link, or the
 * downloaded PDF is attached by hand.
 * ponytail: a WhatsApp Business API sender would be another button here, behind its own setting.
 */
export function SharePanel({
  documentId,
  pdfHref,
  whatsappHref,
  whatsappText,
  phone,
  emailForms,
}: {
  documentId: string;
  pdfHref: string;
  whatsappHref: string;
  whatsappText: string;
  phone: string;
  /** Server-rendered Email and Resend link forms. */
  emailForms: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const log = (channel: ShareChannel) => void logShare(documentId, channel).catch(() => {});

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      log("whatsapp-copy");
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-line p-4">
      <h2 className="text-sm text-quant">Share</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={pdfHref} target="_blank" rel="noreferrer" className={BUTTON}>
          Download PDF ↓
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          onClick={() => log("whatsapp-open")}
          title={phone ? `Opens a chat with ${phone}` : "No phone on this document: WhatsApp will ask which chat"}
          className="inline-flex h-9 items-center rounded-md bg-emerald-500/15 px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25"
        >
          Open WhatsApp
        </a>
        <button type="button" onClick={copy} className={BUTTON}>
          {copied ? "Copied ✓" : "Copy WhatsApp message"}
        </button>
        {emailForms}
      </div>
    </section>
  );
}
