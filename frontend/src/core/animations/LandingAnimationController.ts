import { createTimeline, stagger } from "animejs";

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
} as const;

type Revertible = { revert: () => unknown };

/**
 * Owns the landing page's one animated moment: the hero on page load.
 * Sections below it don't animate in; they are simply there.
 *
 * Lifecycle: construct on mount -> `initHero()` -> `destroy()` on unmount (reverts inline styles).
 * With `prefers-reduced-motion`, every method shows final states instantly.
 */
export class LandingAnimationController {
  static readonly READY_CLASS = "anim-ready";
  static readonly BOOTED_CLASS = "anim-booted";

  private readonly animations: Revertible[] = [];
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

  /**
   * Revert every inline style and drop READY so persistent layout elements
   * (the header lives in the root layout) stay visible on other routes.
   */
  destroy(): void {
    this.animations.forEach((animation) => animation.revert());
    this.animations.length = 0;
    this.html.classList.remove(
      LandingAnimationController.READY_CLASS,
      LandingAnimationController.BOOTED_CLASS,
    );
  }

  // ------------------------------------------------------------------------

  private get html(): HTMLElement {
    return this.root.ownerDocument.documentElement;
  }

  private hooks(name: string, scope: ParentNode = this.root): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(`[data-anim="${name}"]`));
  }
}
