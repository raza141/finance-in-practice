import type { BillingSettings } from "@/domains/settings/types";

import type { Invoice } from "../types";
import { InvoiceDocument } from "./InvoiceDocument";
import { ReceiptDocument } from "./ReceiptDocument";

/** The right printed template for a document: receipts are compact, the rest share the invoice layout. */
export function DocumentView({ doc, settings }: { doc: Invoice; settings: BillingSettings }) {
  return doc.docType === "receipt" ? <ReceiptDocument receipt={doc} settings={settings} /> : <InvoiceDocument invoice={doc} settings={settings} />;
}
