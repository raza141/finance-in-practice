import "server-only";

import { createHash, randomBytes } from "node:crypto";

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * "Sign in with Google" via the OAuth 2.0 authorization-code flow with PKCE.
 * Google only identifies the person; whether they may enter the admin panel
 * is decided by the admin_users allowlist.
 */
export class GoogleOAuth {
  static readonly CALLBACK_PATH = "/api/admin/auth/google/callback";
  static readonly STATE_COOKIE = "fip_oauth";
  static readonly STATE_TTL_S = 10 * 60;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    /** Origin registered with Google, e.g. https://financeinpractice.me. */
    readonly origin: string,
    private readonly fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  /** Null (button hidden) unless both credentials are set. */
  static fromEnv(origin: string, env: Record<string, string | undefined> = process.env): GoogleOAuth | null {
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = env;
    return id && secret ? new GoogleOAuth(id, secret, origin) : null;
  }

  /**
   * The one origin registered with Google. Production always uses the
   * canonical site URL (www and apex both serve the site, but only one
   * redirect URI is registered); local dev uses wherever it runs.
   */
  static canonicalOrigin(requestOrigin: string, env: Record<string, string | undefined> = process.env): string {
    if (env.APP_URL) return env.APP_URL.replace(/\/+$/, "");
    if (env.VERCEL_ENV === "production") return "https://financeinpractice.me";
    return requestOrigin;
  }

  static isConfigured(env: Record<string, string | undefined> = process.env): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  get redirectUri(): string {
    return `${this.origin}${GoogleOAuth.CALLBACK_PATH}`;
  }

  /** Fresh state + PKCE verifier, stored in a short-lived cookie as `state.verifier`. */
  static newFlow(): { state: string; verifier: string; cookie: string } {
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    return { state, verifier, cookie: `${state}.${verifier}` };
  }

  static parseFlowCookie(value: string | undefined): { state: string; verifier: string } | null {
    const match = /^([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{64})$/.exec(value ?? "");
    return match ? { state: match[1], verifier: match[2] } : null;
  }

  authorizationUrl(state: string, verifier: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return `${AUTHORIZE_URL}?${params}`;
  }

  /** Exchange the callback code for the signed-in Google identity. */
  async exchange(code: string, verifier: string, now: number = Date.now()): Promise<GoogleIdentity> {
    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new GoogleOAuthError(`token exchange failed (${response.status}) ${detail.slice(0, 200)}`);
    }
    const { id_token: idToken } = (await response.json()) as { id_token?: string };
    if (!idToken) throw new GoogleOAuthError("token response had no id_token");
    return this.identityFrom(idToken, now);
  }

  /**
   * Validate the ID token's claims. Its signature is not checked: the token
   * came straight from Google's token endpoint over TLS, authenticated with
   * our client secret, which Google documents as sufficient.
   */
  identityFrom(idToken: string, now: number = Date.now()): GoogleIdentity {
    const payload = idToken.split(".")[1];
    if (!payload) throw new GoogleOAuthError("malformed id_token");
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new GoogleOAuthError("malformed id_token");
    }

    if (claims.aud !== this.clientId) throw new GoogleOAuthError("id_token audience mismatch");
    if (!ISSUERS.includes(String(claims.iss))) throw new GoogleOAuthError("id_token issuer mismatch");
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= now) throw new GoogleOAuthError("id_token expired");
    if (claims.email_verified !== true) throw new GoogleOAuthError("Google email is not verified");
    if (typeof claims.sub !== "string" || typeof claims.email !== "string") {
      throw new GoogleOAuthError("id_token is missing sub or email");
    }
    return { sub: claims.sub, email: claims.email.toLowerCase() };
  }
}
