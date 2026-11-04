import Link from "next/link";
import QRCode from "qrcode";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { linkNumber, setGatewayOn, setMode, unlinkNumber } from "../actions/whatsapp";
import type { WhatsAppLink } from "../types";
import { AutoRefresh } from "./AutoRefresh";

const STATE_LABEL: Record<string, string> = {
  offline: "Gateway not running",
  connecting: "Connecting",
  pairing: "Waiting for the QR code to be scanned",
  connected: "Connected",
  logged_out: "Logged out",
};

const BUTTON = "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold";
const SMALL = "h-8 rounded-md border border-line px-3 text-xs hover:bg-white/5";

/** Whether the gateway on the Mac is reachable, switched on and connected. */
export function gatewayHealth(link: WhatsAppLink): { healthy: boolean; running: boolean; status: string } {
  const running = link.seenMinutes !== null && link.seenMinutes <= 3;
  const status = !running
    ? "Mac not reachable (asleep, off or offline): the gateway starts by itself when it's back"
    : !link.gatewayOn
      ? "Switched off"
      : link.state === "offline"
        ? "Connecting"
        : STATE_LABEL[link.state];
  return { healthy: running && link.gatewayOn && link.state === "connected", running, status };
}

/** The linked number, the On/Off switch, linking by QR code, Test/Live mode and who replied STOP. */
export async function ConnectionPanel({ link, optedOut }: { link: WhatsAppLink; optedOut: readonly { id: string; name: string }[] }) {
  const seenAgo = link.seenMinutes;
  const { healthy, running, status } = gatewayHealth(link);
  const qr = link.command === "link" && link.pairingQr ? await QRCode.toString(link.pairingQr, { type: "svg", margin: 2 }) : null;
  return (
    <>
      <section className="mt-6 rounded-lg border border-line p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${healthy ? "bg-quant" : "bg-gold"}`} aria-hidden />
          <p className="flex-1 text-sm">
            <span className="font-semibold">{status}</span>
            {link.phone && <span className="text-muted"> · {link.state === "connected" ? "linked" : "last linked"}: +{link.phone}</span>}
            <span className="text-muted"> · last seen {seenAgo === null ? "never" : seenAgo < 1 ? "just now" : `${seenAgo} min ago`}</span>
          </p>
          <form action={setGatewayOn}>
            <input type="hidden" name="on" value={link.gatewayOn ? "0" : "1"} />
            <PendingButton
              pendingLabel="…"
              className={`${BUTTON} ${link.gatewayOn ? "border border-line font-normal hover:bg-white/5" : "bg-quant text-canvas hover:bg-quant/90"}`}
            >
              {link.gatewayOn ? "Turn off" : "Turn on"}
            </PendingButton>
          </form>
          <Link href="/admin/whatsapp?tab=connection" className={SMALL + " inline-flex items-center"}>
            Refresh
          </Link>
        </div>
        {link.command === "link" && (
          <div className="mt-4 rounded-md border border-quant/40 bg-quant/5 p-4 text-sm">
            <AutoRefresh seconds={5} />
            {qr ? (
              <>
                <p>On the phone: WhatsApp → Settings → Linked devices → Link a device, then scan this. It changes every 20 seconds and stops after about 3 minutes.</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, nothing to optimise */}
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`} alt="WhatsApp link QR code" className="mt-3 h-64 w-64 rounded-md bg-white" />
              </>
            ) : (
              <p>Waiting for the gateway to show a QR code{running ? "…" : " (your Mac isn't reachable)."}</p>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {link.command !== "link" && (
            <form action={linkNumber}>
              <PendingButton pendingLabel="Asking…" className={`${BUTTON} bg-quant text-canvas hover:bg-quant/90`}>
                {link.state === "connected" ? "Switch to another number" : "Link (show QR code)"}
              </PendingButton>
            </form>
          )}
          {link.state === "connected" && (
            <form action={unlinkNumber}>
              <PendingButton pendingLabel="Unlinking…" className={`${BUTTON} border border-red-400/50 font-normal text-red-300 hover:bg-red-400/10`}>
                Unlink (stop sending)
              </PendingButton>
            </form>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-line p-5">
        <h2 className="text-lg">Mode</h2>
        <p className="mt-1 text-sm text-muted">
          {link.live ? (
            <span className="text-quant">Live: messages go to students.</span>
          ) : (
            <>
              <span className="text-gold">Test mode</span>
              {link.testPhone ? `: everything goes to +${link.testPhone} instead of students.` : ": nothing is sent until you set a test number."}
            </>
          )}
        </p>
        <form action={setMode} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Test number (yours)
            <input name="testPhone" type="tel" defaultValue={link.testPhone ? `+${link.testPhone}` : ""} placeholder="+971 50 123 4567" className={FIELD} />
          </label>
          <button name="mode" value="test" type="submit" className={`${BUTTON} border border-line font-normal hover:border-quant/60`}>
            Use test mode
          </button>
          <button name="mode" value="live" type="submit" className={`${BUTTON} bg-gold text-canvas hover:bg-gold/90`}>
            Go live
          </button>
        </form>
        {optedOut.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Replied STOP (never messaged):{" "}
            {optedOut.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/admin/clients/${c.id}`} className="text-quant hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
            . They can reply START to turn messages back on.
          </p>
        )}
      </section>

    </>
  );
}
