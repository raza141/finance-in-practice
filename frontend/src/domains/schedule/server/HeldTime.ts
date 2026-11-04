import "server-only";

import type { BlockSource } from "@/domains/booking/server/BookingGateway";
import { SessionRequestRepository } from "@/domains/students/server/SessionRequestRepository";

import type { TimeRange } from "../types";
import { BlockRepository } from "./BlockRepository";

/** Time the website must not offer: blocked in admin, or held by a request waiting for approval. */
export class HeldTime implements BlockSource {
  constructor(
    private readonly blocks: BlockRepository,
    private readonly requests: SessionRequestRepository,
    /** A request being moved doesn't hold its own time. */
    private readonly except: string | null = null,
  ) {}

  static fromEnv(except: string | null = null): HeldTime | null {
    const [blocks, requests] = [BlockRepository.fromEnv(), SessionRequestRepository.fromEnv()];
    return blocks && requests ? new HeldTime(blocks, requests, except) : null;
  }

  async between(from: string, to: string): Promise<TimeRange[]> {
    const [blocked, held] = await Promise.all([this.blocks.between(from, to), this.requests.between(from, to, this.except)]);
    return [...blocked, ...held];
  }
}
