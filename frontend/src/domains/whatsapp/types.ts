export type MessageKind = "intro" | "number" | "booking" | "reminder" | "invoice" | "receipt" | "overdue" | "class" | "nudge";
export type MessageStatus = "queued" | "sending" | "sent" | "failed" | "unknown" | "cancelled" | "expired";
export type LinkState = "offline" | "connecting" | "pairing" | "connected" | "logged_out";
export type ClassPostKind = "mock" | "assignment" | "material" | "announcement";

/** One message to queue. `phone` is as typed on the client; it is normalised when queued. */
export interface OutgoingMessage {
  dedupeKey: string;
  kind: MessageKind;
  clientId: string;
  phone: string;
  body: string;
  ref?: string | null;
  /** Attach the PDF of /invoice/<token>. */
  documentToken?: string | null;
  attachmentName?: string | null;
  notBefore?: Date;
  expiresAt?: Date | null;
  quietOk?: boolean;
}

export interface WhatsAppLink {
  state: LinkState;
  stateSince: Date;
  phone: string | null;
  command: "link" | "unlink" | null;
  /** The QR to scan while linking. */
  pairingQr: string | null;
  testPhone: string | null;
  live: boolean;
  /** The owner's On/Off switch: off, the gateway keeps polling but stays disconnected. */
  gatewayOn: boolean;
  enabledAt: Date | null;
  lastSeenAt: Date | null;
  lastScanAt: Date | null;
  /** Minutes since the gateway last polled (database clock); null: never. */
  seenMinutes: number | null;
}

export interface MessageRow {
  id: string;
  kind: MessageKind;
  clientId: string;
  clientName: string;
  phone: string;
  body: string;
  status: MessageStatus;
  error: string | null;
  sentTo: string | null;
  notBefore: Date;
  createdAt: Date;
  sentAt: Date | null;
}

/** A student a class post can go to. `assigned`: Classroom assigned it to them (pre-ticked). */
export interface ClassRecipient {
  clientId: string;
  name: string;
  userId: string;
  assigned: boolean;
}

export interface ClassPost {
  itemId: string;
  courseId: string;
  classTitle: string;
  kind: ClassPostKind;
  title: string;
  link: string | null;
  dueAt: Date | null;
  recipients: ClassRecipient[];
  unmatched: number;
  status: "pending" | "sent" | "dismissed" | "auto";
  postedAt: Date;
}

/** What the gateway sends with each poll. */
export interface GatewayReport {
  state: LinkState;
  /** The number linked right now (digits), when connected. */
  phone: string | null;
  qr: string | null;
  /** The QR round ran out unscanned: drop the Link request. */
  expired: boolean;
  results: { id: string; ok: boolean; error?: string; sentTo?: string }[];
  inbound: { phone: string; text: string }[];
}

/** A claimed message, as the gateway gets it. */
export interface GatewayMessage {
  id: string;
  to: string;
  text: string;
  /** Page to print as the attached PDF. */
  pdfUrl: string | null;
  fileName: string | null;
}
