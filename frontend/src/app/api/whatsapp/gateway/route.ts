import type { NextRequest } from "next/server";

import { WhatsAppGateway } from "@/domains/whatsapp/server/WhatsAppGateway";

// A scan reads Cal.com, a few invoices and each Google class.
export const maxDuration = 60;

/** POST /api/whatsapp/gateway: the Mac gateway's poll (whatsapp-gateway/). `Authorization: Bearer $WHATSAPP_GATEWAY_SECRET`. */
export async function POST(request: NextRequest) {
  if (!WhatsAppGateway.authorized(request.headers.get("authorization"))) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const report = WhatsAppGateway.parse(await request.json().catch(() => null));
  if (!report) return Response.json({ message: "Bad report" }, { status: 400 });
  const reply = await WhatsAppGateway.poll(report, request.nextUrl.origin);
  if (reply.scan) console.info("[whatsapp] scan", reply.scan);
  return Response.json(reply, { headers: { "Cache-Control": "no-store" } });
}
