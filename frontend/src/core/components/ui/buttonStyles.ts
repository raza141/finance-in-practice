/** Raised button finishes (plain module, so server and client components share the strings). */
const RAISED = "transition-[translate,box-shadow,filter,background-color] duration-150 not-disabled:active:translate-y-px not-disabled:active:shadow-bevel-pressed disabled:shadow-none";

/** Gold = conversion. */
export const RAISED_GOLD = `${RAISED} bg-gold text-canvas shadow-bevel-gold hover:bg-gold-bright`;
/** Solid cyan = the next step. */
export const RAISED_QUANT = `${RAISED} bg-linear-to-b from-[#67e8f9] to-quant text-canvas shadow-bevel-quant hover:brightness-110`;
/** Dark surface with a cyan line = exploration / technical. */
export const RAISED_PLAIN = `${RAISED} border border-quant/40 bg-surface-raised text-quant shadow-bevel-plain hover:border-quant hover:brightness-110`;
