import "server-only";

import { BaseApiClient } from "@/core/http/BaseApiClient";

import type { EmailMessage } from "./EmailHtml";

export interface ResendConfig {
  apiKey: string;
  /** "Finance in Practice <bookings@financeinpractice.me>"; the domain must be verified in Resend. */
  from: string;
  replyTo: string | null;
}

/** Server-only Resend REST client (POST /emails). The key never leaves the server. */
export class ResendClient extends BaseApiClient {
  static readonly BASE_URL = "https://api.resend.com";

  constructor(
    private readonly config: ResendConfig,
    fetchImpl?: typeof fetch,
  ) {
    super({
      baseUrl: ResendClient.BASE_URL,
      timeoutMs: 10_000,
      defaultHeaders: { Authorization: `Bearer ${config.apiKey}` },
      fetchImpl,
    });
  }

  /** Null unless RESEND_API_KEY and EMAIL_FROM are set: the admin UI then disables sending. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): ResendClient | null {
    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.EMAIL_FROM?.trim();
    if (!apiKey || !from) return null;
    return new ResendClient({ apiKey, from, replyTo: env.EMAIL_REPLY_TO?.trim() || null });
  }

  /** Sends one email; returns Resend's message id. */
  async send(to: string, message: EmailMessage): Promise<string> {
    const response = await this.post<{ id: string }>("/emails", {
      from: this.config.from,
      to: [to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(this.config.replyTo && { reply_to: this.config.replyTo }),
    });
    return response.id;
  }

  /** Resend errors look like `{statusCode, name, message}`. */
  protected static override extractMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const message = (payload as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
}
