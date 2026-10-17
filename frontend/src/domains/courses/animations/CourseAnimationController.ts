import { animate, scrambleText, stagger } from "animejs";

/** `data-course-anim` hooks in CourseView. Content is real HTML either way; these only move and fade it. */
export const CourseAnimHook = {
  scramble: "scramble",
} as const;

type Revertible = { revert: () => unknown };

/**
 * Owns a course page's one animated moment: the hero title and exam numbers
 * decode terminal-style on load. Everything below is simply there.
 * With `prefers-reduced-motion` nothing runs and the page stays as rendered.
 */
export class CourseAnimationController {
  private readonly animations: Revertible[] = [];
  private readonly reducedMotion: boolean;

  constructor(private readonly root: HTMLElement) {
    this.reducedMotion =
      root.ownerDocument.defaultView?.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? true;
  }

  start(): void {
    if (this.reducedMotion) return;
    this.decodeHero();
  }

  destroy(): void {
    this.animations.forEach((animation) => animation.revert());
    this.animations.length = 0;
  }

  private decodeHero(): void {
    const targets = this.hooks(CourseAnimHook.scramble);
    if (targets.length === 0) return;
    this.animations.push(
      animate(targets, {
        innerHTML: scrambleText({ chars: "A-Z0-9", cursor: true }),
        duration: 1100,
        delay: stagger(120),
        ease: "outQuad",
      }),
    );
  }

  private hooks(name: string, scope: ParentNode = this.root): HTMLElement[] {
    return Array.from(scope.querySelectorAll<HTMLElement>(`[data-course-anim="${name}"]`));
  }
}
