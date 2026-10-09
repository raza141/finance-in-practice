import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { ProofStorage } from "@/domains/invoices/server/ProofStorage";

/** Streams a payment's private proof file to a signed-in owner (billing is owner-only). */
export async function GET(_request: Request, { params }: RouteContext<"/admin/payment-proof/[paymentId]">) {
  if ((await AdminAuth.current())?.role !== "owner") return new Response("Not found", { status: 404 });
  const url = await InvoiceRepository.fromEnv()?.proofUrl((await params).paymentId);
  const file = url ? await ProofStorage.read(url) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.stream, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store" } });
}
