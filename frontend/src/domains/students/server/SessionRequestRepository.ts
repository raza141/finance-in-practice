import "server-only";

import { siteConfig } from "@/core/config/site";
import { Database, type Sql } from "@/core/db/Database";
import { SlotBlockedError } from "@/domains/booking/server/BookingGateway";
import type { CalBookingDetail } from "@/domains/booking/server/CalComClient";
import type { TimeRange } from "@/domains/schedule/types";

import { StudentBookingContract } from "../services/StudentBookingContract";
import { StudentSessions } from "../services/StudentSessions";
import type { SessionMode, StudentBookingRequest } from "../types";

interface RequestRow {
  id: string;
  client_id: string;
  starts_at: Date;
  ends_at: Date;
  time_zone: string;
  course: string;
  mode: SessionMode;
  address: string;
  summary: string;
  reschedule_of: string | null;
  created_at: Date;
  name: string;
  email: string;
}

/** A waiting request with what approving it needs. */
export interface SessionRequest {
  id: string;
  clientId: string;
  start: string;
  end: string;
  timeZone: string;
  course: string;
  mode: SessionMode;
  address: string;
  summary: string;
  /** A move of this confirmed Cal.com booking, which stays until the move is approved; null for a new session. */
  rescheduleOf: string | null;
  name: string;
  email: string;
  createdAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The time is already held by another waiting request (065's EXCLUDE); answered like any taken slot. */
export class RequestOverlapError extends SlotBlockedError {}

/**
 * Portal bookings waiting for the owner's approval (065_session_requests). Nothing reaches Cal.com
 * until approval, so nobody gets an email for a request. Elsewhere a request reads as a Cal.com
 * booking with status "pending" and uid "req_<id>" (`asBooking`), so the portal, hours and the admin
 * schedule treat it like the unconfirmed Cal.com bookings they already handle.
 */
export class SessionRequestRepository {
  static readonly PREFIX = "req_";

  constructor(private readonly sql: Sql) {}

  static fromEnv(): SessionRequestRepository | null {
    const sql = Database.sql();
    return sql ? new SessionRequestRepository(sql) : null;
  }

  /** The request id in a "req_<id>" uid, or null for a Cal.com uid. */
  static idOf(uid: string): string | null {
    if (!uid.startsWith(SessionRequestRepository.PREFIX)) return null;
    const id = uid.slice(SessionRequestRepository.PREFIX.length);
    return UUID.test(id) ? id : null;
  }

  static asBooking(r: SessionRequest): CalBookingDetail {
    return {
      uid: `${SessionRequestRepository.PREFIX}${r.id}`,
      start: r.start,
      end: r.end,
      status: "pending",
      title: r.course,
      meetingUrl: null,
      metadata: { source: "financeinpractice.me/student", clientId: r.clientId, course: r.course, ...(r.rescheduleOf ? { moveOf: r.rescheduleOf } : {}) },
      attendees: [{ name: r.name, email: r.email, timeZone: r.timeZone }],
      createdAt: r.createdAt,
      location: r.mode === "online" ? "integrations:zoom" : r.address,
      eventType: { slug: siteConfig.studentBooking.eventSlug },
    };
  }

  /**
   * A student's sessions as they see them: a waiting move shows at its new time in place of the
   * booking it would move (counted once for hours), which comes back if the move is declined.
   */
  static merge(booked: readonly CalBookingDetail[], waiting: readonly SessionRequest[]): CalBookingDetail[] {
    const moving = new Set(waiting.flatMap((r) => (r.rescheduleOf ? [r.rescheduleOf] : [])));
    return [...booked.filter((b) => !moving.has(b.uid)), ...waiting.map(SessionRequestRepository.asBooking)];
  }

  /**
   * A confirmed session the student wants at `start` (same length, course and place). Throws
   * RequestOverlapError when that time is held, or when a move of this booking is already waiting.
   */
  async createMove(clientId: string, booking: CalBookingDetail, start: string, timeZone: string): Promise<{ uid: string; summary: string }> {
    const minutes = Math.round((Date.parse(booking.end) - Date.parse(booking.start)) / 60_000);
    const end = new Date(Date.parse(start) + minutes * 60_000).toISOString();
    const address = StudentSessions.address(booking.location) ?? "";
    const course = (booking.metadata?.course || booking.title).slice(0, 500);
    const summary = [`Course: ${course}`, `Length: ${minutes / 60} h`, `Where: ${address ? `In person: ${address}` : "Online (Zoom)"}`, "Moved by the student"].join("\n");
    try {
      const [row] = (await this.sql`
        INSERT INTO session_requests (client_id, starts_at, ends_at, time_zone, course, mode, address, summary, reschedule_of)
        VALUES (${clientId}, ${start}, ${end}, ${timeZone}, ${course}, ${address ? "in_person" : "online"}, ${address.slice(0, 200)}, ${summary}, ${booking.uid})
        RETURNING id
      `) as { id: string }[];
      return { uid: `${SessionRequestRepository.PREFIX}${row.id}`, summary };
    } catch (error) {
      throw SessionRequestRepository.isOverlap(error) || Database.isUniqueViolation(error) ? new RequestOverlapError() : error;
    }
  }

  /** Throws RequestOverlapError when another waiting request holds any of that time. */
  async create(clientId: string, request: StudentBookingRequest): Promise<string> {
    const end = new Date(Date.parse(request.start) + request.minutes * 60_000).toISOString();
    const course = request.course === StudentBookingContract.OTHER ? `Other: ${request.topic}` : request.course;
    try {
      const [row] = (await this.sql`
        INSERT INTO session_requests (client_id, starts_at, ends_at, time_zone, course, mode, address, summary)
        VALUES (${clientId}, ${request.start}, ${end}, ${request.timeZone}, ${course.slice(0, 500)}, ${request.mode}, ${request.address},
                ${StudentBookingContract.summary(request)})
        RETURNING id
      `) as { id: string }[];
      return `${SessionRequestRepository.PREFIX}${row.id}`;
    } catch (error) {
      throw SessionRequestRepository.isOverlap(error) ? new RequestOverlapError() : error;
    }
  }

  /** Waiting requests that haven't ended: every client's, or one client's. */
  async waiting(clientId?: string): Promise<SessionRequest[]> {
    if (clientId !== undefined && !UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT r.id, r.client_id, r.starts_at, r.ends_at, r.time_zone, r.course, r.mode, r.address, r.summary, r.reschedule_of, r.created_at, c.name, c.email
      FROM session_requests r JOIN clients c ON c.id = r.client_id
      WHERE r.status = 'pending' AND r.ends_at > now() AND (${clientId ?? null}::uuid IS NULL OR r.client_id = ${clientId ?? null}::uuid)
      ORDER BY r.starts_at
    `) as RequestRow[];
    return rows.map(SessionRequestRepository.toRequest);
  }

  /** One waiting request that hasn't started; with `clientId`, only if it is theirs. */
  async open(id: string, clientId?: string): Promise<SessionRequest | null> {
    if (!UUID.test(id)) return null;
    const rows = (await this.sql`
      SELECT r.id, r.client_id, r.starts_at, r.ends_at, r.time_zone, r.course, r.mode, r.address, r.summary, r.reschedule_of, r.created_at, c.name, c.email
      FROM session_requests r JOIN clients c ON c.id = r.client_id
      WHERE r.id = ${id} AND r.status = 'pending' AND r.starts_at > now()
    `) as RequestRow[];
    const request = rows[0] ? SessionRequestRepository.toRequest(rows[0]) : null;
    return request && (clientId === undefined || request.clientId === clientId) ? request : null;
  }

  /** Time held by waiting requests overlapping [from, to), for the free-slot lists. `except`: a request being moved. */
  async between(from: string, to: string, except: string | null = null): Promise<TimeRange[]> {
    const rows = (await this.sql`
      SELECT starts_at, ends_at FROM session_requests
      WHERE status = 'pending' AND starts_at < ${to} AND ends_at > ${from} AND (${except}::uuid IS NULL OR id <> ${except}::uuid)
    `) as { starts_at: Date; ends_at: Date }[];
    return rows.map((r) => ({ start: r.starts_at.toISOString(), end: r.ends_at.toISOString() }));
  }

  /** A new start; `minutes` a new length (null keeps it). Throws RequestOverlapError when that time is held. */
  async move(id: string, start: string, minutes: number | null = null): Promise<boolean> {
    try {
      const rows = await this.sql`
        UPDATE session_requests
        SET ends_at = ${start}::timestamptz + coalesce(make_interval(mins => ${minutes}::int), ends_at - starts_at), starts_at = ${start}
        WHERE id = ${id} AND status = 'pending' RETURNING id
      `;
      return rows.length > 0;
    } catch (error) {
      throw SessionRequestRepository.isOverlap(error) ? new RequestOverlapError() : error;
    }
  }

  /** Closes a waiting request; false when it was already decided (a double click). */
  async decide(id: string, status: "approved" | "declined" | "cancelled", detail: { bookingUid?: string; reason?: string } = {}): Promise<boolean> {
    const rows = await this.sql`
      UPDATE session_requests SET status = ${status}, booking_uid = ${detail.bookingUid ?? null}, reason = ${(detail.reason ?? "").slice(0, 300)}, decided_at = now()
      WHERE id = ${id} AND status = 'pending' RETURNING id
    `;
    return rows.length > 0;
  }

  /** 23P01: an exclusion constraint refused the write. */
  private static isOverlap(error: unknown): boolean {
    return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23P01";
  }

  private static toRequest(r: RequestRow): SessionRequest {
    return {
      id: r.id,
      clientId: r.client_id,
      start: r.starts_at.toISOString(),
      end: r.ends_at.toISOString(),
      timeZone: r.time_zone,
      course: r.course,
      mode: r.mode,
      address: r.address,
      summary: r.summary,
      rescheduleOf: r.reschedule_of,
      name: r.name,
      email: r.email,
      createdAt: r.created_at.toISOString(),
    };
  }
}
