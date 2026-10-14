/** Shared colours, timing and text helpers for the backdrop scenes (2D canvas). */
export const QUANT = "34,211,238";
export const GOLD = "212,175,55";
export const RED = "248,113,113";
export const INK = "203,213,225";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Every scene runs this long, then the next one takes over. */
export const SCENE_S = 16;

/** One full-bleed animation: `t` is seconds since the scene started (0..SCENE_S). */
export interface BackdropScene {
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
}

export class Paint {
  static ease(v: number): number {
    return v <= 0 ? 0 : v >= 1 ? 1 : 1 - (1 - v) ** 3;
  }

  /** 0 before `from`, eased to 1 at `to`. */
  static span(t: number, from: number, to: number): number {
    return Paint.ease((t - from) / (to - from));
  }

  /** Fades every scene in over its first second and out over its last two. */
  static fade(t: number): number {
    return Math.min(Paint.span(t, 0, 1), 1 - Paint.span(t, SCENE_S - 2, SCENE_S));
  }

  /** Seeded LCG in [0, 1): the same seed draws the same scene. */
  static random(seed: number): () => number {
    let state = seed >>> 0 || 1;
    return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  static text(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 11, align: CanvasTextAlign = "left"): void {
    ctx.font = `${size}px ${MONO}`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** Top line for captions and readouts: clear of the floating navbar even on short sections. */
  static top(h: number): number {
    return Math.max(h * 0.11, 120);
  }

  /** Faint caption naming the scene, bottom left: page headings own the top of the screen. */
  static caption(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, subtitle: string): void {
    Paint.text(ctx, title, w * 0.06, h - 38, `rgba(${QUANT},0.6)`, 11);
    Paint.text(ctx, subtitle, w * 0.06, h - 22, `rgba(${INK},0.4)`, 11);
  }

  static dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  static money(value: number): string {
    return `${value < 0 ? "−" : "+"}AED ${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
  }
}
