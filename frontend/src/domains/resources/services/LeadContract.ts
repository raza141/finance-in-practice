import { ResourceCatalog, type FreeResource } from "./ResourceCatalog";

export interface LeadRequest {
  email: string;
  resource: FreeResource;
  /** Where the form sat: "home", "resources", a course slug. */
  source: string;
  marketingOptIn: boolean;
  /** Honeypot; humans leave it empty. */
  website: string;
}

export class LeadValidationError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Parses the public lead form body. Emails are trimmed and lowercased so one person is one row. */
export class LeadContract {
  static parse(payload: unknown): LeadRequest {
    if (!payload || typeof payload !== "object") throw new LeadValidationError("Invalid request.");
    const o = payload as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

    const email = str(o.email).toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) throw new LeadValidationError("Enter a valid email address.");
    const resource = ResourceCatalog.free(str(o.resource));
    if (!resource) throw new LeadValidationError("Unknown resource.");

    return {
      email,
      resource,
      source: str(o.source).slice(0, 80),
      marketingOptIn: o.marketingOptIn === true,
      website: str(o.website),
    };
  }
}
