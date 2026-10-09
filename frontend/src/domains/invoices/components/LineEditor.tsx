"use client";

import { FIELD } from "@/domains/admin/components/FormField";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import type { Service } from "@/domains/catalogue/types";

import { InvoiceContract, type DraftItem } from "../services/InvoiceContract";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Agreement, Currency, DocumentLayout, DocumentType, InvoiceItem, ItemUnit, PricingSource } from "../types";

/** How a line's period is entered. "tba" (quotes only) prints "To be agreed". */
export type PeriodKind = "month" | "date" | "range" | "text" | "tba";
const PERIOD_KINDS: Record<PeriodKind, string> = { month: "Month", date: "Date", range: "Dates (from–to)", text: "Free text", tba: "To be agreed" };

/** What each basis asks for: the quantity's label (null = always 1, hidden), the price's label, and the usual period. */
export const BASIS: Readonly<Record<ItemUnit, { quantity: string | null; price: string; period: PeriodKind }>> = {
  hour: { quantity: "Hours", price: "Rate per hour", period: "date" },
  month: { quantity: "Months", price: "Monthly fee", period: "month" },
  session: { quantity: "Sessions", price: "Rate per session", period: "date" },
  package: { quantity: "Packages", price: "Package fee", period: "range" },
  fee: { quantity: null, price: "Project fee", period: "range" },
  milestone: { quantity: null, price: "Milestone amount", period: "date" },
};

/** A line as the form edits it: strings as the inputs hold them, plus its catalogue link and price source. */
export interface Row extends DraftItem {
  key: number;
  periodKind: PeriodKind;
  serviceId: string;
  pricingSource: PricingSource;
  agreementId: string;
}

const RANGE = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/;

export function periodKind(period: string, unit: string): PeriodKind {
  if (RANGE.test(period)) return "range";
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return "date";
  if (/^\d{4}-\d{2}$/.test(period)) return "month";
  if (period.toLowerCase() === InvoiceContract.TO_BE_AGREED.toLowerCase()) return "tba";
  if (period) return "text";
  return BASIS[unit as ItemUnit]?.period ?? "date";
}

let nextKey = 0;
/** A form row from a saved line (or a blank one). A 0 price without a source is a placeholder: shown empty. */
export function toRow(item?: Partial<InvoiceItem>): Row {
  const period = item?.period ?? "";
  const unit = item?.unit ?? "hour";
  const price = item?.unitMinor;
  return {
    key: nextKey++,
    description: item?.description ?? "",
    detail: item?.detail ?? "",
    period,
    periodKind: periodKind(period, unit),
    unit,
    quantity: item?.quantity !== undefined ? String(item.quantity) : "1",
    unitPrice: price === undefined || (price === 0 && !item?.pricingSource) ? "" : InvoiceMath.majorInput(price),
    serviceId: item?.serviceId ?? "",
    pricingSource: item?.pricingSource ?? "manual",
    agreementId: item?.agreementId ?? "",
    ...(item?.sourceLine !== undefined && { sourceLine: item.sourceLine }),
  };
}

/** What the hidden `items` field sends: the row without its form-only state. */
export function toDraft({ description, detail, period, unit, quantity, unitPrice, serviceId, pricingSource, agreementId, sourceLine }: Row): DraftItem {
  return { description, detail, period, unit, quantity, unitPrice, serviceId, pricingSource, agreementId, sourceLine };
}

const SMALL = "text-[10px] tracking-[0.14em] text-muted uppercase";
const BADGE: Record<PricingSource, string> = {
  agreement: "border-emerald-400/40 text-emerald-300",
  catalogue: "border-quant/40 text-quant",
  manual: "border-line text-muted",
};

/**
 * One line of the composer. The basis picks the labels, hides the quantity for
 * fixed amounts and suggests the period's form; the service box searches the
 * catalogue by code or name (or takes any text as a custom line).
 */
export function LineEditor({
  row,
  index,
  docType,
  layout,
  currency,
  service,
  agreements,
  amount,
  canRemove,
  onChange,
  onText,
  onUnit,
  onAgreement,
  onRemove,
}: {
  row: Row;
  index: number;
  docType: DocumentType;
  layout: DocumentLayout;
  currency: Currency;
  /** The linked service, if any (archived ones included, for older drafts). */
  service: Service | undefined;
  /** This client's agreements for the linked service, in force on the line's date. */
  agreements: readonly Agreement[];
  amount: string;
  canRemove: boolean;
  onChange: (patch: Partial<Row>) => void;
  /** Text typed or picked in the service box. */
  onText: (text: string) => void;
  onUnit: (unit: ItemUnit) => void;
  onAgreement: (agreement: Agreement | null) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const unit = row.unit as ItemUnit;
  // No basis yet (a service with no default): ask for one before anything else.
  const basis = BASIS[unit] ?? { quantity: "Quantity", price: "Price", period: "date" };
  const units = (service ? service.units : CatalogueContract.UNIT_ORDER).filter((u) => u !== "milestone" || layout === "consultancy" || row.unit === "milestone");
  const kinds = (Object.keys(PERIOD_KINDS) as PeriodKind[]).filter((k) => k !== "tba" || docType === "quote" || row.periodKind === "tba");
  const [from, to] = RANGE.exec(row.period)?.slice(1) ?? ["", ""];
  // A fixed amount is billed once; a stored quantity other than 1 (an older line) stays editable so it can be fixed.
  const showQuantity = basis.quantity !== null || Number(row.quantity) !== 1;

  return (
    <li className="grid gap-2 border-b border-line/60 pb-4 sm:grid-cols-[1fr_8rem_5rem_8rem_8rem_4rem] sm:items-end sm:gap-3">
      <div className="grid gap-1">
        <span className={SMALL}>
          {service ? (
            <>
              <span className="font-mono text-quant">{service.code}</span>
              {service.archivedAt && " (archived)"}
              <button type="button" onClick={() => onChange({ serviceId: "", pricingSource: "manual", agreementId: "" })} className="ml-2 normal-case hover:text-ink" title="Make it a custom line">
                × unlink
              </button>
            </>
          ) : (
            "Service or description"
          )}
        </span>
        <input
          aria-label={`Line ${n} service or description`}
          list={LineEditor.LIST}
          placeholder="Type a code, a service name, or a one-off description"
          maxLength={200}
          value={row.description}
          onChange={(e) => onText(e.target.value)}
          className={`${FIELD} mt-0`}
        />
      </div>
      <label className="grid gap-1">
        <span className={SMALL}>Basis</span>
        <select aria-label={`Line ${n} billing basis`} value={row.unit} onChange={(e) => onUnit(e.target.value as ItemUnit)} className={`${FIELD} mt-0`}>
          {!row.unit && <option value="">Choose basis</option>}
          {units.map((value) => (
            <option key={value} value={value}>
              {InvoiceContract.UNITS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className={SMALL}>{basis.quantity ?? (showQuantity ? "Qty (must be 1)" : "Qty")}</span>
        {showQuantity ? (
          <input aria-label={`Line ${n} ${(basis.quantity ?? "quantity").toLowerCase()}`} inputMode="decimal" value={row.quantity} onChange={(e) => onChange({ quantity: e.target.value })} className={`${FIELD} mt-0`} />
        ) : (
          <span className="py-2 text-sm text-muted">1</span>
        )}
      </label>
      <label className="grid gap-1">
        <span className={SMALL}>{basis.price}</span>
        <input
          aria-label={`Line ${n} ${basis.price.toLowerCase()}`}
          inputMode="decimal"
          placeholder="Enter price"
          value={row.unitPrice}
          onChange={(e) => onChange({ unitPrice: e.target.value, pricingSource: "manual", agreementId: "" })}
          className={`${FIELD} mt-0`}
        />
      </label>
      <div className="grid gap-1 text-right">
        <span className={`${SMALL} justify-self-end`}>
          <span className={`rounded border px-1.5 py-0.5 ${BADGE[row.pricingSource]}`} title="Where the price came from">
            {InvoiceContract.PRICING_SOURCES[row.pricingSource]}
          </span>
        </span>
        <span className="py-2 font-mono text-sm tabular-nums">{amount}</span>
      </div>
      <button type="button" disabled={!canRemove} onClick={onRemove} className="self-center rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30">
        Remove
      </button>

      <input
        aria-label={`Line ${n} details`}
        placeholder="Details shown under the title (optional), e.g. 8 sessions, mock exam included"
        maxLength={200}
        value={row.detail}
        onChange={(e) => onChange({ detail: e.target.value })}
        className={`${FIELD} mt-0 text-sm sm:col-span-3`}
      />
      <div className="grid grid-cols-[9rem_1fr] gap-2 sm:col-span-3">
        <select
          aria-label={`Line ${n} period type`}
          value={row.periodKind}
          onChange={(e) => {
            const kind = e.target.value as PeriodKind;
            onChange({ periodKind: kind, period: kind === "tba" ? InvoiceContract.TO_BE_AGREED : "" });
          }}
          className={`${FIELD} mt-0 text-sm`}
        >
          {kinds.map((value) => (
            <option key={value} value={value}>
              {PERIOD_KINDS[value]}
            </option>
          ))}
        </select>
        {row.periodKind === "range" ? (
          <div className="grid grid-cols-2 gap-2">
            <input aria-label={`Line ${n} from`} type="date" value={from} onChange={(e) => onChange({ period: `${e.target.value}/${to || e.target.value}` })} className={`${FIELD} mt-0 text-sm`} />
            <input aria-label={`Line ${n} to`} type="date" value={to} min={from || undefined} onChange={(e) => onChange({ period: `${from || e.target.value}/${e.target.value}` })} className={`${FIELD} mt-0 text-sm`} />
          </div>
        ) : row.periodKind === "tba" ? (
          <span className="py-2 text-sm text-muted">Confirmed on the invoice</span>
        ) : (
          <input
            aria-label={`Line ${n} period`}
            type={row.periodKind === "text" ? "text" : row.periodKind}
            placeholder={row.periodKind === "text" ? "e.g. Weekends in October 2026" : undefined}
            maxLength={60}
            value={row.period}
            onChange={(e) => onChange({ period: e.target.value })}
            className={`${FIELD} mt-0 text-sm`}
          />
        )}
      </div>
      {agreements.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted sm:col-span-6">
          Agreement
          <select
            aria-label={`Line ${n} agreement`}
            value={row.pricingSource === "agreement" ? row.agreementId : ""}
            onChange={(e) => onAgreement(agreements.find((a) => a.id === e.target.value) ?? null)}
            className="rounded-md border border-line bg-canvas/70 px-2 py-1 text-ink"
          >
            <option value="">Not applied (catalogue or typed price)</option>
            {agreements.map((a) => (
              <option key={a.id} value={a.id} disabled={a.currency !== currency}>
                {InvoiceMath.money(a.rateMinor, a.currency)} {InvoiceContract.UNITS[a.unit].toLowerCase()} · from {a.startsOn}
                {a.currency !== currency ? ` (needs ${a.currency})` : ""}
              </option>
            ))}
          </select>
          {agreements.length > 1 && row.pricingSource !== "agreement" && <span className="text-gold">{agreements.length} agreements apply: pick one, or price it yourself.</span>}
        </label>
      )}
    </li>
  );
}

/** The one <datalist> every line's service box searches (rendered by the form). */
LineEditor.LIST = "line-services";

/** Services (by "code · name") and course titles for the line search. */
export function LineSearchList({ services, courses }: { services: readonly Service[]; courses: readonly string[] }) {
  return (
    <datalist id={LineEditor.LIST}>
      {services.map((s) => (
        <option key={s.id} value={CatalogueContract.label(s)} />
      ))}
      {courses.map((title) => (
        <option key={title} value={title} />
      ))}
    </datalist>
  );
}
