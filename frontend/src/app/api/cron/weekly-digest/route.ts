import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { WeeklyDigest } from "@/domains/classroom/server/WeeklyDigest";

// A few students in a row, each a handful of cached Google calls.
export const maxDuration = 60;

/** GET /api/cron/weekly-digest — Vercel Cron (vercel.json), Sundays. Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const result = await WeeklyDigest.run();
  console.info("[weekly-digest]", result);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
