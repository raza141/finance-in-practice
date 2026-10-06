import { describe, expect, it } from "vitest";

import { SettingsContract } from "./SettingsContract";

const D = SettingsContract.DEFAULTS;

/** The settings form as SettingsForm submits it, from the defaults. */
const formFields = (overrides: Record<string, string> = {}) => {
  const fields: Record<string, string> = {
    "business.name": D.business.name,
    "business.sender": D.business.sender,
    "business.address": D.business.address,
    "business.phone": D.business.phone,
    "business.email": "",
    "business.website": D.business.website,
    "vat.trn": "",
    "vat.rate": "5",
    currency: "AED",
    "card.note": D.card.note,
  };
  for (const [unit, config] of Object.entries(D.units)) {
    fields[`unit.${unit}.label`] = config.label;
    fields[`unit.${unit}.rate`] = "";
    fields[`unit.${unit}.layout`] = config.layout;
  }
  for (const [type, texts] of Object.entries(D.documents)) {
    fields[`prefix.${type}`] = D.prefixes[type as keyof typeof D.prefixes];
    for (const [key, value] of Object.entries(texts)) fields[`doc.${type}.${key}`] = value;
  }
  return { ...fields, ...overrides };
};

describe("SettingsContract", () => {
  it("reads stored settings over the defaults and ignores malformed values", () => {
    const merged = SettingsContract.merge({ business: { name: "FIP", phone: 42 }, vat: { registered: true }, currency: "XXX", prefixes: { invoice: "INV" } });
    expect(merged.business.name).toBe("FIP");
    expect(merged.business.phone).toBe(D.business.phone);
    expect(merged.vat).toEqual({ ...D.vat, registered: true });
    expect(merged.currency).toBe("AED");
    expect(merged.prefixes).toEqual({ ...D.prefixes, invoice: "INV" });
    expect(merged.documents.invoice.terms).toBe(D.documents.invoice.terms);
    expect(SettingsContract.merge(null)).toEqual(D);
  });

  it("round-trips the defaults through the form", () => {
    const parsed = SettingsContract.parse(formFields());
    expect(parsed.ok && parsed.settings).toEqual(D);
  });

  it("requires a 15-digit TRN before VAT is on, and unique valid prefixes", () => {
    const vat = SettingsContract.parse(formFields({ "vat.registered": "on" }));
    expect(vat.ok ? null : vat.errors["vat.trn"]).toBeTruthy();
    const ok = SettingsContract.parse(formFields({ "vat.registered": "on", "vat.trn": "100 1234 5678 9003" }));
    expect(ok.ok && ok.settings.vat).toEqual({ registered: true, trn: "100123456789003", rateBp: 500 });
    const prefixes = SettingsContract.parse(formFields({ "prefix.quote": "fip-inv", "prefix.receipt": "FIP REC" }));
    expect(prefixes.ok ? null : [prefixes.errors["prefix.quote"], prefixes.errors["prefix.receipt"]].every(Boolean)).toBe(true);
  });

  it("splits terms into titled lines", () => {
    expect(SettingsContract.terms("Payment: Due in 7 days.\n\nNo title here")).toEqual([
      ["Payment", "Due in 7 days."],
      ["", "No title here"],
    ]);
  });
});
