import { siteConfig } from "@/core/config/site";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency, DocumentLayout, ItemUnit } from "@/domains/invoices/types";

import type { BillingSettings, DocumentTexts, DocumentType, UnitConfig } from "../types";

export type SettingsFieldErrors = Partial<Record<string, string>>;

const INVOICE_TERMS = [
  "Payment: Due by the date shown above. Sessions are confirmed once payment is received. The invoice number is to be quoted as the transfer reference.",
  "Rescheduling: Sessions can be moved with at least 24 hours’ notice. Later changes may count as delivered.",
  "Scope: Fees cover the coaching period stated on this invoice and are non-transferable. No exam result is guaranteed.",
].join("\n");

const SIGN_OFF = "Thank you,\n{sender}\n{business}";

/** Defaults, validation and reading for BillingSettings. Pure; safe on client and server. */
export class SettingsContract {
  static readonly DOCUMENT_TYPES: Readonly<Record<DocumentType, string>> = {
    invoice: "Invoice",
    receipt: "Receipt",
    quote: "Quote",
    credit_note: "Credit note",
  };

  /** Placeholders the message templates understand. */
  static readonly PLACEHOLDERS = ["firstName", "number", "amount", "balance", "dueDate", "link", "sender", "business"] as const;

  static readonly DEFAULTS: BillingSettings = {
    business: {
      name: siteConfig.name,
      sender: "Ahmed Raza",
      address: "Abu Dhabi, UAE",
      phone: siteConfig.contact.whatsapp.display,
      email: siteConfig.contact.email ?? "",
      website: siteConfig.domain,
    },
    vat: { registered: false, trn: "", rateBp: 500 },
    currency: "AED",
    units: {
      month: { label: "month", rateMinor: null, layout: "standard" },
      session: { label: "session", rateMinor: null, layout: "standard" },
      hour: { label: "hour", rateMinor: null, layout: "standard" },
      milestone: { label: "milestone", rateMinor: null, layout: "consultancy" },
      fee: { label: "fee", rateMinor: null, layout: "consultancy" },
    },
    prefixes: { invoice: "FIP-INV", receipt: "FIP-REC", quote: "FIP-QUO", credit_note: "FIP-CN" },
    documents: {
      invoice: {
        terms: INVOICE_TERMS,
        notes: "",
        whatsapp: `Hi {firstName}, invoice {number} for {amount} is ready, due {dueDate}.\n\nView or download: {link}\n\n${SIGN_OFF}`,
        email: "Invoice {number} for {amount} is ready.",
      },
      receipt: {
        terms: "",
        notes: "",
        whatsapp: `Hi {firstName}, payment of {amount} has been received. Receipt {number}: {link}\n\n${SIGN_OFF}`,
        email: "Payment of {amount} has been received. Receipt {number} is linked below.",
      },
      quote: {
        terms: "Validity: This quote is valid until the date shown.\nAcceptance: Work is scheduled once the quote is accepted in writing.",
        notes: "",
        whatsapp: `Hi {firstName}, quote {number} for {amount} is ready, valid until {dueDate}: {link}\n\n${SIGN_OFF}`,
        email: "Quote {number} for {amount} is ready for review.",
      },
      credit_note: {
        terms: "",
        notes: "",
        whatsapp: `Hi {firstName}, credit note {number} for {amount} has been issued: {link}\n\n${SIGN_OFF}`,
        email: "Credit note {number} for {amount} has been issued.",
      },
    },
    card: { show: false, note: "Card payments may include a processing fee." },
  };

  static readonly LIMITS = { name: 120, sender: 80, address: 200, phone: 40, email: 254, website: 120, terms: 1500, notes: 1000, message: 1000, cardNote: 200 } as const;

  private static readonly PREFIX = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
  private static readonly TRN = /^\d{15}$/;
  private static readonly EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /** Stored settings over the defaults, so keys added later always have a value. Ignores anything malformed. */
  static merge(stored: unknown): BillingSettings {
    const d = SettingsContract.DEFAULTS;
    const s = (stored && typeof stored === "object" ? stored : {}) as Partial<Record<keyof BillingSettings, unknown>>;
    const pick = <T extends object>(base: T, value: unknown): T => {
      const out = { ...base };
      if (!value || typeof value !== "object") return out;
      for (const key of Object.keys(base) as (keyof T)[]) {
        const v = (value as Record<keyof T, unknown>)[key];
        if (typeof v === typeof base[key]) out[key] = v as T[keyof T];
      }
      return out;
    };
    const documents = Object.fromEntries(
      (Object.keys(d.documents) as DocumentType[]).map((type) => [type, pick(d.documents[type], (s.documents as Record<string, unknown> | undefined)?.[type])]),
    ) as Record<DocumentType, DocumentTexts>;
    const storedUnits = (s.units ?? {}) as Record<string, Partial<UnitConfig> | undefined>;
    const units = Object.fromEntries(
      (Object.keys(d.units) as ItemUnit[]).map((unit) => {
        const v = storedUnits[unit] ?? {};
        return [
          unit,
          {
            label: typeof v.label === "string" && v.label ? v.label : d.units[unit].label,
            rateMinor: typeof v.rateMinor === "number" ? v.rateMinor : null,
            layout: v.layout === "consultancy" || v.layout === "standard" ? v.layout : d.units[unit].layout,
          },
        ];
      }),
    ) as Record<ItemUnit, UnitConfig>;
    return {
      business: pick(d.business, s.business),
      vat: pick(d.vat, s.vat),
      currency: InvoiceContract.CURRENCIES.includes(s.currency as Currency) ? (s.currency as Currency) : d.currency,
      units,
      prefixes: pick(d.prefixes, s.prefixes),
      documents,
      card: pick(d.card, s.card),
    };
  }

  /** The settings form, field names as in SettingsForm ("business.name", "doc.invoice.terms", …). */
  static parse(fields: Record<string, unknown>): { ok: true; settings: BillingSettings } | { ok: false; errors: SettingsFieldErrors } {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const { LIMITS } = SettingsContract;
    const errors: SettingsFieldErrors = {};
    const bounded = (name: string, max: number, required = false) => {
      const value = text(name);
      if (required && !value) errors[name] = "Required.";
      else if (value.length > max) errors[name] = `Up to ${max} characters.`;
      return value;
    };

    const business = {
      name: bounded("business.name", LIMITS.name, true),
      sender: bounded("business.sender", LIMITS.sender, true),
      address: bounded("business.address", LIMITS.address),
      phone: bounded("business.phone", LIMITS.phone),
      email: bounded("business.email", LIMITS.email).toLowerCase(),
      website: bounded("business.website", LIMITS.website),
    };
    if (business.email && !SettingsContract.EMAIL.test(business.email)) errors["business.email"] = "Enter a valid email address, or leave it empty.";

    const registered = fields["vat.registered"] === "on";
    const trn = text("vat.trn").replace(/\s/g, "");
    if (trn && !SettingsContract.TRN.test(trn)) errors["vat.trn"] = "A UAE TRN is 15 digits.";
    else if (registered && !trn) errors["vat.trn"] = "Enter the TRN before turning VAT on.";
    const rate = text("vat.rate");
    const rateBp = /^\d{1,2}(\.\d{1,2})?$/.test(rate) ? Math.round(Number(rate) * 100) : NaN;
    if (Number.isNaN(rateBp)) errors["vat.rate"] = "Enter a rate such as 5.";

    const currency = text("currency") as Currency;
    if (!InvoiceContract.CURRENCIES.includes(currency)) errors.currency = "Choose a currency.";

    const units = Object.fromEntries(
      (Object.keys(SettingsContract.DEFAULTS.units) as ItemUnit[]).map((unit) => {
        const label = bounded(`unit.${unit}.label`, 30, true).toLowerCase();
        const rate = text(`unit.${unit}.rate`);
        const rateMinor = rate === "" ? null : InvoiceMath.parseMajor(rate);
        if (rate !== "" && rateMinor === null) errors[`unit.${unit}.rate`] = "Enter a price such as 450, or leave it empty.";
        const layout = text(`unit.${unit}.layout`) as DocumentLayout;
        if (layout !== "standard" && layout !== "consultancy") errors[`unit.${unit}.layout`] = "Choose a layout.";
        return [unit, { label, rateMinor, layout }];
      }),
    ) as Record<ItemUnit, UnitConfig>;
    if (units.milestone.layout !== "consultancy") errors["unit.milestone.layout"] = "Milestones are for consultancy layouts only.";

    const types = Object.keys(SettingsContract.DOCUMENT_TYPES) as DocumentType[];
    const prefixes = Object.fromEntries(types.map((type) => [type, text(`prefix.${type}`).toUpperCase()])) as Record<DocumentType, string>;
    for (const type of types) {
      const prefix = prefixes[type];
      if (!SettingsContract.PREFIX.test(prefix) || prefix.length > 16) errors[`prefix.${type}`] = "Capitals, digits and dashes, e.g. FIP-INV (up to 16).";
      else if (types.some((other) => other !== type && prefixes[other] === prefix)) errors[`prefix.${type}`] = "Each document type needs its own prefix.";
    }

    const documents = Object.fromEntries(
      types.map((type) => [
        type,
        {
          terms: bounded(`doc.${type}.terms`, LIMITS.terms),
          notes: bounded(`doc.${type}.notes`, LIMITS.notes),
          whatsapp: bounded(`doc.${type}.whatsapp`, LIMITS.message, true),
          email: bounded(`doc.${type}.email`, LIMITS.message, true),
        },
      ]),
    ) as Record<DocumentType, DocumentTexts>;

    const card = { show: fields["card.show"] === "on", note: bounded("card.note", LIMITS.cardNote) };

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, settings: { business, vat: { registered, trn, rateBp }, currency, units, prefixes, documents, card } };
  }

  /** Fills {placeholders} in a message template; unknown ones are left as typed. */
  static fill(template: string, values: Partial<Record<(typeof SettingsContract.PLACEHOLDERS)[number], string>>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key as keyof typeof values] ?? match);
  }

  /** "1 month", "2 sessions", "1 fee": the unit word after a quantity, from Settings (legacy units as issued). */
  static unitLabel(settings: BillingSettings, unit: string | undefined, quantity: number): string {
    if (!unit) return "";
    const config = settings.units[unit as ItemUnit];
    if (!config) return InvoiceContract.LEGACY_UNITS[unit as keyof typeof InvoiceContract.LEGACY_UNITS] ?? "";
    return quantity === 1 || unit === "fee" ? config.label : `${config.label}s`;
  }

  /** "Payment: Due within 7 days…" lines -> [title, text] pairs; a line without a colon has no title. */
  static terms(text: string): [string, string][] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const colon = line.indexOf(":");
        return colon > 0 && colon <= 40 ? [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] : ["", line];
      });
  }
}
