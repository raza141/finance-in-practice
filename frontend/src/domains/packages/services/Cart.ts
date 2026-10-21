/**
 * The course and package picked on /pricing, kept in this browser so the pick
 * survives the Google sign-in round trip to /student?view=join. Storage can be
 * blocked (private windows): then the form simply asks again.
 */
export interface CartPick {
  course: string;
  packageId: string;
}

export class Cart {
  private static readonly KEY = "fip-cart";

  /** For useSyncExternalStore: the stored text (a stable value), null when none or blocked. */
  static snapshot(): string | null {
    try {
      return localStorage.getItem(Cart.KEY);
    } catch {
      return null;
    }
  }

  static subscribe(onChange: () => void): () => void {
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  }

  static parse(raw: string | null): CartPick | null {
    try {
      const value = JSON.parse(raw ?? "null") as Partial<CartPick> | null;
      return typeof value?.course === "string" && typeof value.packageId === "string" ? { course: value.course, packageId: value.packageId } : null;
    } catch {
      return null;
    }
  }

  static write(pick: CartPick): void {
    try {
      localStorage.setItem(Cart.KEY, JSON.stringify(pick));
    } catch {
      // Blocked storage: the join form asks again.
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(Cart.KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
