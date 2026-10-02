import { animate, createAnimatable, utils, type AnimatableObject } from "animejs";

/**
 * Drives the global custom cursor: a ring that trails the pointer and
 * collapses into a solid dot over interactive elements.
 *
 * Position uses an Anime.js animatable (x/y retargeted on every mousemove,
 * which gives the lerped trailing feel). Hover state is detected with a
 * single delegated `pointerover`/`pointerout` pair, so elements rendered
 * after mount (route changes, terminal output) are covered automatically.
 */
export class CustomCursorController {
  static readonly INTERACTIVE =
    'a, button, [role="button"], input, textarea, select, label[for], [data-cursor="hover"]';

  private static readonly INK = "rgba(248, 250, 252, 1)";
  private static readonly INK_CLEAR = "rgba(248, 250, 252, 0)";
  private static readonly RING_BORDER = "rgba(248, 250, 252, 0.5)";

  private readonly position: AnimatableObject;
  private visible = false;
  private hovering = false;

  constructor(private readonly el: HTMLElement) {
    const trail = this.reducedMotion ? 0 : 220;
    this.position = createAnimatable(el, { x: trail, y: trail, ease: "out(3)" });
    utils.set(el, { opacity: 0 });
  }

  attach(): void {
    window.addEventListener("mousemove", this.onMove, { passive: true });
    document.addEventListener("pointerover", this.onOver);
    document.addEventListener("pointerout", this.onOut);
    document.documentElement.addEventListener("mouseleave", this.onExit);
  }

  detach(): void {
    window.removeEventListener("mousemove", this.onMove);
    document.removeEventListener("pointerover", this.onOver);
    document.removeEventListener("pointerout", this.onOut);
    document.documentElement.removeEventListener("mouseleave", this.onExit);
    this.position.revert();
    utils.remove(this.el);
  }

  private readonly onMove = (event: MouseEvent): void => {
    if (!this.visible) {
      // Jump to the first known position instead of sweeping in from 0,0.
      utils.set(this.el, { x: event.clientX, y: event.clientY });
      this.fade(1);
    }
    this.position.x(event.clientX);
    this.position.y(event.clientY);
  };

  private readonly onOver = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    if (this.interactiveFrom(event.target)) this.setHover(true);
  };

  private readonly onOut = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    // Moving between children of the same link must not flicker the state.
    if (!this.interactiveFrom(event.relatedTarget)) this.setHover(false);
  };

  private readonly onExit = (): void => {
    this.fade(0);
  };

  private setHover(next: boolean): void {
    if (next === this.hovering) return;
    this.hovering = next;

    const target = next
      ? { scale: 0.25, backgroundColor: CustomCursorController.INK, borderColor: CustomCursorController.INK_CLEAR }
      : { scale: 1, backgroundColor: CustomCursorController.INK_CLEAR, borderColor: CustomCursorController.RING_BORDER };

    if (this.reducedMotion) {
      utils.set(this.el, target);
      return;
    }
    animate(this.el, { ...target, duration: next ? 320 : 380, ease: "outExpo" });
  }

  private fade(opacity: 0 | 1): void {
    this.visible = opacity === 1;
    animate(this.el, { opacity, duration: this.reducedMotion ? 0 : 200, ease: "outQuad" });
  }

  private interactiveFrom(node: EventTarget | null): boolean {
    return node instanceof Element && node.closest(CustomCursorController.INTERACTIVE) !== null;
  }

  private get reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
