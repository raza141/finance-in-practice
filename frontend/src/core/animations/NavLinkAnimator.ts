import { animate, utils } from "animejs";

/**
 * Hover choreography for navbar links: text brightens from muted slate to
 * ink while a cyan underline scales out from the centre.
 *
 * Expects each link to contain `[data-nav-label]` and `[data-nav-underline]`.
 */
export class NavLinkAnimator {
  static readonly MUTED = "#94A3B8";
  static readonly INK = "#F8FAFC";

  enter(link: HTMLElement): void {
    this.to(link, { color: NavLinkAnimator.INK, scaleX: 1, duration: 320 });
  }

  leave(link: HTMLElement): void {
    this.to(link, { color: NavLinkAnimator.MUTED, scaleX: 0, duration: 260 });
  }

  private to(link: HTMLElement, target: { color: string; scaleX: number; duration: number }): void {
    const label = link.querySelector<HTMLElement>("[data-nav-label]");
    const underline = link.querySelector<HTMLElement>("[data-nav-underline]");
    if (!label || !underline) return;

    if (this.reducedMotion) {
      utils.set(label, { color: target.color });
      utils.set(underline, { scaleX: target.scaleX });
      return;
    }
    animate(label, { color: target.color, duration: target.duration, ease: "outQuad" });
    animate(underline, { scaleX: target.scaleX, duration: target.duration, ease: "outExpo" });
  }

  private get reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
