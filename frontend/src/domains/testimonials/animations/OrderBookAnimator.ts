import { animate, utils, type JSAnimation } from "animejs";

/**
 * anime.js choreography for the testimonials order book: the infinite ticker
 * tape and the self-drawing sparklines. Every animation is tracked so React
 * effects can stop them on unmount (effects run twice in development).
 */
export class OrderBookAnimator {
  /** Tape speed, independent of how many quotes it holds. */
  private static readonly TAPE_PX_PER_SECOND = 45;

  private readonly running: JSAnimation[] = [];

  /**
   * Scroll `track` left forever. The track holds its items twice in a row,
   * so shifting it by exactly half its width lands on an identical frame
   * and the loop restarts with no visible jump.
   */
  tape(track: HTMLElement): void {
    if (OrderBookAnimator.reducedMotion) return;
    const distance = track.scrollWidth / 2;
    if (distance <= 0) return;
    this.track(
      animate(track, {
        translateX: [0, -distance],
        duration: (distance / OrderBookAnimator.TAPE_PX_PER_SECOND) * 1000,
        ease: "linear",
        loop: true,
      }),
    );
  }

  /** Pause the tape while the pointer is over it, so a quote can be read. */
  setTapePaused(paused: boolean): void {
    for (const animation of this.running) {
      if (paused) animation.pause();
      else animation.play();
    }
  }

  /**
   * Draw a sparkline from its first point to its last by animating
   * stroke-dashoffset (the path is normalised with pathLength="1"), then fade
   * in the end marker.
   */
  drawSparkline(path: SVGPathElement, marker: SVGElement | null, delay = 0): void {
    if (OrderBookAnimator.reducedMotion) return;
    utils.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
    this.track(animate(path, { strokeDashoffset: [1, 0], duration: 1100, delay, ease: "inOutQuad" }));
    if (marker) {
      utils.set(marker, { opacity: 0 });
      this.track(animate(marker, { opacity: [0, 1], scale: [0.4, 1], duration: 400, delay: delay + 950, ease: "outBack" }));
    }
  }

  stop(): void {
    for (const animation of this.running.splice(0)) animation.revert();
  }

  private track(animation: JSAnimation): void {
    this.running.push(animation);
  }

  private static get reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
