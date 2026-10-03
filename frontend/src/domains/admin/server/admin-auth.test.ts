import { describe, expect, it, vi } from "vitest";

import { GoogleOAuth, GoogleOAuthError } from "./GoogleOAuth";
import { PasswordHasher } from "./PasswordHasher";
import { SessionToken } from "./SessionToken";

const NOW = Date.UTC(2026, 9, 3, 12);
const CLIENT_ID = "client-123.apps.googleusercontent.com";

function idToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

const CLAIMS = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  sub: "1098765",
  email: "Owner@Gmail.com",
  email_verified: true,
  exp: NOW / 1000 + 3600,
};

// --------------------------------------------------------------------------

describe("PasswordHasher", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await PasswordHasher.hash("correct horse battery");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[^$]+\$[^$]+$/);
    expect(await PasswordHasher.verify("correct horse battery", hash)).toBe(true);
    expect(await PasswordHasher.verify("correct horse batter", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await PasswordHasher.hash("same password")).not.toBe(await PasswordHasher.hash("same password"));
  });

  it("rejects missing and malformed hashes", async () => {
    expect(await PasswordHasher.verify("anything", null)).toBe(false);
    expect(await PasswordHasher.verify("anything", "bcrypt$whatever")).toBe(false);
  });

  it("enforces length", () => {
    expect(PasswordHasher.weakness("short")).toMatch(/at least 10/);
    expect(PasswordHasher.weakness("x".repeat(201))).toMatch(/at most 200/);
    expect(PasswordHasher.weakness("long enough pw")).toBeNull();
  });
});

describe("SessionToken", () => {
  it("generates unique, well-formed tokens and stores only a hash", () => {
    const a = SessionToken.generate();
    const b = SessionToken.generate();
    expect(a).not.toBe(b);
    expect(SessionToken.isWellFormed(a)).toBe(true);
    expect(SessionToken.hash(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(SessionToken.hash(a)).not.toContain(a);
  });

  it("rejects malformed cookies", () => {
    for (const bad of [undefined, "", "short", `${"a".repeat(43)}!`, "a".repeat(44)]) {
      expect(SessionToken.isWellFormed(bad)).toBe(false);
    }
  });
});

// --------------------------------------------------------------------------

describe("GoogleOAuth", () => {
  const google = new GoogleOAuth(CLIENT_ID, "secret", "https://financeinpractice.me");

  it("is only enabled with both credentials", () => {
    expect(GoogleOAuth.isConfigured({})).toBe(false);
    expect(GoogleOAuth.isConfigured({ GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(GoogleOAuth.isConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toBe(true);
  });

  it("uses one canonical origin in production", () => {
    expect(GoogleOAuth.canonicalOrigin("https://www.financeinpractice.me", { VERCEL_ENV: "production" })).toBe(
      "https://financeinpractice.me",
    );
    expect(GoogleOAuth.canonicalOrigin("http://localhost:3000", {})).toBe("http://localhost:3000");
    expect(GoogleOAuth.canonicalOrigin("http://x", { APP_URL: "https://staging.example/" })).toBe(
      "https://staging.example",
    );
  });

  it("builds a PKCE authorization URL with the registered redirect", () => {
    const flow = GoogleOAuth.newFlow();
    const url = new URL(google.authorizationUrl(flow.state, flow.verifier));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://financeinpractice.me/api/admin/auth/google/callback");
    expect(url.searchParams.get("state")).toBe(flow.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe(flow.verifier);
    expect(GoogleOAuth.parseFlowCookie(flow.cookie)).toEqual({ state: flow.state, verifier: flow.verifier });
    expect(GoogleOAuth.parseFlowCookie("tampered")).toBeNull();
  });

  it("accepts valid claims and normalises the email", () => {
    expect(google.identityFrom(idToken(CLAIMS), NOW)).toEqual({ sub: "1098765", email: "owner@gmail.com" });
  });

  it.each([
    [{ aud: "someone-else" }, /audience/],
    [{ iss: "https://evil.example" }, /issuer/],
    [{ exp: NOW / 1000 - 1 }, /expired/],
    [{ email_verified: false }, /not verified/],
    [{ email_verified: "true" }, /not verified/],
    [{ sub: undefined }, /missing/],
  ])("rejects claims %j", (patch, message) => {
    expect(() => google.identityFrom(idToken({ ...CLAIMS, ...patch }), NOW)).toThrow(message);
  });

  it("rejects malformed tokens", () => {
    expect(() => google.identityFrom("nope", NOW)).toThrow(GoogleOAuthError);
    expect(() => google.identityFrom("a.!!!.c", NOW)).toThrow(GoogleOAuthError);
  });

  it("exchanges the code with the PKCE verifier and client secret", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id_token: idToken(CLAIMS) }));
    const client = new GoogleOAuth(CLIENT_ID, "secret", "http://localhost:3000", fetchImpl);

    expect(await client.exchange("the-code", "the-verifier", NOW)).toEqual({ sub: "1098765", email: "owner@gmail.com" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("client_secret")).toBe("secret");
    expect(body.get("redirect_uri")).toBe("http://localhost:3000/api/admin/auth/google/callback");
  });

  it("surfaces token endpoint failures", async () => {
    const fetchImpl = vi.fn(async () => new Response("invalid_grant", { status: 400 }));
    const client = new GoogleOAuth(CLIENT_ID, "secret", "http://localhost:3000", fetchImpl);
    await expect(client.exchange("bad", "v", NOW)).rejects.toThrow(/token exchange failed \(400\)/);
  });
});
