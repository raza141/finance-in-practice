import type { MockResponse } from "../types";

const CALL_TIMEOUT_MS = 20_000;

/**
 * The open exam's server calls (`MockPlayerApi`, a Route Handler): a plain URL, so a deploy during the
 * exam can't break saving or submitting the way it breaks a Server Action. Throws if the request fails.
 */
export async function playerCall<T>(attemptId: string, body: { op: "save" | "pause" | "resume" | "submit" | "next" | "claim"; responses?: MockResponse[]; auto?: boolean; screen?: string }): Promise<T> {
  // A request sent as an iPad wakes from sleep can hang for good, leaving a button stuck on "Resuming…": give up so it can be pressed again.
  const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(CALL_TIMEOUT_MS) : undefined;
  const res = await fetch(`/api/student/mocks/${attemptId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`${body.op} failed (${res.status})`);
  return (await res.json()) as T;
}
