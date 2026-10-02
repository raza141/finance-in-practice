import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { siteConfig } from "@/core/config/site";

function formatMetric(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function QuantLabMetrics() {
  return (
    <section
      id="quant-lab"
      aria-labelledby="quant-lab-heading"
      data-sequence="counters"
      className="page-container py-20 lg:py-28"
    >
      <SectionHeading
        id="quant-lab-heading"
        eyebrow="The Quant Lab"
        title="Taught on an engine verified against the textbooks"
        lede="Every pricing, risk and portfolio model used in sessions runs on our own Python engine, tested against published values from Hull and Bodie, Kane & Marcus."
      />

      <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {siteConfig.metrics.map((metric) => {
          const decimals = "decimals" in metric ? metric.decimals : 0;
          const prefix = "prefix" in metric ? metric.prefix : "";
          const suffix = "suffix" in metric ? metric.suffix : "";
          return (
            <div key={metric.label} className="bg-surface p-6 sm:p-8">
              <dt className="sr-only">{metric.label}</dt>
              <dd>
                <span
                  className="tabular-data block font-sans text-4xl font-semibold tracking-tight text-ink sm:text-5xl"
                  data-count-to={metric.value}
                  data-count-decimals={decimals}
                  data-count-prefix={prefix}
                  data-count-suffix={suffix}
                >
                  {prefix}
                  {formatMetric(metric.value, decimals)}
                  {suffix}
                </span>
                <span className="mt-3 block text-sm font-medium text-ink/90" aria-hidden>
                  {metric.label}
                </span>
                <span className="mt-1 block font-mono text-xs text-quant/80">{metric.detail}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
