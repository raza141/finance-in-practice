/**
 * Portal buttons, same look as the site's ButtonLink (plain module, so server
 * and client components share the strings). No arrows: the button is the cue.
 */
const BASE = "inline-flex items-center justify-center gap-2 rounded-md font-mono font-semibold whitespace-nowrap transition-colors duration-200";
/** Cyan outline: go somewhere in the portal or open a file. */
export const BUTTON = `${BASE} h-9 border border-quant/60 px-3.5 text-xs text-quant hover:border-quant hover:bg-quant/10`;
/** Gold: booking. */
export const BOOK_BUTTON = `${BASE} h-10 bg-gold px-4 text-sm text-canvas hover:bg-gold-bright`;
/** Google green: opens Google Classroom. */
export const CLASSROOM_BUTTON = `${BASE} h-9 bg-[#1e8e3e] px-3.5 text-xs text-white hover:bg-[#188038]`;
/** Solid cyan: join a live session. */
export const JOIN_BUTTON = `${BASE} h-9 bg-quant px-3.5 text-xs text-canvas hover:bg-quant/85`;
