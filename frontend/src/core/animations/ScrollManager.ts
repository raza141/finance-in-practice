export interface ScrollTriggerOptions {
  /** Fraction of the element that must be visible before firing (0-1). */
  threshold?: number;
  /** Grow/shrink the viewport box, e.g. "0px 0px -10% 0px" fires slightly earlier. */
  rootMargin?: string;
}

/**
 * Fires one-shot entry callbacks when elements scroll into view.
 *
 * A thin, dependency-free wrapper over IntersectionObserver: observers are
 * shared per option set and every element is unobserved after it fires.
 */
export class ScrollManager {
  private readonly observers = new Map<string, IntersectionObserver>();
  private readonly callbacks = new WeakMap<Element, Array<() => void>>();

  onEnter(element: Element, callback: () => void, options: ScrollTriggerOptions = {}): void {
    if (typeof IntersectionObserver === "undefined") {
      callback(); // very old browsers: reveal immediately rather than never
      return;
    }
    const queued = this.callbacks.get(element) ?? [];
    queued.push(callback); // several sequences may share one trigger element
    this.callbacks.set(element, queued);
    this.observerFor(options).observe(element);
  }

  disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }

  // Default 0, not a fraction: a section taller than ~5 viewports (stacked
  // course tiles on a small phone) can never be 20% visible and would stay hidden.
  private observerFor({
    threshold = 0,
    rootMargin = "0px 0px -10% 0px",
  }: ScrollTriggerOptions): IntersectionObserver {
    const key = `${threshold}|${rootMargin}`;
    let observer = this.observers.get(key);
    if (!observer) {
      observer = new IntersectionObserver(
        (entries, self) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            self.unobserve(entry.target);
            const queued = this.callbacks.get(entry.target) ?? [];
            this.callbacks.delete(entry.target);
            queued.forEach((run) => run());
          }
        },
        { threshold, rootMargin },
      );
      this.observers.set(key, observer);
    }
    return observer;
  }
}
