import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { QuestionEmails } from "@/domains/questions/server/QuestionEmails";

// Batches of 100 a second apart (Resend's rate limit).
export const maxDuration = 60;

/**
 * GET /api/cron/cfa-question — Vercel Cron (vercel.json), daily 08:00 GST.
 * Emails the question that went live in the last 24 hours, once. Off until the
 * owner switches daily emails on in /admin/questions.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const result = await QuestionEmails.run();
  console.info("[cfa-question]", result);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
