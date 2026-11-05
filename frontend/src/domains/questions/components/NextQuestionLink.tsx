"use client";

import Link from "next/link";

import { AnswerStore } from "../services/AnswerStore";

const BUTTON =
  "inline-flex h-12 items-center rounded-md border border-line px-6 text-[15px] font-semibold text-ink transition-colors hover:border-quant/60 hover:text-quant";

/**
 * "Try another question": the first candidate (same topic first, newest first)
 * this browser hasn't answered; the Question Bank once every one is answered.
 * Only rendered after the reader answers, so it never runs on the server.
 */
export function NextQuestionLink({ candidates }: { candidates: { code: string; path: string }[] }) {
  let next: { code: string; path: string } | undefined;
  try {
    next = candidates.find((c) => AnswerStore.result(`fip-cfa-q:${c.code}`) === null);
  } catch {
    next = candidates[0];
  }
  return next ? (
    <Link href={next.path} className={BUTTON}>
      Try another question
    </Link>
  ) : (
    <Link href="/cfa/questions" className="inline-flex h-12 items-center px-2 text-[15px] text-quant hover:underline">
      You&rsquo;ve answered them all. Back to the Question Bank
    </Link>
  );
}
