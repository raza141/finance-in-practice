import { describe, expect, it } from "vitest";

import { BookingGateway } from "@/domains/booking/server/BookingGateway";
import { Schedule } from "@/domains/schedule/services/Schedule";
import { WhatsAppText } from "@/domains/whatsapp/services/WhatsAppText";

import { StudentSessions } from "../services/StudentSessions";
import { RequestOverlapError, SessionRequestRepository, type SessionRequest } from "./SessionRequestRepository";

const ID = "3f2c8a5e-1b2d-4c3e-9f00-123456789abc";
const request: SessionRequest = {
  id: ID,
  clientId: "11111111-2222-4333-8444-555555555555",
  start: "2030-01-07T05:00:00.000Z",
  end: "2030-01-07T07:00:00.000Z",
  timeZone: "Asia/Dubai",
  course: "CFA Level II",
  mode: "in_person",
  address: "Al Reem Island, Abu Dhabi",
  summary: "Course: CFA Level II\nLength: 2 h",
  name: "Sara Khan",
  email: "sara@example.com",
  createdAt: "2030-01-01T00:00:00.000Z",
};

describe("session requests", () => {
  it("only req_<uuid> uids are requests; Cal.com uids pass through", () => {
    expect(SessionRequestRepository.idOf(`req_${ID}`)).toBe(ID);
    expect(SessionRequestRepository.idOf("req_not-a-uuid")).toBeNull();
    expect(SessionRequestRepository.idOf("8sKq3pXyZ1")).toBeNull();
  });

  it("reads as a pending session booking: portal list, address and the admin grid", () => {
    const booking = SessionRequestRepository.asBooking(request);
    const [session] = StudentSessions.upcoming([booking], new Date("2030-01-01T00:00:00Z"));
    expect(session).toMatchObject({ uid: `req_${ID}`, status: "pending", course: "CFA Level II", minutes: 120, address: "Al Reem Island, Abu Dhabi" });
    const [event] = Schedule.merge([booking], [], []);
    expect(event).toMatchObject({ kind: "booking", id: `req_${ID}`, status: "pending", session: true, title: "Sara Khan" });
    // Online: no address leaks from the integration key.
    expect(StudentSessions.upcoming([SessionRequestRepository.asBooking({ ...request, mode: "online" })], new Date(0))[0].address).toBeNull();
  });

  it("an overlapping request answers like a taken slot", () => {
    expect(BookingGateway.errorResponse(new RequestOverlapError()).status).toBe(409);
  });

  it("the declined WhatsApp carries the time, the owner's reason and the portal link", () => {
    const text = WhatsAppText.requestDeclined("Sara Khan", new Date(request.start), "Asia/Dubai", "I'm teaching then.", { sender: "Raza", business: "Finance in Practice" });
    expect(text).toContain("Hi Sara");
    expect(text).toContain("I'm teaching then.");
    expect(text).toContain(WhatsAppText.PORTAL);
    expect(text).not.toMatch(/\{\w+\}/);
  });
});
