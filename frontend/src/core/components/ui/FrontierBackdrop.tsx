"use client";

import { useEffect, useRef } from "react";

import { FrontierModel, type RiskReturn } from "./FrontierModel";

const QUANT = "34,211,238";
const GOLD = "212,175,55";
const INK = "203,213,225";
const CYCLE_S = 16;
const DOTS = 420;
const FPS = 30;

/** One cycle of the story: portfolios appear, the frontier draws, the CML sweeps in, the optimum pulses, fade. */
class FrontierScene {
  private readonly model: FrontierModel;
  private readonly dots: RiskReturn[];
  private readonly efficient: RiskReturn[];
  private readonly inefficient: RiskReturn[];
  private readonly tangency: RiskReturn;
  private readonly max: RiskReturn;
  private readonly min: RiskReturn;

  constructor(seed: number) {
    this.model = new FrontierModel(seed);
    this.dots = this.model.portfolios(DOTS);
    // The edges come from many more portfolios than are drawn, so they hug the cloud smoothly.
    ({ efficient: this.efficient, inefficient: this.inefficient } = this.model.frontier([...this.dots, ...this.model.portfolios(1500)]));
    this.tangency = FrontierModel.tangency(this.efficient);
    const all = [...this.dots, ...this.model.assets];
    this.max = { sigma: Math.max(...all.map((p) => p.sigma)) * 1.12, mu: Math.max(...all.map((p) => p.mu)) * 1.12 };
    this.min = { sigma: 0, mu: Math.min(FrontierModel.RISK_FREE, ...all.map((p) => p.mu)) - 0.012 };
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    const left = w * 0.08;
    const right = w * 0.94;
    const top = h * 0.14;
    const bottom = h * 0.86;
    const x = (sigma: number) => left + ((sigma - this.min.sigma) / (this.max.sigma - this.min.sigma)) * (right - left);
    const y = (mu: number) => bottom - ((mu - this.min.mu) / (this.max.mu - this.min.mu)) * (bottom - top);
    const ease = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : 1 - (1 - v) ** 3);
    const span = (from: number, to: number) => ease((t - from) / (to - from));
    const fade = 1 - span(CYCLE_S - 2.5, CYCLE_S);
    ctx.globalAlpha = fade;

    // Axes.
    ctx.strokeStyle = `rgba(${INK},0.16)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.fillStyle = `rgba(${INK},0.32)`;
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.fillText("RISK (σ) →", right, bottom + 22);
    ctx.save();
    ctx.translate(left - 14, top);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("EXPECTED RETURN →", 0, 0);
    ctx.restore();
    ctx.textAlign = "center";
    for (let s = 0.05; x(s) < right - 90; s += 0.05) ctx.fillText(`${Math.round(s * 100)}%`, x(s), bottom + 22);

    // Random portfolios fade in over 4 s.
    for (let i = 0; i < this.dots.length; i++) {
      const a = span((i / this.dots.length) * 4, (i / this.dots.length) * 4 + 0.5);
      if (a === 0) continue;
      ctx.fillStyle = `rgba(${QUANT},${0.45 * a})`;
      ctx.beginPath();
      ctx.arc(x(this.dots[i].sigma), y(this.dots[i].mu), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // The asset classes themselves.
    const assets = span(0.3, 1.5);
    ctx.textAlign = "left";
    for (const asset of this.model.assets) {
      ctx.fillStyle = `rgba(${INK},${0.6 * assets})`;
      ctx.beginPath();
      ctx.arc(x(asset.sigma), y(asset.mu), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${INK},${0.38 * assets})`;
      ctx.fillText(asset.name, x(asset.sigma) + 7, y(asset.mu) + 4);
    }

    // The frontier draws itself from the minimum-variance tip: efficient edge solid, lower edge dashed.
    const grow = span(4, 7);
    if (grow > 0) {
      const edge = (points: RiskReturn[], dashed: boolean) => {
        const shown = Math.max(2, Math.ceil(points.length * grow));
        ctx.setLineDash(dashed ? [4, 6] : []);
        ctx.strokeStyle = `rgba(${QUANT},${dashed ? 0.35 : 0.9})`;
        ctx.lineWidth = dashed ? 1.2 : 2.2;
        ctx.beginPath();
        points.slice(0, shown).forEach((p, k) => (k === 0 ? ctx.moveTo(x(p.sigma), y(p.mu)) : ctx.lineTo(x(p.sigma), y(p.mu))));
        ctx.stroke();
      };
      ctx.shadowColor = `rgba(${QUANT},0.7)`;
      ctx.shadowBlur = 14;
      edge(this.efficient, false);
      ctx.shadowBlur = 0;
      edge(this.inefficient, true);
      ctx.setLineDash([]);
      const top = this.efficient[this.efficient.length - 1];
      ctx.fillStyle = `rgba(${QUANT},${0.7 * span(6, 7)})`;
      ctx.textAlign = "right";
      ctx.fillText("Efficient frontier", x(top.sigma) - 10, y(top.mu) - 12);
      ctx.textAlign = "left";
    }

    // Capital market line from the risk-free rate through the tangency portfolio.
    const cml = span(7, 9);
    if (cml > 0) {
      const rf = FrontierModel.RISK_FREE;
      const slope = (this.tangency.mu - rf) / this.tangency.sigma;
      const end = Math.min(this.max.sigma, (this.max.mu - rf) / slope);
      ctx.strokeStyle = `rgba(${GOLD},0.7)`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(x(0), y(rf));
      ctx.lineTo(x(end * cml), y(rf + slope * end * cml));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${GOLD},0.8)`;
      ctx.beginPath();
      ctx.arc(x(0), y(rf), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${GOLD},${0.55 * cml})`;
      ctx.fillText(`Risk-free ${(rf * 100).toFixed(0)}%`, x(0) + 8, y(rf) + 16);
      ctx.fillText("Capital market line", x(end * 0.72) + 8, y(rf + slope * end * 0.72) - 8);
    }

    // The optimal (max-Sharpe) portfolio pulses.
    const star = span(8.6, 9.6);
    if (star > 0) {
      const px = x(this.tangency.sigma);
      const py = y(this.tangency.mu);
      const pulse = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(${GOLD},${0.18 * star * (0.5 + pulse)})`;
      ctx.beginPath();
      ctx.arc(px, py, 10 + pulse * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${GOLD},${star})`;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      const sharpe = (this.tangency.mu - FrontierModel.RISK_FREE) / this.tangency.sigma;
      ctx.fillStyle = `rgba(${GOLD},${0.85 * star})`;
      ctx.fillText("Optimal portfolio", px + 16, py - 6);
      ctx.fillStyle = `rgba(${INK},${0.5 * star})`;
      ctx.fillText(`E[r] ${(this.tangency.mu * 100).toFixed(1)}% · σ ${(this.tangency.sigma * 100).toFixed(1)}% · Sharpe ${sharpe.toFixed(2)}`, px + 16, py + 10);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Portfolio optimisation behind a full-bleed page: random portfolios, the
 * efficient frontier, the capital market line and the max-Sharpe portfolio,
 * on a 16 s loop. 2D canvas at 30 fps, paused while the tab is hidden; a
 * single still frame for visitors who prefer reduced motion.
 */
export function FrontierBackdrop({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let seed = 1;
    let scene = new FrontierScene(seed);
    let size = { w: 0, h: 0 };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: el.clientWidth, h: el.clientHeight };
      el.width = Math.round(size.w * dpr);
      el.height = Math.round(size.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new ResizeObserver(() => {
      resize();
      if (still) scene.draw(ctx, size.w, size.h, 11);
    });
    observer.observe(el);

    if (still) {
      scene.draw(ctx, size.w, size.h, 11);
      return () => observer.disconnect();
    }

    let frame = 0;
    let start = performance.now();
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      last = now;
      let t = (now - start) / 1000;
      if (t >= CYCLE_S) {
        start = now;
        t = 0;
        scene = new FrontierScene(++seed);
      }
      scene.draw(ctx, size.w, size.h, t);
    };
    // requestAnimationFrame already stops while the tab is hidden.
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden bg-canvas bg-grid-lines ${className}`}>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {/* Keep the cards readable: a soft glow top left, fading into the page at the bottom. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgb(34_211_238/0.1),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_17_32/0.2),transparent_40%,rgb(11_17_32/0.7))]" />
    </div>
  );
}
