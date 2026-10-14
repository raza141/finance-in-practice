import { describe, expect, it } from "vitest";

import { SignupTicket } from "./SignupTicket";

const NOW = Date.UTC(2026, 9, 14, 12);
const tickets = SignupTicket.fromEnv({ GOOGLE_CLIENT_SECRET: "test-secret" } as unknown as NodeJS.ProcessEnv)!;

describe("SignupTicket", () => {
  it("round-trips a verified email until it expires", () => {
    const ticket = tickets.issue("Ali@Gmail.com", NOW);
    expect(tickets.read(ticket, NOW + 60_000)).toBe("ali@gmail.com");
    expect(tickets.read(ticket, NOW + SignupTicket.TTL_MS + 1)).toBeNull();
  });

  it("refuses forged or foreign tickets", () => {
    const [body, signature] = tickets.issue("ali@gmail.com", NOW).split(".");
    const forged = Buffer.from(JSON.stringify({ email: "victim@gmail.com", exp: NOW + 60_000 })).toString("base64url");
    expect(tickets.read(`${forged}.${signature}`, NOW)).toBeNull();
    const other = SignupTicket.fromEnv({ GOOGLE_CLIENT_SECRET: "another" } as unknown as NodeJS.ProcessEnv)!;
    expect(other.read(`${body}.${signature}`, NOW)).toBeNull();
    expect(tickets.read(undefined, NOW)).toBeNull();
    expect(tickets.read("garbage", NOW)).toBeNull();
  });
});
