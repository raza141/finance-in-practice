import { animate, stagger, utils } from "animejs";

import type { CosmicState } from "@/core/components/3d/CosmicState";

/**
 * Scroll choreography for /about. Each `[data-instructor]` section owns one
 * camera pose; when a section takes over the viewport its `[data-reveal]`
 * children stream in and the vortex fires a warp pulse, so scrolling reads
 * as travelling from one instructor to the next.
 */
export class InstructorScrollController {
  /** Camera poses per section: intro first, then one per instructor. */
  private static readonly POSES = [
    { tilt: 1.05, zoom: 9 },
    { tilt: 0.45, zoom: 7.2 },
    { tilt: 1.3, zoom: 6.4 },
    { tilt: 0.8, zoom: 7.8 },
  ];
  private static readonly SPIN_PER_PAGE = Math.PI * 0.9;

  private readonly sections: HTMLElement[];
  private readonly observer: IntersectionObserver;
  private readonly revealed = new Set<HTMLElement>();
  private active = -1;
  private frame = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: CosmicState,
  ) {
    this.sections = Array.from(root.querySelectorAll<HTMLElement>("[data-instructor]"));
    this.observer = new IntersectionObserver(this.onIntersect, { threshold: 0.5 });
  }

  attach(): void {
    if (!this.reducedMotion) {
      for (const section of this.sections) {
        utils.set(section.querySelectorAll("[data-reveal]"), { opacity: 0, y: 36, filter: "blur(10px)" });
      }
    }
    this.sections.forEach((section) => this.observer.observe(section));
    window.addEventListener("scroll", this.onScroll, { passive: true });
    this.onScroll();
  }

  detach(): void {
    this.observer.disconnect();
    window.removeEventListener("scroll", this.onScroll);
    cancelAnimationFrame(this.frame);
    utils.remove(this.state);
    for (const section of this.sections) utils.remove(section.querySelectorAll("[data-reveal]"));
  }

  private readonly onScroll = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      // Continuous spin tied to scroll distance: the galaxy turns as you travel.
      const scrolled = Math.max(0, -this.root.getBoundingClientRect().top);
      this.state.spin = (scrolled / window.innerHeight) * InstructorScrollController.SPIN_PER_PAGE;
    });
  };

  private readonly onIntersect = (entries: IntersectionObserverEntry[]): void => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = this.sections.indexOf(entry.target as HTMLElement);
      if (index !== -1) this.activate(index);
    }
  };

  private activate(index: number): void {
    if (index === this.active) return;
    const first = this.active === -1;
    this.active = index;

    const poses = InstructorScrollController.POSES;
    const pose = poses[index % poses.length];
    this.state.tilt = pose.tilt;
    this.state.zoom = pose.zoom;

    this.root.querySelectorAll<HTMLElement>("[data-instructor-dot]").forEach((dot, i) => {
      dot.dataset.active = String(i === index - 1);
    });

    if (this.reducedMotion) return;
    if (!first) animate(this.state, { warp: [0, 1, 0], duration: 1600, ease: "inOutSine" });

    const section = this.sections[index];
    if (this.revealed.has(section)) return;
    this.revealed.add(section);
    animate(section.querySelectorAll("[data-reveal]"), {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 1100,
      delay: stagger(90, { start: first ? 0 : 250 }),
      ease: "outExpo",
    });
  }

  private get reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
