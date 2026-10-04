/** One daily close, plus its level rebased to 100 at the start of the window (null for rates). */
export interface PulsePoint {
  date: string;
  value: number;
  norm: number | null;
}

export type ChangeUnit = "pct" | "bps";

export interface PulseSeries {
  key: string;
  label: string;
  unit: "index" | "pct";
  ccy?: string;
  /** Date of the latest close (YYYY-MM-DD). Differs per series: FRED lags a day. */
  as_of: string;
  value: number;
  /** Day-on-day change; null when there is no prior close yet. */
  change: number | null;
  change_unit: ChangeUnit;
  source: string;
  history: PulsePoint[];
}

/** The JSON PortX publishes (Vercel Blob now, /api/public/v1/market-pulse/ later). */
export interface MarketPulse {
  generated_at: string;
  history_days: number;
  /** Credit line PortX wants shown, e.g. "Data: PortX". */
  attribution?: string;
  series: PulseSeries[];
}
