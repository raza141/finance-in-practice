import {
  animate,
  createTimeline,
  onScroll,
  scrambleText,
  stagger,
  utils,
} from "animejs";

import { ScrollManager } from "@/core/animations/ScrollManager";
import { ScrollStory } from "@/core/animations/ScrollStory";

/** `data-course-anim` hooks in CourseView. Content is real HTML either way; these only move and fade it. */
export const CourseAnimHook = {
  scramble: "scramble",
  journey: "journey",
  journeyLine: "journey-line",
  stage: "stage",
  weights: "weights",
  weightBar: "weight-bar",
  story: "story",
  option: "option",
} as const;

type Revertible = { revert: () => unknown };

/**
 * Owns every anime.js animation on a course page:
 *   hero title and exam numbers decode terminal-style on load,
 *   the method line draws with the scroll and lights each stage as it passes,
 *   curriculum weight bars grow to their share when the list comes into view.
 * With `prefers-reduced-motion` nothing runs and the page stays as rendered.
 */
export class CourseAnimationController {
  private readonly animations: Revertible[] = [];
  private readonly scroll = new ScrollManager();
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
    // Pinned where the screen is big enough (method stages, pricing options); otherwise the method keeps its scroll-drawn line.
    const pinned = new Set(this.hooks(CourseAnimHook.story).filter((track) => this.pinStory(track)));
    this.hooks(CourseAnimHook.journey)
      .filter((journey) => ![...pinned].some((track) => track.contains(journey)))
      .forEach((journey) => this.drawJourney(journey));
    this.hooks(CourseAnimHook.weights).forEach((list) =>
      this.growWeights(list),
    );
  }

  destroy(): void {
    this.scroll.disconnect();
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

  /** Scroll-scrubbed: the rail grows from the first stage to the last, reaching each one as it lights up. */
  private drawJourney(journey: HTMLElement): void {
    const stages = this.hooks(CourseAnimHook.stage, journey);
    const line = journey.querySelector<HTMLElement>(
      `[data-course-anim="${CourseAnimHook.journeyLine}"]`,
    );
    // A timeline only applies a child's start values once its playhead reaches it, so dim every stage up front.
    this.animations.push(utils.set(stages, { opacity: 0.35, translateY: 16 }));
    if (line) this.animations.push(utils.set(line, { scaleX: 0 }));
    const timeline = createTimeline({
      defaults: { ease: "linear", duration: 1000 },
      autoplay: onScroll({
        target: journey,
        enter: { container: "bottom", target: "top" },
        leave: { container: "center", target: "bottom" },
        sync: 0.4,
      }),
    });
    if (line)
      timeline.add(
        line,
        { scaleX: 1, duration: Math.max(1, stages.length - 1) * 1000 },
        0,
      );
    stages.forEach((stage, i) => {
      timeline.add(
        stage,
        { opacity: 1, translateY: 0, duration: 600 },
        i * 1000,
      );
    });
    this.animations.push(timeline);
  }

  /** Pins a `story` track through ScrollStory: method stages (with their line) or pricing options. False when it can't pin here. */
  private pinStory(track: HTMLElement): boolean {
    const stage = track.querySelector<HTMLElement>("[data-story-stage]");
    if (!stage) return false;
    const stages = this.hooks(CourseAnimHook.stage, track);
    const steps = stages.length > 0 ? stages : this.hooks(CourseAnimHook.option, track);
    const rail = track.querySelector<HTMLElement>(`[data-course-anim="${CourseAnimHook.journeyLine}"]`);
    const animations = ScrollStory.pin(track, stage, { steps, rail });
    if (!animations) return false;
    this.animations.push(...animations);
    return true;
  }

  private growWeights(list: HTMLElement): void {
    const bars = this.hooks(CourseAnimHook.weightBar, list);
    if (bars.length === 0) return;
    this.scroll.onEnter(
      list,
      () => {
        this.animations.push(
          animate(bars, {
            scaleX: [0, 1],
            delay: stagger(70),
            duration: 1100,
            ease: "outExpo",
          }),
        );
      },
      { threshold: 0.1 },
    );
  }

  private hooks(name: string, scope: ParentNode = this.root): HTMLElement[] {
    return Array.from(
      scope.querySelectorAll<HTMLElement>(`[data-course-anim="${name}"]`),
    );
  }
}
