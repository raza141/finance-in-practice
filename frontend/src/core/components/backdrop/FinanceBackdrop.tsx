"use client";

import { useEffect, useRef } from "react";

import { type BackdropScene, SCENE_S } from "./Paint";
import { AllocationScene } from "./scenes/AllocationScene";
import { CorrelationScene } from "./scenes/CorrelationScene";
import { FrontierScene } from "./scenes/FrontierScene";
import { OrderBookScene } from "./scenes/OrderBookScene";
import { TradeScene } from "./scenes/TradeScene";

/** The rotation, in order. Each page can start at a different one. */
const SCENES: readonly ((seed: number) => BackdropScene)[] = [
  (seed) => new FrontierScene(seed),
  (seed) => new TradeScene(seed),
  (seed) => new OrderBookScene(seed),
  (seed) => new CorrelationScene(seed),
  (seed) => new AllocationScene(seed),
];

export type BackdropTheme = "frontier" | "trade" | "orderbook" | "correlation" | "allocation";
const START: Record<BackdropTheme, number> = { frontier: 0, trade: 1, orderbook: 2, correlation: 3, allocation: 4 };

const FPS = 30;

/**
 * Finance animations behind a full-bleed page, one after another (16 s each):
 * portfolio optimisation, a trade's P&L, order-book matching, correlations and
 * IPS-driven rebalancing. 2D canvas at 30 fps; stops while off screen or in a
 * hidden tab; a single still frame for visitors who prefer reduced motion.
 */
export function FinanceBackdrop({
  start = "frontier",
  dim = false,
  className = "",
}: {
  start?: BackdropTheme;
  /** Softer, for pages dense with text (contact, instructor). */
  dim?: boolean;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let index = START[start];
    let seed = 1;
    let scene = SCENES[index](seed);
    let size = { w: 0, h: 0 };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: el.clientWidth, h: el.clientHeight };
      el.width = Math.round(size.w * dpr);
      el.height = Math.round(size.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) scene.draw(ctx, size.w, size.h, 11);
    };
    resize();
    const resizes = new ResizeObserver(resize);
    resizes.observe(el);
    if (still) return () => resizes.disconnect();

    let frame = 0;
    let elapsed = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      // Long gaps (hidden tab) don't fast-forward the scene.
      elapsed += Math.min(now - last, 100) / 1000;
      last = now;
      if (elapsed >= SCENE_S) {
        elapsed = 0;
        index = (index + 1) % SCENES.length;
        scene = SCENES[index](++seed);
      }
      scene.draw(ctx, size.w, size.h, elapsed);
    };
    const play = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const pause = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const views = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()));
    views.observe(el);
    play();
    return () => {
      pause();
      views.disconnect();
      resizes.disconnect();
    };
  }, [start]);

  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden bg-canvas bg-grid-lines ${className}`}>
      <canvas ref={canvas} className={`absolute inset-0 h-full w-full ${dim ? "opacity-55" : ""}`} />
      {/* Keep the content readable: a soft glow top left, fading into the page at the bottom. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgb(34_211_238/0.1),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(11_17_32/0.2),transparent_40%,rgb(11_17_32/0.7))]" />
    </div>
  );
}
