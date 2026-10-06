import type { Currency } from "@/domains/invoices/types";

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
  prefixes: Record<DocumentType, string>;
  documents: Record<DocumentType, DocumentTexts>;
  card: {
    show: boolean;
    note: string;
  };
}
