import type { MockResponse } from "../types";

/**
 * The open exam's server calls (`MockPlayerApi`, a Route Handler): a plain URL, so a deploy during the
 * exam can't break saving or submitting the way it breaks a Server Action. Throws if the request fails.
 */
export async function playerCall<T>(attemptId: string, body: { op: "save" | "pause" | "resume" | "submit" | "next" | "claim"; responses?: MockResponse[]; auto?: boolean; screen?: string }): Promise<T> {
  const res = await fetch(`/api/student/mocks/${attemptId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${body.op} failed (${res.status})`);
  return (await res.json()) as T;
}
