import { animate, createTimeline, stagger, utils } from "animejs";

import { ScrollManager } from "./ScrollManager";

/**
 * Hooks used in markup. Elements carrying `data-anim` are hidden by CSS only
 * while `<html>` has the READY class, and are revealed by this controller.
 */
export const AnimHook = {
  nav: "nav",
  heroWord: "hero-word",
  heroSubtitle: "hero-subtitle",
  heroCta: "hero-cta",
  heroCanvas: "hero-canvas",
  credential: "credential",
  pillar: "pillar",
  reveal: "reveal",
} as const;

type Revertible = { revert: () => unknown };

/**
 * Owns every anime.js animation on the landing page.
 *
 * Lifecycle: construct on mount -> `initHero()` -> `register*()` scroll
 * sequences -> `destroy()` on unmount (reverts inline styles and observers).
 * With `prefers-reduced-motion`, every method shows final states instantly.
 */
export class LandingAnimationController {
  static readonly READY_CLASS = "anim-ready";
  static readonly BOOTED_CLASS = "anim-booted";

  private readonly animations: Revertible[] = [];
  private readonly scroll = new ScrollManager();
  private readonly reducedMotion: boolean;

  constructor(private readonly root: HTMLElement) {
    const view = root.ownerDocument.defaultView;
    this.reducedMotion = view?.matchMedia("(prefers-reduced-motion: reduce)").matches ?? true;
    if (!this.reducedMotion) {
      // The pre-paint script sets READY on first load of "/"; set it here too for
      // client-side navigations and StrictMode re-mounts. BOOTED cancels the CSS
      // safety reveal now that JS is in control.
      this.html.classList.add(
        LandingAnimationController.READY_CLASS,
        LandingAnimationController.BOOTED_CLASS,
      );
    }
  }

  /** Page-load choreography: nav -> headline words -> subtitle -> CTAs -> 3D canvas. */
  initHero(): void {
    if (this.reducedMotion) return;
    const timeline = createTimeline({ defaults: { ease: "outExpo", duration: 900 } })
      // The header lives in the root layout, outside this page's root.
      .add(this.hooks(AnimHook.nav, this.root.ownerDocument), { opacity: [0, 1], translateY: [-24, 0], duration: 700 })
      .add(
        this.hooks(AnimHook.heroWord),
        { opacity: [0, 1], translateY: ["0.6em", "0em"], delay: stagger(70) },
        "-=400",
      )
      .add(this.hooks(AnimHook.heroSubtitle), { opacity: [0, 1], translateY: [16, 0] }, "-=600")
      .add(
        this.hooks(AnimHook.heroCta),
        { opacity: [0, 1], translateY: [16, 0], delay: stagger(90) },
        "-=650",
      )
      .add(
        this.hooks(AnimHook.heroCanvas),
        { opacity: [0, 1], scale: [0.92, 1], duration: 1400 },
        "-=800",
      );
    this.animations.push(timeline);
  }

  /** Credentials cascade in left-to-right once the bar is visible. */
  registerCredentials(container: Element): void {
    this.onEnter(container, () =>
      animate(this.hooks(AnimHook.credential, container), {
        opacity: [0, 1],
        translateY: [12, 0],
        delay: stagger(120),
        duration: 700,
        ease: "outExpo",
      }),
    );
  }

  /** Service cards tilt up from 90deg back, 120ms apart (parent provides perspective). */
  revealServices(container: Element): void {
    this.onEnter(
      container,
      () =>
        animate(this.hooks(AnimHook.pillar, container), {
          opacity: [0, 1],
          rotateX: [90, 0],
          translateY: [40, 0],
          delay: stagger(120),
          duration: 1100,
          ease: "outExpo",
        }),
      { threshold: 0.15 },
    );
  }

  /**
   * Count `[data-count-to]` elements up from 0 with easeOutExpo.
   * Reads `data-count-decimals`, `data-count-prefix` and `data-count-suffix`.
   */
  registerCounters(container: Element): void {
    const counters = Array.from(container.querySelectorAll<HTMLElement>("[data-count-to]"));
    this.onEnter(container, () => {
      for (const el of counters) {
        const target = Number(el.dataset.countTo);
        const decimals = Number(el.dataset.countDecimals ?? 0);
        const format = LandingAnimationController.formatter(decimals);
        const write = (value: number) => {
          el.textContent = `${el.dataset.countPrefix ?? ""}${format(value)}${el.dataset.countSuffix ?? ""}`;
        };
        const state = { value: 0 };
        write(0);
        this.animations.push(
          animate(state, {
            value: target,
            duration: 2200,
            ease: "outExpo",
            modifier: utils.round(decimals),
            onUpdate: () => write(state.value),
            onComplete: () => write(target),
          }),
        );
      }
    });
  }

  /** Generic fade-up for `[data-anim="reveal"]` blocks inside `container`. */
  registerReveal(container: Element): void {
    this.onEnter(container, () =>
      animate(this.hooks(AnimHook.reveal, container), {
        opacity: [0, 1],
        translateY: [24, 0],
        delay: stagger(100),
        duration: 900,
        ease: "outExpo",
      }),
    );
  }

  /**
   * Revert every inline style and drop READY so persistent layout elements
   * (the header lives in the root layout) stay visible on other routes.
   */
  destroy(): void {
    this.scroll.disconnect();
    this.animations.forEach((animation) => animation.revert());
    this.animations.length = 0;
    this.html.classList.remove(
      LandingAnimationController.READY_CLASS,
      LandingAnimationController.BOOTED_CLASS,
    );
  }

  // ------------------------------------------------------------------------

  private onEnter(
    container: Element,
    play: () => Revertible | void,
    options?: { threshold?: number },
  ): void {
    if (this.reducedMotion) return;
    this.scroll.onEnter(
      container,
      () => {
        const animation = play();
        if (animation) this.animations.push(animation);
      },
      options,
    );
  }

  private get html(): HTMLElement {
    return this.root.ownerDocument.documentElement;
  }

  private hooks(name: string, scope: ParentNode = this.root): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(`[data-anim="${name}"]`));
  }

  private static formatter(decimals: number): (value: number) => string {
    const nf = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return (value) => nf.format(value);
  }
}
