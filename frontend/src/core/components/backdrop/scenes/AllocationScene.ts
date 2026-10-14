import { type BackdropScene, GOLD, INK, Paint, QUANT, RED } from "../Paint";

const SLICES = [
  { name: "Global equities", target: 0.45, color: QUANT },
  { name: "Bonds", target: 0.3, color: "125,211,252" },
  { name: "Real estate", target: 0.1, color: "167,139,250" },
  { name: "Gold", target: 0.1, color: GOLD },
  { name: "Cash", target: 0.05, color: INK },
];
const BAND = 0.05;

const IPS = [
  ["Return objective", "7% a year"],
  ["Risk tolerance", "Moderate · σ ≤ 11%"],
  ["Time horizon", "10 years"],
  ["Liquidity", "5% in cash"],
  ["Rebalancing", `±${BAND * 100}% bands`],
] as const;

/**
 * Portfolio management in one loop: the IPS sets the objectives, the strategic
 * allocation fills the ring, markets push the weights off target until one
 * leaves its band, and a rebalance brings everything back on policy.
 */
export class AllocationScene implements BackdropScene {
  /** Market returns over the drift window (equities rally so they overshoot). */
  private readonly returns: number[];

  constructor(seed: number) {
    const random = Paint.random(seed * 2750159);
    this.returns = [0.24 + random() * 0.1, -0.04 + random() * 0.03, random() * 0.08, -0.06 + random() * 0.08, 0.005];
  }

  /** Weights at time t: target, drifting with the market from 4 s, rebalanced back from 10 s. */
  private weights(t: number): number[] {
    const drift = Paint.span(t, 4, 9);
    const values = SLICES.map((s, i) => s.target * (1 + this.returns[i] * drift));
    const total = values.reduce((a, b) => a + b, 0);
    const back = Paint.span(t, 10, 12);
    return values.map((v, i) => v / total + (SLICES[i].target - v / total) * back);
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Paint.fade(t);
    Paint.caption(ctx, w, h, "PORTFOLIO CONSTRUCTION", "IPS → strategic allocation → drift → rebalance");

    // The IPS, line by line.
    const ix = w * 0.06;
    let iy = h * 0.26;
    Paint.text(ctx, "INVESTMENT POLICY STATEMENT", ix, iy, `rgba(${GOLD},${0.8 * Paint.span(t, 0.5, 1.2)})`, 12);
    IPS.forEach(([label, value], i) => {
      const a = Paint.span(t, 0.8 + i * 0.3, 1.4 + i * 0.3);
      iy += 22;
      Paint.text(ctx, label, ix, iy, `rgba(${INK},${0.45 * a})`);
      Paint.text(ctx, value, ix + 150, iy, `rgba(${INK},${0.8 * a})`);
    });

    // Allocation ring: slices grow in from 2 s.
    const grow = Paint.span(t, 2, 4);
    const weights = this.weights(t);
    const cx = w * 0.72;
    const cy = h * 0.52;
    const radius = Math.min(w, h) * 0.24;
    let angle = -Math.PI / 2;
    weights.forEach((weight, i) => {
      const sweep = weight * Math.PI * 2 * grow;
      ctx.strokeStyle = `rgba(${SLICES[i].color},0.7)`;
      ctx.lineWidth = radius * 0.32;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle + 0.012, angle + sweep - 0.012);
      ctx.stroke();
      angle += sweep;
    });

    const off = weights.map((wgt, i) => wgt - SLICES[i].target);
    const breached = off.some((d) => Math.abs(d) > BAND);
    const rebalancing = t >= 9.6;
    const done = t >= 12.2;
    const status = done ? "ON POLICY ✓" : rebalancing ? "REBALANCING" : breached ? "OUTSIDE BAND" : grow >= 1 ? "WITHIN BANDS" : "STRATEGIC ALLOCATION";
    Paint.text(ctx, status, cx, cy - 4, `rgba(${breached && !rebalancing ? RED : QUANT},${0.9 * grow})`, 13, "center");
    Paint.text(ctx, "vs target", cx, cy + 14, `rgba(${INK},${0.4 * grow})`, 11, "center");

    // Weights table under the IPS.
    let ty = h * 0.26 + 22 * (IPS.length + 2);
    Paint.text(ctx, "ASSET            TARGET  ACTUAL", ix, ty, `rgba(${INK},${0.45 * grow})`);
    SLICES.forEach((slice, i) => {
      ty += 20;
      const out = Math.abs(off[i]) > BAND;
      Paint.dot(ctx, ix + 4, ty - 4, 4, `rgba(${slice.color},${0.8 * grow})`);
      Paint.text(ctx, slice.name.padEnd(16), ix + 14, ty, `rgba(${INK},${0.7 * grow})`);
      Paint.text(ctx, `${(slice.target * 100).toFixed(0)}%`.padStart(4), ix + 150, ty, `rgba(${INK},${0.5 * grow})`);
      Paint.text(ctx, `${(weights[i] * 100).toFixed(1)}%`.padStart(6), ix + 205, ty, `rgba(${out ? RED : QUANT},${0.85 * grow})`);
    });

    // The rebalancing trades.
    if (rebalancing) {
      const start = this.weights(9.5);
      const trades = start.map((wgt, i) => ({ name: SLICES[i].name, change: SLICES[i].target - wgt })).filter((x) => Math.abs(x.change) >= 0.003);
      let ry = cy + radius + radius * 0.32;
      trades.forEach((trade, i) => {
        const a = Paint.span(t, 9.6 + i * 0.2, 10.1 + i * 0.2);
        Paint.text(ctx, `${trade.change > 0 ? "BUY " : "SELL"} ${trade.name} ${(Math.abs(trade.change) * 100).toFixed(1)}%`, cx, ry, `rgba(${trade.change > 0 ? QUANT : GOLD},${0.85 * a})`, 11, "center");
        ry += 16;
      });
    }
  }
}
