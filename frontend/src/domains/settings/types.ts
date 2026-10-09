import type { Currency, DocumentLayout, ItemUnit, PaymentTerms } from "@/domains/invoices/types";

/** Documents the billing engine issues. Statements are generated, not stored, so they have no number. */
export type DocumentType = "invoice" | "receipt" | "quote" | "credit_note";

/** Client-facing text for one document type. Message templates take {placeholders}. */
export interface DocumentTexts {
  /** One term per line, "Title: text". */
  terms: string;
  /** Default notes printed on the document. */
  notes: string;
  whatsapp: string;
  /** The opening line of the email. */
  email: string;
}

/** How one billing unit prints and prefills: "2 sessions", default AED 450, standard layout. */
export interface UnitConfig {
  /** Singular word printed after the quantity, e.g. "session". */
  label: string;
  /** Prefilled unit price, in minor units; null leaves it empty. */
  rateMinor: number | null;
  layout: DocumentLayout;
}

/** Business-wide billing settings, edited in /admin/settings. */
export interface BillingSettings {
  business: {
    name: string;
    /** The name documents and messages are signed with. */
    sender: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  vat: {
    registered: boolean;
    /** 15-digit UAE Tax Registration Number; required once registered. */
    trn: string;
    /** Basis points: 500 = 5%. */
    rateBp: number;
  };
  currency: Currency;
  /** Terms a new invoice starts with when neither an agreement nor the client sets them. */
  terms: { default: PaymentTerms; days: number | null };
  units: Record<ItemUnit, UnitConfig>;
  prefixes: Record<DocumentType, string>;
  documents: Record<DocumentType, DocumentTexts>;
  card: {
    show: boolean;
    note: string;
  };
}
