import { WhatsAppText } from "../services/WhatsAppText";

/** "4 Nov, 19:05" in Dubai time; a dash when there is none. */
export const whatsappTime = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: WhatsAppText.ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
