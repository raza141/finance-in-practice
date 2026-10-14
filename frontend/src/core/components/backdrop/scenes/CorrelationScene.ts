import { type BackdropScene, GOLD, INK, Paint, QUANT, RED } from "../Paint";

const ASSETS = [
  { name: "Global equities", short: "EQ", sigma: 0.16 },
  { name: "Bonds", short: "BD", sigma: 0.06 },
  { name: "Gold", short: "AU", sigma: 0.15 },
  { name: "Oil", short: "OIL", sigma: 0.3 },
  { name: "Real estate", short: "RE", sigma: 0.13 },
  { name: "EM equities", short: "EM", sigma: 0.23 },
  { name: "US dollar", short: "USD", sigma: 0.08 },
];

/** Plausible long-run correlations (symmetric, same order as ASSETS). */
const BASE = [
  [1, -0.1, 0.05, 0.3, 0.6, 0.75, -0.2],
  [-0.1, 1, 0.25, -0.1, 0.25, -0.05, 0.1],
  [0.05, 0.25, 1, 0.25, 0.1, 0.15, -0.4],
  [0.3, -0.1, 0.25, 1, 0.2, 0.35, -0.3],
  [0.6, 0.25, 0.1, 0.2, 1, 0.5, -0.15],
  [0.75, -0.05, 0.15, 0.35, 0.5, 1, -0.4],
  [-0.2, 0.1, -0.4, -0.3, -0.15, -0.4, 1],
];

/**
 * Asset classes as a network: links thicken with correlation (blue positive,
 * gold negative) and drift over time. Midway, a stress episode pulls every
 * correlation towards 1 and the equal-weight portfolio's risk climbs: in a
 * crisis diversification fades, then recovers.
 */
export class CorrelationScene implements BackdropScene {
  private readonly phase: number[][];

  constructor(seed: number) {
    const random = Paint.random(seed * 15485863);
    this.phase = BASE.map((row) => row.map(() => random() * Math.PI * 2));
  }

  /** Correlation at time t: a gentle wobble, pulled towards 0.85 during the stress window. */
  private rho(i: number, j: number, t: number, stress: number): number {
    if (i === j) return 1;
    const [a, b] = i < j ? [i, j] : [j, i];
    const calm = BASE[a][b] + 0.12 * Math.sin(t * 0.7 + this.phase[a][b]);
    return calm + (0.85 - calm) * stress;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Paint.fade(t);
    const stress = Math.min(Paint.span(t, 7, 9), 1 - Paint.span(t, 11, 13));
    Paint.caption(ctx, w, h, "CORRELATION & DIVERSIFICATION", stress > 0.5 ? "Stress: correlations rise towards 1" : "Calm markets: low correlation spreads risk");

    const cx = w / 2;
    const cy = h * 0.54;
    const nodes = ASSETS.map((asset, i) => {
      const angle = -Math.PI / 2 + (i / ASSETS.length) * Math.PI * 2 + Math.sin(t * 0.3 + i) * 0.03;
      return { ...asset, x: cx + Math.cos(angle) * w * 0.38, y: cy + Math.sin(angle) * h * 0.32 };
    });

    // Links.
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const r = this.rho(i, j, t, stress);
        const strength = Math.min(Math.abs(r), 1);
        ctx.strokeStyle = `rgba(${r >= 0 ? (stress > 0.3 ? RED : QUANT) : GOLD},${0.08 + 0.6 * strength ** 1.5})`;
        ctx.lineWidth = 0.6 + 3.2 * strength;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }

    // Nodes sized by volatility.
    for (const node of nodes) {
      const r = 5 + node.sigma * 40;
      Paint.dot(ctx, node.x, node.y, r + 8, `rgba(${QUANT},0.08)`);
      Paint.dot(ctx, node.x, node.y, r, `rgba(${QUANT},0.55)`);
      Paint.text(ctx, node.name, node.x, node.y + r + 16, `rgba(${INK},0.6)`, 11, "center");
      Paint.text(ctx, `σ ${(node.sigma * 100).toFixed(0)}%`, node.x, node.y + r + 30, `rgba(${INK},0.35)`, 10, "center");
    }

    // Correlation matrix, top right.
    const cell = 15;
    const mx = w * 0.94 - cell * ASSETS.length;
    const my = Paint.top(h) + 10;
    Paint.text(ctx, "ρ MATRIX", w * 0.94, Paint.top(h), `rgba(${INK},0.45)`, 11, "right");
    for (let i = 0; i < ASSETS.length; i++)
      for (let j = 0; j < ASSETS.length; j++) {
        const r = this.rho(i, j, t, stress);
        ctx.fillStyle = `rgba(${r >= 0 ? QUANT : GOLD},${0.1 + 0.75 * Math.min(Math.abs(r), 1)})`;
        ctx.fillRect(mx + j * cell, my + i * cell, cell - 2, cell - 2);
      }

    // Equal-weight portfolio risk with today's correlations.
    const weight = 1 / ASSETS.length;
    let variance = 0;
    for (let i = 0; i < ASSETS.length; i++)
      for (let j = 0; j < ASSETS.length; j++) variance += weight * weight * ASSETS[i].sigma * ASSETS[j].sigma * this.rho(i, j, t, stress);
    const sigma = Math.sqrt(Math.max(variance, 0));
    const average = ASSETS.reduce((s, a) => s + a.sigma * weight, 0);
    const ry = my + cell * ASSETS.length + 22;
    Paint.text(ctx, `EQUAL-WEIGHT σ ${(sigma * 100).toFixed(1)}%`, w * 0.94, ry, `rgba(${stress > 0.3 ? RED : QUANT},0.85)`, 12, "right");
    Paint.text(ctx, `Diversification ratio ${(average / sigma).toFixed(2)}×`, w * 0.94, ry + 16, `rgba(${INK},0.45)`, 11, "right");
  }
}
