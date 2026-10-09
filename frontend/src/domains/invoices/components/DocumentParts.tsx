import type { ReactNode } from "react";

import { Logo } from "@/core/components/layout/Logo";
import { WHATSAPP_GLYPH } from "@/core/components/ui/WhatsAppButton";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";

/** The tagline from the logo artwork. */
const TAGLINE = "Learn Finance the way it is practiced.";

/** Gold, letter-spaced section label: From, Bill to, Details, Payment desk, Terms. */
export const LABEL = "font-mono text-[11px] font-semibold tracking-[0.25em] text-gold uppercase";
/** Row label inside a section. */
export const ROW_LABEL = "font-mono text-[11px] tracking-[0.18em] whitespace-nowrap text-slate-500 uppercase";

const STAMP: Record<string, string> = {
  paid: "border-emerald-400 text-emerald-300",
  accepted: "border-emerald-400 text-emerald-300",
  void: "border-red-400 text-red-300",
  declined: "border-red-400 text-red-300",
  expired: "border-gold text-gold",
  draft: "border-slate-400 text-slate-300",
};

/**
 * The paper every billing document prints on: navy header with the logo, the
 * title and number, and the navy tagline footer. In print it fills the A4 page
 * (just under 297mm, so rounding never adds a blank page) and the footer sits
 * at the bottom edge. Site palette on white; the
 * navy bands force background printing so the light logo stays visible.
 */
export function DocumentFrame({
  title,
  number,
  stamp,
  settings,
  children,
}: {
  title: string;
  number: string | null;
  /** Status shown beside the number, e.g. "paid" or "void". */
  stamp?: string | null;
  settings: BillingSettings;
  children: ReactNode;
}) {
  const { business } = settings;
  return (
    <article
      data-invoice
      className="mx-auto w-full max-w-3xl overflow-hidden bg-white font-sans text-slate-800 shadow-xl [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:flex print:min-h-[296mm] print:max-w-none print:flex-col print:shadow-none"
    >
      <header className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-gold bg-canvas bg-grid-lines px-8 py-7 sm:px-12 print:py-5">
        <Logo height={44} />
        <div className="text-right">
          <h1 className="font-serif text-3xl font-bold tracking-[0.12em] text-white uppercase">{title}</h1>
          <div className="mt-1 flex items-center justify-end gap-3">
            {stamp && STAMP[stamp] && (
              <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase ${STAMP[stamp]}`}>{stamp}</span>
            )}
            {number && <span className="font-mono text-lg text-gold">{number}</span>}
          </div>
        </div>
      </header>
      <div className="px-8 py-10 sm:px-12 print:flex print:flex-1 print:flex-col print:py-6">{children}</div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t-4 border-gold bg-canvas bg-grid-lines px-8 py-6 sm:px-12 print:py-4">
        <p className="font-mono text-xs font-semibold tracking-[0.25em] text-gold uppercase">{TAGLINE}</p>
        <p className="text-xs text-slate-300">{[business.website, business.phone].filter(Boolean).join(" · ")}</p>
      </footer>
    </article>
  );
}

/** The business block; the TRN prints only on tax documents (it is snapshotted on the document). */
export function FromBlock({ settings, trn }: { settings: BillingSettings; trn: string }) {
  const { business } = settings;
  return (
    <div>
      <h2 className={LABEL}>From</h2>
      <p className="mt-3 font-serif text-lg font-bold text-canvas">{business.name}</p>
      <p className="mt-1 text-slate-500">
        {[business.sender, business.address, business.phone, business.email, business.website, trn && `TRN: ${trn}`].filter(Boolean).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
    </div>
  );
}

/** "Thank you, Khawla." callout beside the WhatsApp and booking rows. */
export function ThankYou({ firstName, message, settings }: { firstName: string; message: string; settings: BillingSettings }) {
  return (
    <section className="mt-10 grid break-inside-avoid gap-8 border-t border-slate-200 pt-8 print:mt-5 print:pt-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
      <div className="border-l-4 border-gold pl-5">
        <h2 className="font-serif text-xl font-bold text-canvas">Thank you{firstName ? `, ${firstName}` : ""}.</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
      </div>
      <dl className="grid h-fit grid-cols-[1.25rem_auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
        <Icon path={WHATSAPP_GLYPH} fill />
        <dt className={ROW_LABEL}>WhatsApp</dt>
        <dd className="font-semibold text-slate-900">{settings.business.phone}</dd>
        <Icon path="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <dt className={ROW_LABEL}>Book</dt>
        <dd className="font-semibold text-slate-900">{settings.business.website}</dd>
      </dl>
    </section>
  );
}

/** Numbered terms from Settings ("Title: text" per line); nothing when empty. */
/** The numbered terms from Settings; `omit` drops the term with that title (e.g. "Payment" once an invoice is paid). */
export function TermsBlock({ text, omit }: { text: string; omit?: string }) {
  const terms = SettingsContract.terms(text).filter(([title]) => !omit || title.toLowerCase() !== omit.toLowerCase());
  if (terms.length === 0) return null;
  return (
    <section className="mt-10 break-inside-avoid print:mt-6">
      <h2 className={LABEL}>Terms</h2>
      <ol className="mt-3 grid list-decimal gap-1.5 pl-5 print:mt-2 print:gap-1 text-xs leading-relaxed text-slate-500 marker:text-slate-500">
        {terms.map(([title, body], index) => (
          <li key={index}>
            {title && <span className="font-semibold text-slate-900">{title}:</span>} {body}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** A labelled block of free text (notes, consultancy sections); nothing when empty. */
export function TextBlock({ title, text, className = "mt-8 print:mt-5" }: { title: string; text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <section className={`${className} break-inside-avoid`}>
      <h2 className={LABEL}>{title}</h2>
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-600">{text}</p>
    </section>
  );
}

/** An 18px icon in the contact rows: WhatsApp is a filled glyph, the rest are outline icons. */
function Icon({ path, fill = false }: { path: string; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      className="text-slate-900"
      {...(fill ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" })}
    >
      <path d={path} />
    </svg>
  );
}
