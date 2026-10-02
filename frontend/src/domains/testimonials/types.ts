export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  /** Who they are, e.g. "CFA Level II candidate" or "MSc Finance, LSE". */
  context: string;
  /** Course or service they took, shown as a chip. */
  program: string;
  /** Optional outcome line, e.g. "Passed CFA Level I, May 2026". */
  outcome?: string;
  /** True while the entry still holds placeholder copy that must be replaced. */
  placeholder?: boolean;
}
