import { describe, expect, it } from "vitest";

import { EmailLink } from "./EmailLink";
import { SignupTicket } from "./SignupTicket";

const NOW = Date.UTC(2026, 9, 15, 12);
const env = { GOOGLE_CLIENT_SECRET: "test-secret" } as unknown as NodeJS.ProcessEnv;
const links = EmailLink.fromEnv(env)!;
const ID = "7f1d2c3a-0000-4000-8000-000000000001";

describe("EmailLink", () => {
  it("round-trips kind and id until it expires", () => {
    const token = links.issue("register", ID, NOW);
    expect(links.read(token, NOW + 60_000)).toEqual({ kind: "register", id: ID });
    expect(links.read(token, NOW + EmailLink.TTL_MS + 1)).toBeNull();
  });

  it("refuses forged, foreign and signup-ticket tokens", () => {
    const [, signature] = links.issue("signin", ID, NOW).split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "signin", id: "someone-else", exp: NOW + 60_000 })).toString("base64url");
    expect(links.read(`${forged}.${signature}`, NOW)).toBeNull();
    expect(EmailLink.fromEnv({ GOOGLE_CLIENT_SECRET: "another" } as unknown as NodeJS.ProcessEnv)!.read(links.issue("signin", ID, NOW), NOW)).toBeNull();
    expect(links.read(SignupTicket.fromEnv(env)!.issue("ali@gmail.com", NOW), NOW)).toBeNull();
    expect(links.read(undefined, NOW)).toBeNull();
    expect(links.read("garbage", NOW)).toBeNull();
  });
});
