import { MarketPulseContract } from "../services/MarketPulseContract";
import { PulseChartGeometry } from "../services/PulseChartGeometry";
import type { MarketPulse, PulseSeries } from "../types";
import { PulseChartView } from "./PulseChartView";

const geometry = new PulseChartGeometry();

/** The exam topic each indicator is used to teach, so the board reads as course material, not a market feed. */
const TOPIC: Record<string, string> = {
  SPX: "Equity valuation",
  ADX: "Equity · UAE market",
  KSE100: "Frontier markets",
  VIX: "Derivatives · volatility",
  UST3M: "Fixed income · risk-free rate",
};

function direction(series: PulseSeries): { arrow: string; className: string } {
  if (!series.change) return { arrow: "→", className: "text-muted" };
  return series.change > 0 ? { arrow: "↗", className: "text-quant" } : { arrow: "↘", className: "text-gold" };
}

function generatedAt(iso: string): string {
  const text = new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  });
  return `${text.toUpperCase()} GST`;
}

/** Terminal-style daily close card. Server-rendered; only the chart hydrates (for the tooltip). */
export function MarketPulseCard({ pulse, now = new Date() }: { pulse: MarketPulse | null; now?: Date }) {
  return (
    <figure className="rounded-xl border border-line bg-surface p-5 font-mono text-xs sm:p-6">
      <p className="tracking-[0.2em] text-quant uppercase">Market Pulse · Daily Close</p>
      <figcaption className="mt-2 font-sans text-sm leading-relaxed text-muted">
        Today&rsquo;s numbers, and the exam topic each one teaches. Sessions start from boards like this.
      </figcaption>

      {pulse ? <PulseBody pulse={pulse} now={now} /> : (
        <p className="mt-6 rounded-lg border border-dashed border-line px-4 py-8 text-center tracking-[0.2em] text-muted uppercase">
          Data unavailable
        </p>
      )}
    </figure>
  );
}

function PulseBody({ pulse, now }: { pulse: MarketPulse; now: Date }) {
  const chart = geometry.build(pulse.series);

  return (
    <>
      <table className="tabular-data mt-5 w-full border-collapse text-[13px]">
        <caption className="sr-only">Latest close and day-on-day change</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Indicator</th>
            <th scope="col">Close</th>
            <th scope="col">Change</th>
            <th scope="col" className="hidden sm:table-cell">As of</th>
          </tr>
        </thead>
        <tbody>
          {pulse.series.map((s) => {
            const dir = direction(s);
            const stale = MarketPulseContract.isStale(s, now);
            return (
              <tr key={s.key} className="border-t border-line/60">
                <th scope="row" className="py-2 pr-2 text-left font-normal whitespace-nowrap text-ink/90">
                  {s.label}
                  {TOPIC[s.key] && <span className="block font-sans text-[11px] whitespace-normal text-muted">{TOPIC[s.key]}</span>}
                </th>
                <td className="py-2 pr-2 text-right text-ink">{MarketPulseContract.formatValue(s)}</td>
                <td className={`py-2 pr-2 text-right whitespace-nowrap ${dir.className}`}>
                  {MarketPulseContract.formatChange(s)} <span aria-hidden>{dir.arrow}</span>
                </td>
                <td className={`hidden py-2 text-right text-[11px] whitespace-nowrap sm:table-cell ${stale ? "text-gold" : "text-muted"}`}>
                  {stale ? `STALE · ${MarketPulseContract.formatDate(s.as_of)}` : MarketPulseContract.formatDate(s.as_of)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {chart && (
        <div className="mt-5 border-t border-line/60 pt-4">
          <p className="tracking-[0.15em] text-muted uppercase">Normalised performance · {pulse.history_days}D · Base 100</p>
          <PulseChartView chart={chart} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
            {chart.lines.map((l) => (
              <li key={l.key} className="flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
                {l.since && <span className="text-muted/80"> since {MarketPulseContract.formatDate(l.since)}</span>}{" "}
                <span className="text-ink/90">{l.points.at(-1)!.norm.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-5 grid gap-1 border-t border-line/60 pt-4 text-[11px] tracking-wide text-muted uppercase">
        <div className="flex gap-2">
          <dt className="shrink-0">Data as of:</dt>
          <dd className="text-ink/90">{generatedAt(pulse.generated_at)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0">Source:</dt>
          <dd className="text-ink/90 normal-case">{MarketPulseContract.formatSources(pulse)}</dd>
        </div>
      </dl>
    </>
  );
}
