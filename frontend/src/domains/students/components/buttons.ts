/**
 * Portal buttons, same look as the site's ButtonLink (plain module, so server
 * and client components share the strings). No arrows: the button is the cue.
 */
import { RAISED_GOLD, RAISED_PLAIN, RAISED_QUANT } from "@/core/components/ui/buttonStyles";

const BASE = "inline-flex items-center justify-center gap-2 rounded-md font-mono font-semibold whitespace-nowrap";
/** Cyan outline: go somewhere in the portal or open a file. */
export const BUTTON = `${BASE} h-9 px-3.5 text-xs ${RAISED_PLAIN}`;
/** Gold: booking. */
export const BOOK_BUTTON = `${BASE} h-10 px-4 text-sm ${RAISED_GOLD}`;
/** Google green: opens Google Classroom. */
export const CLASSROOM_BUTTON = `${BASE} h-9 bg-[#1e8e3e] px-3.5 text-xs text-white hover:bg-[#188038]`;
/** Solid cyan: join a live session. */
export const JOIN_BUTTON = `${BASE} h-9 px-3.5 text-xs ${RAISED_QUANT}`;
