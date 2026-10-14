import { type BackdropScene, GOLD, INK, Paint, QUANT, RED } from "../Paint";

const POINTS = 170;
const ENTRY_AT = 34;
const SHARES = 2_000;

/**
 * One trade from entry to exit: the price prints left to right, a long entry
 * sets a take-profit (+3%) and a stop-loss (−1.5%, so 2:1 reward to risk), the
 * P&L ticks with the price, and the trade closes when either level is hit.
 */
export class TradeScene implements BackdropScene {
  private readonly prices: number[];
  private readonly entry: number;
  private readonly target: number;
  private readonly stop: number;
  /** Index where the target or stop was hit. */
  private readonly exitAt: number;
  private readonly exit: "target" | "stop" | "time";
  private readonly low: number;
  private readonly high: number;

  constructor(seed: number) {
    const random = Paint.random(seed * 7919);
    // Two wins for every loss: the drift after entry decides which level the walk reaches.
    const wins = random() < 0.67;
    const prices = [100];
    for (let i = 1; i < POINTS; i++) {
      const drift = i > ENTRY_AT ? (wins ? 0.035 : -0.022) : 0;
      prices.push(prices[i - 1] * (1 + (random() - 0.5) * 0.011 + drift / 100));
    }
    this.entry = prices[ENTRY_AT];
    this.target = this.entry * 1.03;
    this.stop = this.entry * 0.985;
    const hit = prices.findIndex((p, i) => i > ENTRY_AT && (p >= this.target || p <= this.stop));
    this.exitAt = hit === -1 ? POINTS - 1 : hit;
    this.exit = hit === -1 ? "time" : prices[hit] >= this.target ? "target" : "stop";
    this.prices = prices;
    this.low = Math.min(this.stop, ...prices) * 0.995;
    this.high = Math.max(this.target, ...prices) * 1.005;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Paint.fade(t);
    Paint.caption(ctx, w, h, "TRADE & RISK", "Long entry · stop-loss · take-profit · live P&L");
    const left = w * 0.06;
    const right = w * 0.94;
    const top = h * 0.2;
    const bottom = h * 0.85;
    const x = (i: number) => left + (i / (POINTS - 1)) * (right - left);
    const y = (p: number) => bottom - ((p - this.low) / (this.high - this.low)) * (bottom - top);
    const shown = Math.max(2, Math.min(POINTS, Math.floor(POINTS * Math.min(t / 12, 1))));
    const now = shown - 1;

    // Price line with a soft area under it.
    ctx.beginPath();
    for (let i = 0; i < shown; i++) (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x(i), y(this.prices[i]));
    ctx.strokeStyle = `rgba(${QUANT},0.85)`;
    ctx.lineWidth = 2;
    ctx.shadowColor = `rgba(${QUANT},0.6)`;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineTo(x(now), bottom);
    ctx.lineTo(x(0), bottom);
    const area = ctx.createLinearGradient(0, top, 0, bottom);
    area.addColorStop(0, `rgba(${QUANT},0.16)`);
    area.addColorStop(1, `rgba(${QUANT},0)`);
    ctx.fillStyle = area;
    ctx.fill();
    Paint.dot(ctx, x(now), y(this.prices[now]), 3.5, `rgba(${QUANT},1)`);
    Paint.text(ctx, this.prices[now].toFixed(2), x(now) + 8, y(this.prices[now]) - 8, `rgba(${INK},0.7)`);

    if (now < ENTRY_AT) return;
    const open = now < this.exitAt;
    const levels = Paint.span(t, (ENTRY_AT / POINTS) * 12, (ENTRY_AT / POINTS) * 12 + 0.8);
    const level = (price: number, color: string, label: string) => {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = `rgba(${color},${0.7 * levels})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x(ENTRY_AT), y(price));
      ctx.lineTo(x(ENTRY_AT) + (right - x(ENTRY_AT)) * levels, y(price));
      ctx.stroke();
      ctx.setLineDash([]);
      Paint.text(ctx, `${label} ${price.toFixed(2)}`, right, y(price) - 6, `rgba(${color},${0.8 * levels})`, 11, "right");
    };
    level(this.target, QUANT, "TAKE PROFIT");
    level(this.stop, RED, "STOP LOSS");
    level(this.entry, GOLD, "ENTRY");

    // Entry marker.
    const ex = x(ENTRY_AT);
    const ey = y(this.entry);
    ctx.fillStyle = `rgba(${GOLD},${levels})`;
    ctx.beginPath();
    ctx.moveTo(ex, ey - 9);
    ctx.lineTo(ex - 7, ey + 4);
    ctx.lineTo(ex + 7, ey + 4);
    ctx.fill();
    Paint.text(ctx, `BUY ${SHARES.toLocaleString("en-US")} @ ${this.entry.toFixed(2)}`, ex, ey + 22, `rgba(${GOLD},${0.85 * levels})`, 11, "center");

    // Live (or final) P&L, top right.
    const price = this.prices[Math.min(now, this.exitAt)];
    const pnl = (price - this.entry) * SHARES;
    const pct = ((price - this.entry) / this.entry) * 100;
    const color = pnl >= 0 ? QUANT : RED;
    Paint.text(ctx, open ? "OPEN P&L" : { target: "TAKE PROFIT HIT · CLOSED", stop: "STOPPED OUT · CLOSED", time: "CLOSED AT THE BELL" }[this.exit], right, Paint.top(h), `rgba(${INK},0.45)`, 11, "right");
    Paint.text(ctx, `${Paint.money(pnl)}  ${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%`, right, Paint.top(h) + 22, `rgba(${color},0.9)`, 18, "right");

    if (!open) {
      const xx = x(this.exitAt);
      const yy = y(this.prices[this.exitAt]);
      const flash = Paint.span(t, (this.exitAt / POINTS) * 12, (this.exitAt / POINTS) * 12 + 0.6);
      Paint.dot(ctx, xx, yy, 14 * (1 - flash) + 5, `rgba(${color},${0.25 + 0.5 * (1 - flash)})`);
      Paint.dot(ctx, xx, yy, 5, `rgba(${color},1)`);
    }
  }
}
