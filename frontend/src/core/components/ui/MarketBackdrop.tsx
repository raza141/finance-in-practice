/** One seamless tile of a made-up price chart: the same seed always draws the same candles (server-rendered, no JS). */
class MarketSeries {
  static readonly WIDTH = 1440;
  static readonly HEIGHT = 900;
  static readonly STEP = 30;

  /** Closes that end where they start, so two tiles side by side loop without a jump. */
  static candles(seed = 7): { x: number; open: number; close: number; high: number; low: number }[] {
    let state = seed;
    const random = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const count = MarketSeries.WIDTH / MarketSeries.STEP;
    const walk = [500];
    for (let i = 1; i <= count; i++) walk.push(walk[i - 1] + (random() - 0.5) * 70 + (500 - walk[i - 1]) * 0.08);
    const drift = walk[count] - walk[0];
    const closes = walk.map((p, i) => p - (drift * i) / count);
    return Array.from({ length: count }, (_, i) => {
      const open = closes[i];
      const close = closes[i + 1];
      return { x: i * MarketSeries.STEP + MarketSeries.STEP / 2, open, close, high: Math.min(open, close) - random() * 28, low: Math.max(open, close) + random() * 28 };
    });
  }
}

function Tile({ offset }: { offset: number }) {
  return (
    <g>
      {MarketSeries.candles().map((c) => {
        const up = c.close < c.open; // y grows downwards
        const color = up ? "var(--color-quant)" : "var(--color-gold)";
        return (
          <g key={c.x} stroke={color} fill={color} strokeOpacity="0.28" fillOpacity="0.16">
            <line x1={c.x + offset} x2={c.x + offset} y1={c.high} y2={c.low} strokeWidth="1.5" />
            <rect x={c.x + offset - 8} y={Math.min(c.open, c.close)} width="16" height={Math.max(Math.abs(c.close - c.open), 2)} rx="2" />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Ambient market chart behind a full-bleed page (candles and a price line
 * drifting left). Plain SVG and one CSS animation: no WebGL, no client JS,
 * and it stands still for visitors who prefer reduced motion.
 */
export function MarketBackdrop({ className = "" }: { className?: string }) {
  const { WIDTH, HEIGHT } = MarketSeries;
  // One price line through both tiles' closes, so it never breaks at the seam.
  const closes = MarketSeries.candles();
  const line = [0, WIDTH].flatMap((offset) => closes.map((c) => `${c.x + offset},${c.close}`)).join(" ");
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden bg-canvas bg-grid-lines ${className}`}>
      <div className="absolute inset-y-0 left-0 w-[200%] animate-[market-drift_120s_linear_infinite] motion-reduce:animate-none">
        <svg viewBox={`0 0 ${WIDTH * 2} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
          <polyline points={line} fill="none" stroke="var(--color-quant)" strokeOpacity="0.4" strokeWidth="1.5" strokeLinejoin="round" />
          <Tile offset={0} />
          <Tile offset={WIDTH} />
        </svg>
      </div>
      {/* Keep the cards readable: a soft glow top left, fading into the page at the bottom. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgb(34_211_238/0.12),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_17_32/0.35),rgb(11_17_32/0.15)_40%,#0b1120)]" />
    </div>
  );
}
