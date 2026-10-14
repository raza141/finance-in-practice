import { type BackdropScene, GOLD, INK, Paint, QUANT } from "../Paint";

const TICK = 0.05;
const LEVELS = 12;
const EVERY_S = 0.22;
const TRAVEL_S = 0.55;

type Side = "buy" | "sell";

interface Order {
  at: number;
  side: Side;
  kind: "limit" | "market";
  /** Limit only: ticks away from the best price on its own side. */
  depth: number;
  size: number;
}

interface Print {
  at: number;
  side: Side;
  price: number;
  size: number;
}

/**
 * A tiny matching engine: limit orders join the book, market orders take the
 * best opposite prices (price-time priority), every fill prints to the tape and
 * the depth chart reshapes. Orders fly in from the sides; matches flash at the mid.
 */
export class OrderBookScene implements BackdropScene {
  /** Price level (in ticks) -> resting size. */
  private readonly bids = new Map<number, number>();
  private readonly asks = new Map<number, number>();
  private readonly orders: Order[] = [];
  private readonly prints: Print[] = [];
  private readonly random: () => number;
  private processed = 0;
  private scale = 0;

  constructor(seed: number) {
    this.random = Paint.random(seed * 104729);
    const mid = 2000; // 100.00
    for (let i = 0; i < LEVELS; i++) {
      this.bids.set(mid - 1 - i, this.size(400, 1600) * (1 + i * 0.25));
      this.asks.set(mid + i, this.size(400, 1600) * (1 + i * 0.25));
    }
    for (let at = 0.8; at < 13.5; at += EVERY_S * (0.6 + this.random() * 0.8)) {
      const market = this.random() < 0.38;
      this.orders.push({
        at,
        side: this.random() < 0.5 ? "buy" : "sell",
        kind: market ? "market" : "limit",
        depth: Math.floor(this.random() ** 2 * 8),
        size: market ? this.size(500, 2200) : this.size(200, 1200),
      });
    }
  }

  private size(min: number, max: number): number {
    return Math.round((min + this.random() * (max - min)) / 100) * 100;
  }

  private best(side: Side): number {
    const book = side === "buy" ? this.bids : this.asks;
    return side === "buy" ? Math.max(...book.keys()) : Math.min(...book.keys());
  }

  /** Applies every order that has arrived by `t` (time only moves forward within a scene). */
  private advance(t: number): void {
    while (this.processed < this.orders.length && this.orders[this.processed].at + TRAVEL_S <= t) {
      const order = this.orders[this.processed++];
      const own = order.side === "buy" ? this.bids : this.asks;
      if (order.kind === "limit") {
        // At the touch with a wide spread, a limit order improves the price by one tick.
        const inside = order.depth === 0 && this.best("sell") - this.best("buy") > 1;
        const level =
          order.side === "buy" ? this.best("buy") - order.depth + (inside ? 1 : 0) : this.best("sell") + order.depth - (inside ? 1 : 0);
        own.set(level, (own.get(level) ?? 0) + order.size);
        continue;
      }
      // Market order: walk the opposite side from the best price until filled.
      const book = order.side === "buy" ? this.asks : this.bids;
      let left = order.size;
      while (left > 0 && book.size > 0) {
        const level = this.best(order.side === "buy" ? "sell" : "buy");
        const resting = book.get(level) ?? 0;
        const fill = Math.min(left, resting);
        this.prints.push({ at: order.at + TRAVEL_S, side: order.side, price: level * TICK, size: fill });
        left -= fill;
        if (fill === resting) book.delete(level);
        else book.set(level, resting - fill);
      }
      this.refill();
    }
  }

  /** Market makers step back in after a sweep (spread back to 1–2 ticks), and LEVELS prices stay quoted on each side. */
  private refill(): void {
    while (this.bids.size && this.asks.size && this.best("sell") - this.best("buy") > 2) {
      this.bids.set(this.best("buy") + 1, this.size(200, 800));
      if (this.best("sell") - this.best("buy") > 2) this.asks.set(this.best("sell") - 1, this.size(200, 800));
    }
    for (const [book, side] of [[this.bids, "buy"], [this.asks, "sell"]] as const) {
      const best = book.size ? this.best(side) : side === "buy" ? this.best("sell") - 1 : this.best("buy") + 1;
      for (let i = 0; i < LEVELS; i++) {
        const level = side === "buy" ? best - i : best + i;
        if (!book.has(level)) book.set(level, this.size(300, 1400) * (1 + i * 0.25));
      }
      for (const level of book.keys()) if (Math.abs(level - best) >= LEVELS + 4) book.delete(level);
    }
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    this.advance(t);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Paint.fade(t);
    Paint.caption(ctx, w, h, "ORDER BOOK", "Limit orders rest · market orders match at the best price");

    const cx = w / 2;
    const base = h * 0.86;
    const tall = h * 0.5;
    const step = (w * 0.42) / LEVELS;
    const bestBid = this.best("buy");
    const bestAsk = this.best("sell");
    const cumulative = (side: Side) => {
      const book = side === "buy" ? this.bids : this.asks;
      const best = side === "buy" ? bestBid : bestAsk;
      let sum = 0;
      return Array.from({ length: LEVELS }, (_, i) => (sum += book.get(side === "buy" ? best - i : best + i) ?? 0));
    };
    const bidDepth = cumulative("buy");
    const askDepth = cumulative("sell");
    // Ease the vertical scale so a big order doesn't make the chart jump.
    const target = Math.max(bidDepth[LEVELS - 1], askDepth[LEVELS - 1]);
    this.scale = this.scale === 0 ? target : this.scale + (target - this.scale) * 0.08;
    const yOf = (v: number) => base - (v / this.scale) * tall;

    // Depth staircases: bids grow left of the mid, asks right.
    for (const [depth, sign, color] of [[bidDepth, -1, QUANT], [askDepth, 1, GOLD]] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, base);
      depth.forEach((v, i) => {
        ctx.lineTo(cx + sign * i * step, yOf(v));
        ctx.lineTo(cx + sign * (i + 1) * step, yOf(v));
      });
      ctx.lineTo(cx + sign * LEVELS * step, base);
      ctx.closePath();
      ctx.fillStyle = `rgba(${color},0.13)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${color},0.75)`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${INK},0.15)`;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, base);
    ctx.lineTo(w * 0.94, base);
    ctx.stroke();
    Paint.text(ctx, "BIDS", cx - LEVELS * step, base + 20, `rgba(${QUANT},0.6)`);
    Paint.text(ctx, "ASKS", cx + LEVELS * step, base + 20, `rgba(${GOLD},0.6)`, 11, "right");
    Paint.text(ctx, `${(bestBid * TICK).toFixed(2)}  |  ${(bestAsk * TICK).toFixed(2)}`, cx, base + 20, `rgba(${INK},0.7)`, 12, "center");
    Paint.text(ctx, `SPREAD ${((bestAsk - bestBid) * TICK).toFixed(2)}`, cx, base + 36, `rgba(${INK},0.4)`, 10, "center");

    // Orders in flight: buys from the left edge, sells from the right.
    for (const order of this.orders) {
      const p = (t - order.at) / TRAVEL_S;
      if (p < 0 || p > 1) continue;
      const fromX = order.side === "buy" ? 0 : w;
      const toX =
        order.kind === "market" ? cx : cx + (order.side === "buy" ? -1 : 1) * (order.depth + 0.5) * step;
      const e = Paint.ease(p);
      const px = fromX + (toX - fromX) * e;
      const py = base - tall * 0.9 + Math.sin(e * Math.PI) * -30 + e * tall * 0.6;
      const color = order.side === "buy" ? QUANT : GOLD;
      Paint.dot(ctx, px, py, order.kind === "market" ? 4 : 2.5, `rgba(${color},${order.kind === "market" ? 0.95 : 0.6})`);
    }

    // Matches flash at the mid.
    for (const print of this.prints) {
      const age = t - print.at;
      if (age < 0 || age > 0.8) continue;
      Paint.dot(ctx, cx, base - tall * 0.3, 6 + age * 30, `rgba(${INK},${0.35 * (1 - age / 0.8)})`);
    }

    // Trade tape, newest first.
    const tape = this.prints.filter((p) => p.at <= t).slice(-7).toReversed();
    const tx = w * 0.94;
    Paint.text(ctx, "TIME & SALES", tx, Paint.top(h), `rgba(${INK},0.45)`, 11, "right");
    tape.forEach((print, i) => {
      const color = print.side === "buy" ? QUANT : GOLD;
      const alpha = (i === 0 ? 0.95 : 0.6) * (1 - i * 0.1);
      Paint.text(
        ctx,
        `${print.side === "buy" ? "BUY " : "SELL"} ${print.size.toLocaleString("en-US").padStart(5)} @ ${print.price.toFixed(2)}`,
        tx,
        Paint.top(h) + 20 + i * 16,
        `rgba(${color},${alpha})`,
        11,
        "right",
      );
    });
  }
}
