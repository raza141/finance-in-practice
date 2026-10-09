"use client";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { RecordForm, type FieldSpec } from "@/domains/admin/components/RecordForm";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";

import { saveService } from "../actions/services";
import { CatalogueContract } from "../services/CatalogueContract";
import type { Service } from "../types";

const { LIMITS } = CatalogueContract;

const FIELDS: readonly FieldSpec[] = [
  { name: "code", label: "Code", maxLength: 20, required: true, hint: "Unique, e.g. CF001. Letters, digits and dashes." },
  { name: "name", label: "Name", maxLength: LIMITS.name, required: true, hint: "Printed as the line title" },
  { name: "category", label: "Category (optional)", maxLength: LIMITS.category, hint: "e.g. CFA, FRM, Consultancy" },
  { name: "description", label: "Default description (optional)", maxLength: LIMITS.description, hint: "Printed under the title; editable on each line" },
];

/** What a service is and the bases it can be billed on. Prices are added on the service's page. */
export function ServiceForm({ service }: { service?: Service }) {
  const { code, name, category, description } = service ?? {};
  return (
    <RecordForm
      id={service?.id}
      fields={FIELDS}
      values={{ code, name, category, description }}
      save={saveService}
      submitLabel={service ? "Save service" : "Add service"}
      extra={(errors) => (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-sm text-quant">Billed as</p>
            <div className="grid gap-2">
              {CatalogueContract.UNIT_ORDER.map((unit) => (
                <label key={unit} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="units" value={unit} defaultChecked={service?.units.includes(unit)} className="accent-quant" />
                  {InvoiceContract.UNITS[unit]}
                </label>
              ))}
            </div>
            {errors.units && (
              <p role="alert" className="mt-2 text-xs text-gold">
                {errors.units}
              </p>
            )}
          </div>
          <Field label="Default basis (optional)" error={errors.defaultUnit} hint="Preselected when the service is added to a line">
            <select name="defaultUnit" defaultValue={service?.defaultUnit ?? ""} className={FIELD}>
              <option value="">Choose on each line</option>
              {CatalogueContract.UNIT_ORDER.map((unit) => (
                <option key={unit} value={unit}>
                  {InvoiceContract.UNITS[unit]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
    />
  );
}
