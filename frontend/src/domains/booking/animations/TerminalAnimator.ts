import { animate, createTimeline, stagger, svg, utils } from "animejs";

type Pausable = { pause: () => unknown };

export interface ExecutionTargets {
  book: HTMLElement | null;
  flash: HTMLElement | null;
  readout: HTMLElement;
  finalText: string;
}

/**
 * All anime.js v4 choreography for the booking terminal.
 *
 * SSR-safe to construct (no DOM access until a method runs). Every method
 * jumps straight to the end state when the user prefers reduced motion.
 */
export class TerminalAnimator {
  static readonly SCRAMBLE_CHARSET = "0123456789ABCDEF#$%&*+=<>/";

  private readonly running: Pausable[] = [];

  /** Slide the tab underline under `target` (or fade it out when null). */
  moveIndicator(indicator: HTMLElement, target: HTMLElement | null): void {
    const params: Record<string, number> = target
      ? { translateX: target.offsetLeft, width: target.offsetWidth, opacity: 1 }
      : { opacity: 0 };
    if (this.reducedMotion) {
      utils.set(indicator, params);
      return;
    }
    this.track(animate(indicator, { ...params, duration: 380, ease: "outExpo" }));
  }

  /** Draw the yield-curve path left to right and fade in its range band. */
  drawCurve(path: SVGPathElement, band: SVGPathElement | null): void {
    if (this.reducedMotion) return;
    this.track(
      animate(svg.createDrawable(path, 0, 0), { draw: ["0 0", "0 1"], duration: 800, ease: "outExpo" }),
    );
    if (band) {
      this.track(animate(band, { opacity: [0, 1], duration: 900, delay: 150, ease: "outExpo" }));
    }
  }

  /** Snap the gold limit-order line outwards from the chosen node to both chart edges. */
  snapLimitLine(line: SVGLineElement, fromX: number, left: number, right: number): void {
    if (this.reducedMotion) {
      utils.set(line, { x1: left, x2: right, opacity: 1 });
      return;
    }
    this.track(
      animate(line, {
        x1: [fromX, left],
        x2: [fromX, right],
        opacity: [0.4, 1],
        duration: 1100,
        ease: "outElastic(1, .55)",
      }),
    );
  }

  /** Slide the L2 order book open and stagger its rows in. */
  openOrderBook(book: HTMLElement): void {
    const rows = book.querySelectorAll<HTMLElement>("[data-book-row]");
    if (this.reducedMotion) return;
    this.track(
      animate(book, {
        height: [0, book.scrollHeight],
        opacity: [0, 1],
        duration: 520,
        ease: "outExpo",
        onComplete: () => utils.set(book, { height: "auto" }),
      }),
    );
    this.track(
      animate(rows, {
        opacity: [0, 1],
        translateY: [-8, 0],
        delay: stagger(55, { start: 120 }),
        duration: 420,
        ease: "outExpo",
      }),
    );
  }

  /**
   * Terminal override: collapse the book, flash the panel, scramble the
   * readout, then lock on `finalText`. Resolves when the sequence completes.
   */
  execute({ book, flash, readout, finalText }: ExecutionTargets): Promise<void> {
    if (this.reducedMotion) {
      if (book) utils.set(book, { height: 0, opacity: 0 });
      readout.textContent = finalText;
      return Promise.resolve();
    }

    const scramble = { progress: 0 };
    return new Promise((resolve) => {
      const timeline = createTimeline({ onComplete: () => resolve() });
      if (book) {
        timeline.add(book, { height: [book.offsetHeight, 0], opacity: [1, 0], duration: 320, ease: "inOutQuad" });
      }
      if (flash) {
        timeline.add(flash, { opacity: [1, 0.2, 1], duration: 140, loop: 3, ease: "linear" }, "-=80");
      }
      timeline.add(
        scramble,
        {
          progress: 1,
          duration: 1400,
          ease: "outQuad",
          onUpdate: () => {
            readout.textContent = TerminalAnimator.scrambled(finalText, scramble.progress);
          },
          onComplete: () => {
            readout.textContent = finalText;
          },
        },
        "-=200",
      );
      this.track(timeline);
    });
  }

  dispose(): void {
    this.running.forEach((animation) => animation.pause());
    this.running.length = 0;
  }

  /** Left-to-right decode: characters before `progress` are final, the rest cycle. */
  static scrambled(text: string, progress: number): string {
    const locked = Math.floor(text.length * progress);
    const charset = TerminalAnimator.SCRAMBLE_CHARSET;
    let out = text.slice(0, locked);
    for (let i = locked; i < text.length; i++) {
      out += text[i] === " " ? " " : charset[Math.floor(Math.random() * charset.length)];
    }
    return out;
  }

  private get reducedMotion(): boolean {
    return (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private track<T extends Pausable>(animation: T): T {
    this.running.push(animation);
    return animation;
  }
}
