/** Raised button finishes (plain module, so server and client components share the strings). */
const RAISED = "transition-[translate,box-shadow,filter] duration-150 hover:brightness-110 not-disabled:active:translate-y-px not-disabled:active:shadow-bevel-pressed disabled:shadow-none";

/** Gold = conversion. */
export const RAISED_GOLD = `${RAISED} bg-linear-to-b from-gold-bright to-gold text-canvas shadow-bevel-gold`;
/** Solid cyan = the next step. */
export const RAISED_QUANT = `${RAISED} bg-linear-to-b from-[#67e8f9] to-quant text-canvas shadow-bevel-quant`;
/** Dark surface with a cyan line = exploration / technical. */
export const RAISED_PLAIN = `${RAISED} border border-quant/40 bg-surface-raised text-quant shadow-bevel-plain hover:border-quant`;
