import { createTimeline, onScroll, stagger, utils } from "animejs";

type Revertible = { revert: () => unknown };

export interface ScrollStoryParts {
  /** Revealed one after another as the visitor scrolls. */
  steps: readonly HTMLElement[];
  /** Optional line that fills left to right across the steps. */
  rail?: HTMLElement | null;
  /** Optional block (e.g. a button) shown once every step is in. */
  end?: readonly HTMLElement[];
}

/**
 * A pinned scroll moment: `track` grows to `screens` screen heights and its
 * `stage` sticks to the screen while the steps rise in, tied to the scroll
 * position. Scrolling stays normal (nothing takes over the wheel), and only
 * transform and opacity animate, so the browser does it without re-layout.
 *
 * Pins only on a wide, tall screen where the stage fits under the navbar and nearly fills it,
 * measured on the visitor's own screen; otherwise `pin` returns null and the
 * caller keeps its ordinary animation.
 * ponytail: decided once at load; resizing to a smaller window afterwards keeps the pin.
 */
export class ScrollStory {
  static readonly MEDIA = "(min-width: 1024px) and (min-height: 700px)";
  /** Room left for the floating navbar above a pinned stage. */
  static readonly NAV_PX = 88;
  /** Smallest share of the screen (under the navbar) a stage must fill to pin. */
  static readonly MIN_FILL = 0.8;

  /** `screens`: how long the pin lasts, in screen heights; by default about a third of a screen per step. */
  /**
   * In-page links to the track (e.g. a course's "Pricing" button to #pricing)
   * land near the end of the pin, where every step is already showing, instead
   * of its start, where nothing has arrived yet.
   */
  private static landAtEnd(track: HTMLElement): Revertible {
    const doc = track.ownerDocument;
    // The track's own id, or its section's (the method stages sit inside #method).
    const id = track.closest<HTMLElement>("[id]")?.id;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!id || !link || link.getAttribute("href") !== `#${id}`) return;
      event.preventDefault();
      const view = doc.defaultView!;
      const top = track.getBoundingClientRect().top + view.scrollY;
      view.scrollTo({ top: top + (track.offsetHeight - view.innerHeight) * 0.95, behavior: "smooth" });
      view.history.replaceState(null, "", `#${id}`);
    };
    doc.addEventListener("click", onClick, true);
    return { revert: () => doc.removeEventListener("click", onClick, true) };
  }

  static pin(track: HTMLElement, stage: HTMLElement, parts: ScrollStoryParts, screens = 1 + 0.35 * parts.steps.length): Revertible[] | null {
    const view = track.ownerDocument.defaultView;
    if (!view?.matchMedia(ScrollStory.MEDIA).matches || parts.steps.length === 0) return null;
    const room = view.innerHeight - ScrollStory.NAV_PX;
    // Only pin a stage that nearly fills the screen: a shorter one leaves a blank band under it while pinned.
    if (stage.scrollHeight > room || stage.scrollHeight < room * ScrollStory.MIN_FILL) return null;

    const before = { track: track.style.cssText, stage: stage.style.cssText };
    track.style.height = `${screens * 100}vh`;
    Object.assign(stage.style, {
      position: "sticky",
      top: "0",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      // Top-aligned like an ordinary section, so nothing looks empty as it scrolls in.
      justifyContent: "flex-start",
      paddingTop: `${ScrollStory.NAV_PX}px`,
      paddingBottom: "0",
    });
    const layout: Revertible = {
      revert: () => {
        track.style.cssText = before.track;
        stage.style.cssText = before.stage;
      },
    };

    const end = parts.end ?? [];
    const rail = parts.rail ? [parts.rail] : [];
    // A timeline applies a child's start values only when its playhead arrives, so set them all up front.
    const start = utils.set([...parts.steps], { opacity: 0, translateY: 48, scale: 0.96 });
    const hidden = utils.set([...end], { opacity: 0, translateY: 24 });
    const filled = utils.set(rail, { opacity: 1, scaleX: 0 });
    // Progress runs from "track top enters at the bottom of the screen" to "track bottom at the bottom":
    // the first card is already arriving while the section scrolls in, the rest while it holds still.
    const observer = onScroll({ target: track, enter: { target: "top", container: "bottom" }, leave: { target: "bottom", container: "bottom" }, sync: 0.25 });
    const timeline = createTimeline({ autoplay: observer, defaults: { ease: "outQuad" } })
      .add(rail, { scaleX: 1, duration: parts.steps.length * 1000 }, 0)
      .add([...parts.steps], { opacity: 1, translateY: 0, scale: 1, duration: 1000, delay: stagger(900) }, 0);
    if (end.length > 0) timeline.add([...end], { opacity: 1, translateY: 0, duration: 600 });
    // Hold the finished picture for the last stretch before the section scrolls away.
    timeline.add({ hold: 0 }, { hold: 1, duration: 700 });
    return [timeline, observer, start, hidden, filled, layout, ScrollStory.landAtEnd(track)];
  }
}
