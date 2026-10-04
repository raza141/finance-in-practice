import type { ChangeUnit, MarketPulse, PulsePoint, PulseSeries } from "../types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the PortX payload. Malformed series are dropped rather than
 * failing the whole card, so one broken feed only removes its own row.
 */
export class MarketPulseContract {
  /** Older than this and the card says so instead of passing it off as today's close. */
  static readonly STALE_AFTER_DAYS = 4;

  static parse(input: unknown): MarketPulse | null {
    if (!isRecord(input) || !Array.isArray(input.series)) return null;
    const generatedAt = typeof input.generated_at === "string" ? input.generated_at : "";
    if (Number.isNaN(Date.parse(generatedAt))) return null;

    const series = input.series.map(MarketPulseContract.parseSeries).filter((s) => s !== null);
    if (series.length === 0) return null;
    return {
      generated_at: generatedAt,
      history_days: isFiniteNumber(input.history_days) ? input.history_days : 30,
      ...(typeof input.attribution === "string" && { attribution: input.attribution }),
      series,
    };
  }

  /** True when this series' latest close is more than STALE_AFTER_DAYS old (covers weekends and holidays). */
  static isStale(series: PulseSeries, now: Date = new Date()): boolean {
    const ageDays = (now.getTime() - Date.parse(`${series.as_of}T00:00:00Z`)) / 86_400_000;
    return ageDays > MarketPulseContract.STALE_AFTER_DAYS;
  }

  static formatValue(series: PulseSeries): string {
    const text = series.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return series.unit === "pct" ? `${text}%` : text;
  }

  /** "+0.42%", "−2 bps", or an em dash when there is no prior close. */
  static formatChange(series: PulseSeries): string {
    if (series.change === null) return "—";
    const sign = series.change > 0 ? "+" : series.change < 0 ? "−" : "";
    const abs = Math.abs(series.change);
    return series.change_unit === "bps" ? `${sign}${Math.round(abs)} bps` : `${sign}${abs.toFixed(2)}%`;
  }

  /** "PortX · yfinance · PSX · FRED (DTB3)": the credit first, then each feed once. */
  static formatSources(pulse: MarketPulse): string {
    const credit = pulse.attribution?.replace(/^Data:\s*/i, "").trim();
    const feeds = pulse.series.map((s) => (credit && s.source.startsWith(`${credit}.`) ? s.source.slice(credit.length + 1) : s.source));
    return [...new Set(credit ? [credit, ...feeds] : feeds)].join(" · ");
  }

  /** "02 OCT" for a row's as-of date. */
  static formatDate(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
    return `${String(date.getUTCDate()).padStart(2, "0")} ${month}`;
  }

  private static parseSeries(raw: unknown): PulseSeries | null {
    if (!isRecord(raw)) return null;
    const { key, label, unit, as_of, value, change, change_unit, source, ccy } = raw;
    if (typeof key !== "string" || typeof label !== "string" || typeof source !== "string") return null;
    if (unit !== "index" && unit !== "pct") return null;
    if (typeof as_of !== "string" || !DATE.test(as_of) || !isFiniteNumber(value)) return null;
    if (change !== null && !isFiniteNumber(change)) return null;

    const history = Array.isArray(raw.history) ? raw.history.filter(isPoint) : [];
    return {
      key,
      label,
      unit,
      ...(typeof ccy === "string" && { ccy }),
      as_of,
      value,
      change: change ?? null,
      change_unit: (change_unit === "bps" ? "bps" : "pct") satisfies ChangeUnit,
      source,
      history,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPoint(raw: unknown): raw is PulsePoint {
  return (
    isRecord(raw) &&
    typeof raw.date === "string" &&
    DATE.test(raw.date) &&
    isFiniteNumber(raw.value) &&
    (raw.norm === null || isFiniteNumber(raw.norm))
  );
}
