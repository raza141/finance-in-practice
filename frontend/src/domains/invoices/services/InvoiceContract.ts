import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { BankDetails, ClientInput, ConfirmationInput, Currency, InvoiceInput, InvoiceItem, ItemUnit } from "../types";
import { InvoiceMath } from "./InvoiceMath";

export type InvoiceField = keyof InvoiceInput;
export type InvoiceFieldErrors = Partial<Record<InvoiceField, string>>;
export type ConfirmationField = keyof ConfirmationInput | "date" | "time";
export type ConfirmationFieldErrors = Partial<Record<ConfirmationField, string>>;
export type ClientFieldErrors = Partial<Record<keyof ClientInput, string>>;
export type BankFieldErrors = Partial<Record<keyof BankDetails, string>>;

type Parsed<T, E> = { ok: true; input: T } | { ok: false; errors: E };

/** A line item as the form submits it (JSON in the hidden `items` field). */
export interface DraftItem {
  description: string;
  detail: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

/**
 * Validation at the server-action boundary for the invoice and confirmation
 * forms. Same limits as the CHECKs in migration 012. Pure.
 */
export class InvoiceContract {
  static readonly CURRENCIES: readonly Currency[] = ["AED", "USD", "PKR", "GBP", "EUR"];
  static readonly DEFAULT_TIME_ZONE = "Asia/Dubai";
  /** Billing basis of a line, as labelled on the form and the invoice. */
  static readonly UNITS: Readonly<Record<ItemUnit, string>> = {
    hour: "Hourly",
    month: "Monthly",
    "on-demand": "On demand",
    contract: "Contract",
  };
  static readonly LIMITS = {
    name: 120,
    email: 254,
    items: 30,
    description: 200,
    maxQuantity: 1000,
    /** 10 million in major units: well inside a Postgres integer. */
    maxMinor: 1_000_000_000,
    trn: 30,
    phone: 40,
    address: 500,
    bank: { bankName: 120, accountTitle: 120, accountNumber: 40, iban: 40, branch: 200, swift: 20 },
    longText: 2000,
    topic: 120,
    location: 500,
    note: 1000,
    duration: [5, 480],
  } as const;

  private static readonly EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  private static readonly BOOKING_UID = /^[A-Za-z0-9_-]{1,100}$/;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;
  private static readonly TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  private static readonly QUANTITY = /^\d+(\.\d{1,2})?$/;
  private static readonly SCHEME = /^[a-z][a-z0-9+.-]*:/i;
  private static readonly UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  static isBookingUid(value: unknown): value is string {
    return typeof value === "string" && InvoiceContract.BOOKING_UID.test(value);
  }

  static isWebUrl(value: string): boolean {
    return /^https?:\/\/\S+$/i.test(value);
  }

  static isIsoDate(value: unknown): value is string {
    return typeof value === "string" && InvoiceContract.DATE.test(value) && ZonedCalendar.isIsoDate(value);
  }

  static parseInvoice(fields: Record<string, unknown>): Parsed<InvoiceInput, InvoiceFieldErrors> {
    const { LIMITS } = InvoiceContract;
    const text = InvoiceContract.text(fields);
    const errors: InvoiceFieldErrors = {};

    const clientName = text("clientName");
    if (!clientName || clientName.length > LIMITS.name) errors.clientName = `Enter the client's name (up to ${LIMITS.name} characters).`;
    const clientEmail = text("clientEmail").toLowerCase();
    if (!InvoiceContract.EMAIL.test(clientEmail) || clientEmail.length > LIMITS.email) errors.clientEmail = "Enter a valid email address.";
    const clientPhone = text("clientPhone");
    if (clientPhone.length > LIMITS.phone) errors.clientPhone = `Up to ${LIMITS.phone} characters.`;
    const clientAddress = text("clientAddress");
    if (clientAddress.length > LIMITS.address) errors.clientAddress = `Up to ${LIMITS.address} characters.`;
    const clientId = text("clientId");
    if (clientId && !InvoiceContract.UUID.test(clientId)) errors.clientId = "Invalid client.";
    const bankAccountId = text("bankAccountId");
    if (bankAccountId && !InvoiceContract.UUID.test(bankAccountId)) errors.bankAccountId = "Invalid bank account.";

    const currency = text("currency") as Currency;
    if (!InvoiceContract.CURRENCIES.includes(currency)) errors.currency = "Choose a currency.";

    const items = InvoiceContract.items(text("items"));
    if (typeof items === "string") errors.items = items;

    const discount = text("discount") === "" ? 0 : InvoiceMath.parseMajor(text("discount"));
    const taxRateBp = InvoiceContract.taxRate(text("taxRate"));
    if (taxRateBp === null) errors.taxRateBp = "Enter a tax rate between 0 and 100, or leave it empty.";

    const subtotal = typeof items === "string" ? 0 : items.reduce((sum, item) => sum + item.amountMinor, 0);
    if (discount === null || (typeof items !== "string" && discount > subtotal)) {
      errors.discountMinor = "Enter a discount no larger than the subtotal, or leave it empty.";
    } else if (typeof items !== "string" && taxRateBp !== null) {
      const { totalMinor } = InvoiceMath.totals(items.map((item) => item.amountMinor), discount, taxRateBp);
      if (totalMinor > LIMITS.maxMinor) errors.items = "The total is too large.";
    }

    const trn = text("trn");
    if (trn.length > LIMITS.trn) errors.trn = `Up to ${LIMITS.trn} characters.`;
    const dueDate = text("dueDate");
    if (!InvoiceContract.isIsoDate(dueDate)) errors.dueDate = "Choose a due date.";
    const notes = text("notes");
    if (notes.length > LIMITS.longText) errors.notes = `Up to ${LIMITS.longText} characters.`;
    const paymentInstructions = text("paymentInstructions");
    if (paymentInstructions.length > LIMITS.longText) errors.paymentInstructions = `Up to ${LIMITS.longText} characters.`;

    const bookingUid = text("bookingUid");
    if (bookingUid && !InvoiceContract.isBookingUid(bookingUid)) errors.bookingUid = "Invalid booking reference.";

    if (Object.keys(errors).length > 0 || typeof items === "string" || discount === null || taxRateBp === null) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      input: {
        bookingUid: bookingUid || null,
        clientId: clientId || null,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        currency,
        items,
        discountMinor: discount,
        taxRateBp,
        trn,
        dueDate,
        notes,
        paymentInstructions,
        bankAccountId: bankAccountId || null,
      },
    };
  }

  static parseClient(fields: Record<string, unknown>): Parsed<ClientInput, ClientFieldErrors> {
    const { LIMITS } = InvoiceContract;
    const text = InvoiceContract.text(fields);
    const errors: ClientFieldErrors = {};
    const name = text("name");
    if (!name || name.length > LIMITS.name) errors.name = `Enter the client's name (up to ${LIMITS.name} characters).`;
    const email = text("email").toLowerCase();
    if (!InvoiceContract.EMAIL.test(email) || email.length > LIMITS.email) errors.email = "Enter a valid email address.";
    const phone = text("phone");
    if (phone.length > LIMITS.phone) errors.phone = `Up to ${LIMITS.phone} characters.`;
    const address = text("address");
    if (address.length > LIMITS.address) errors.address = `Up to ${LIMITS.address} characters.`;
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, input: { name, email, phone, address } };
  }

  static parseBank(fields: Record<string, unknown>): Parsed<BankDetails, BankFieldErrors> {
    const limits = InvoiceContract.LIMITS.bank;
    const text = InvoiceContract.text(fields);
    const errors: BankFieldErrors = {};
    const input = {} as BankDetails;
    for (const key of Object.keys(limits) as (keyof BankDetails)[]) {
      // IBAN and SWIFT are printed grouped as typed, but upper-cased.
      input[key] = key === "iban" || key === "swift" ? text(key).toUpperCase() : text(key);
      if (input[key].length > limits[key]) errors[key] = `Up to ${limits[key]} characters.`;
    }
    if (!input.bankName) errors.bankName = "Enter the bank name.";
    if (!input.accountNumber && !input.iban) errors.accountNumber = "Enter an account number or an IBAN.";
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, input };
  }

  static parseConfirmation(fields: Record<string, unknown>): Parsed<ConfirmationInput, ConfirmationFieldErrors> {
    const { LIMITS } = InvoiceContract;
    const text = InvoiceContract.text(fields);
    const errors: ConfirmationFieldErrors = {};

    const clientName = text("clientName");
    if (!clientName || clientName.length > LIMITS.name) errors.clientName = `Enter the client's name (up to ${LIMITS.name} characters).`;
    const clientEmail = text("clientEmail").toLowerCase();
    if (!InvoiceContract.EMAIL.test(clientEmail) || clientEmail.length > LIMITS.email) errors.clientEmail = "Enter a valid email address.";

    const clientTimeZone = text("clientTimeZone");
    if (!ZonedCalendar.isValidTimeZone(clientTimeZone)) errors.clientTimeZone = "Choose the client's timezone.";
    const date = text("date");
    if (!InvoiceContract.isIsoDate(date)) errors.date = "Choose the session date.";
    const time = text("time");
    if (!InvoiceContract.TIME.test(time)) errors.time = "Enter the start time (HH:MM).";

    const durationMinutes = Number(text("durationMinutes"));
    const [minDuration, maxDuration] = LIMITS.duration;
    if (!Number.isInteger(durationMinutes) || durationMinutes < minDuration || durationMinutes > maxDuration) {
      errors.durationMinutes = `Between ${minDuration} and ${maxDuration} minutes.`;
    }

    const topic = text("topic");
    if (!topic || topic.length > LIMITS.topic) errors.topic = `Enter the topic (up to ${LIMITS.topic} characters).`;
    const location = text("location");
    if (location.length > LIMITS.location) errors.location = `Up to ${LIMITS.location} characters.`;
    else if (InvoiceContract.SCHEME.test(location) && !InvoiceContract.isWebUrl(location)) {
      errors.location = "Links must start with http:// or https://.";
    }
    const note = text("note");
    if (note.length > LIMITS.note) errors.note = `Up to ${LIMITS.note} characters.`;

    const bookingUid = text("bookingUid");
    if (bookingUid && !InvoiceContract.isBookingUid(bookingUid)) errors.bookingUid = "Invalid booking reference.";

    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return {
      ok: true,
      input: {
        bookingUid: bookingUid || null,
        clientName,
        clientEmail,
        start: InvoiceContract.zonedInstant(date, time, clientTimeZone).toISOString(),
        durationMinutes,
        clientTimeZone,
        topic,
        location,
        note,
      },
    };
  }

  /** The instant a wall-clock date and time in `timeZone` refers to (DST-aware, Intl only). */
  static zonedInstant(date: string, time: string, timeZone: string): Date {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    // The offset at the guessed instant may differ across a DST change: check twice.
    const first = wall - InvoiceContract.offsetMs(wall, timeZone);
    return new Date(wall - InvoiceContract.offsetMs(first, timeZone));
  }

  /** How far `timeZone`'s wall clock is ahead of UTC at `instant`. */
  private static offsetMs(instant: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return wall - Math.floor(instant / 1000) * 1000;
  }

  private static text(fields: Record<string, unknown>) {
    return (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
  }

  /** "5" -> 500 bp; "" -> 0; invalid -> null. */
  private static taxRate(raw: string): number | null {
    if (raw === "") return 0;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) return null;
    const bp = Math.round(Number(raw) * 100);
    return bp <= 10_000 ? bp : null;
  }

  /** Items from the hidden JSON field, or an error message. */
  private static items(raw: string): InvoiceItem[] | string {
    const { LIMITS } = InvoiceContract;
    let drafts: unknown;
    try {
      drafts = JSON.parse(raw || "[]");
    } catch {
      return "Line items could not be read.";
    }
    if (!Array.isArray(drafts) || drafts.length === 0) return "Add at least one line item.";
    if (drafts.length > LIMITS.items) return `Up to ${LIMITS.items} line items.`;

    const items: InvoiceItem[] = [];
    for (const [index, draft] of drafts.entries()) {
      const row = `Line ${index + 1}: `;
      const d = (draft ?? {}) as Partial<Record<keyof DraftItem, unknown>>;
      const description = typeof d.description === "string" ? d.description.trim() : "";
      if (!description || description.length > LIMITS.description) return `${row}choose a course or enter a description (up to ${LIMITS.description} characters).`;
      const detail = typeof d.detail === "string" ? d.detail.trim() : "";
      if (detail.length > LIMITS.description) return `${row}details up to ${LIMITS.description} characters.`;
      const unit = d.unit as ItemUnit;
      if (typeof unit !== "string" || !Object.hasOwn(InvoiceContract.UNITS, unit)) return `${row}choose hourly, monthly, on demand or contract.`;
      const quantityText = typeof d.quantity === "string" ? d.quantity.trim() : "";
      const quantity = Number(quantityText);
      if (!InvoiceContract.QUANTITY.test(quantityText) || quantity <= 0 || quantity > LIMITS.maxQuantity) {
        return `${row}quantity must be a number above 0 (up to 2 decimals).`;
      }
      const unitMinor = typeof d.unitPrice === "string" ? InvoiceMath.parseMajor(d.unitPrice) : null;
      if (unitMinor === null || unitMinor > LIMITS.maxMinor) return `${row}enter a unit price, e.g. 450 or 450.50.`;
      items.push({ description, ...(detail && { detail }), unit, quantity, unitMinor, amountMinor: InvoiceMath.lineAmount(quantity, unitMinor) });
    }
    return items;
  }
}
