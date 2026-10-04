import type { ChangeUnit, MarketPulse, PulsePoint, PulseSeries } from "../types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the PortX payload. Malformed series are dropped rather than
 * failing the whole card, so one broken feed only removes its own row.
 */
export class MarketPulseContract {
  /**
   * Weekdays allowed to pass after a close before the card calls it stale.
   * Weekends never count, so Friday's close shows cleanly all weekend; 3
   * covers FRED's one-day lag plus a market holiday.
   */
  static readonly STALE_AFTER_WEEKDAYS = 3;

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

  /** True when more than STALE_AFTER_WEEKDAYS weekdays have passed since this series' latest close. */
  static isStale(series: PulseSeries, now: Date = new Date()): boolean {
    const day = new Date(`${series.as_of}T00:00:00Z`);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    let weekdays = 0;
    for (day.setUTCDate(day.getUTCDate() + 1); day.getTime() <= today; day.setUTCDate(day.getUTCDate() + 1)) {
      if (day.getUTCDay() % 6 !== 0) weekdays++;
    }
    return weekdays > MarketPulseContract.STALE_AFTER_WEEKDAYS;
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
