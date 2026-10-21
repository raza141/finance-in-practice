"use client";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { RecordForm, type FieldSpec } from "@/domains/admin/components/RecordForm";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";

import { savePackage } from "../actions/packages";
import { PackageTable } from "../services/PackageTable";
import type { Package } from "../types";

const { LIMITS } = PackageTable;

const FIELDS: readonly FieldSpec[] = [
  { name: "name", label: "Name", maxLength: LIMITS.name[1], required: true, hint: "e.g. Structured Coaching" },
  { name: "tagline", label: "One line under the name (optional)", maxLength: LIMITS.tagline },
  {
    name: "features",
    label: "What it includes",
    maxLength: 3000,
    multiline: true,
    hint: 'One per line, "Feature: what this package gets". Leave the part after ":" empty for not included. A line every package has word for word shows once, under Every package includes.',
  },
];

/** One package on /pricing. Leave hours and price empty (Custom) for a plan agreed per student. */
export function PackageForm({ pkg }: { pkg?: Package }) {
  return (
    <RecordForm
      id={pkg?.id}
      fields={FIELDS}
      values={{ name: pkg?.name, tagline: pkg?.tagline, features: pkg ? PackageTable.featureText(pkg.features) : undefined }}
      save={savePackage}
      submitLabel={pkg ? "Save package" : "Add package"}
      extra={(errors) => (
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="custom" value="yes" defaultChecked={pkg ? pkg.hours === null : false} className="accent-quant" />
            Custom: hours and fee agreed with each student (no price shown, no agreement created at registration)
          </label>
          <Field label="Live hours" error={errors.hours}>
            <input name="hours" inputMode="numeric" defaultValue={pkg?.hours ?? ""} placeholder="e.g. 12" className={FIELD} />
          </Field>
          <Field label="Price" error={errors.priceMinor}>
            <input name="price" inputMode="decimal" defaultValue={pkg?.priceMinor ? InvoiceMath.majorInput(pkg.priceMinor) : ""} placeholder="e.g. 1500" className={FIELD} />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <select name="currency" defaultValue={pkg?.currency ?? "AED"} className={FIELD}>
              {InvoiceContract.CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Order on the page" error={errors.position} hint="Low first">
            <input name="position" inputMode="numeric" defaultValue={pkg?.position ?? 0} className={FIELD} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="featured" value="yes" defaultChecked={pkg?.featured} className="accent-quant" />
            Mark as Recommended
          </label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm">
            <input type="checkbox" name="isActive" value="yes" defaultChecked={pkg?.isActive ?? true} className="accent-quant" />
            Shown on the site
          </label>
        </div>
      )}
    />
  );
}
