/**
 * WhatsApp gateway: runs on the owner's Mac, links one WhatsApp number through
 * Baileys (WhatsApp Web's linked-device protocol) and sends what the website
 * queues. Nothing connects in: it polls POST <SITE_URL>/api/whatsapp/gateway,
 * reports its state and results, and gets back the next messages and any
 * link/unlink command from the admin page. Invoices and receipts are printed to
 * PDF from their public page with the Mac's own Chrome (headless).
 *
 *   npm start            # reads .env (see .env.example)
 *
 * Node runs this file with type stripping only: no enums, no constructor
 * parameter properties.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState } from "baileys";
import type { WAMessage, WASocket } from "baileys";
import pino from "pino";

type LinkState = "offline" | "connecting" | "pairing" | "connected" | "logged_out";
type Result = { id: string; ok: boolean; error?: string; sentTo?: string };
type Inbound = { phone: string; text: string };
type Reply = {
  command: { type: "link"; phone: string } | { type: "unlink" } | null;
  on: boolean;
  messages: { id: string; to: string; text: string; pdfUrl: string | null; fileName: string | null }[];
  scan: Record<string, string> | null;
};

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

class Config {
  readonly site: string;
  readonly secret: string;
  readonly authDir: string;
  readonly chrome: string;
  /** Seconds between polls when idle. Each poll wakes the database, so keep it modest. */
  readonly pollSeconds: number;

  constructor(env: NodeJS.ProcessEnv) {
    this.site = (env.SITE_URL ?? "").replace(/\/+$/, "");
    this.secret = env.WHATSAPP_GATEWAY_SECRET ?? "";
    this.authDir = resolve(env.AUTH_DIR || "auth");
    this.chrome = env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    this.pollSeconds = Math.max(15, Number(env.POLL_SECONDS) || 60);
    if (!/^https?:\/\//.test(this.site)) throw new Error("SITE_URL is not set (e.g. https://financeinpractice.me)");
    if (this.secret.length < 32) throw new Error("WHATSAPP_GATEWAY_SECRET is not set (32+ characters, same as on Vercel)");
  }
}

/** The website's gateway endpoint. */
class SiteApi {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async poll(report: { state: LinkState; phone: string | null; pairingCode: string | null; results: Result[]; inbound: Inbound[] }): Promise<Reply> {
    const response = await fetch(`${this.config.site}/api/whatsapp/gateway`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(70_000),
    });
    if (!response.ok) throw new Error(`Site answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return (await response.json()) as Reply;
  }
}

/** Prints a document page to PDF with headless Chrome. The user agent tells the page not to count it as the client viewing it. */
class PdfPrinter {
  static readonly MAX_BYTES = 15 * 1024 * 1024;
  private readonly chrome: string;

  constructor(chrome: string) {
    this.chrome = chrome;
  }

  async print(url: string): Promise<Buffer> {
    // Chrome prints error pages too: never attach a "not found" or "link expired" page.
    const check = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!check.ok) throw new Error(`Document page answered ${check.status}`);
    if ((await check.text()).includes("This link has expired")) throw new Error("Document link has expired: renew it on the invoice page");
    const dir = await mkdtemp(join(tmpdir(), "fip-pdf-"));
    const out = join(dir, "document.pdf");
    try {
      await promisify(execFile)(
        this.chrome,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-first-run",
          "--no-pdf-header-footer",
          `--user-data-dir=${join(dir, "profile")}`,
          "--user-agent=Mozilla/5.0 (Macintosh) FIPWhatsAppGateway",
          "--virtual-time-budget=8000",
          `--print-to-pdf=${out}`,
          url,
        ],
        { timeout: 60_000 },
      );
      const pdf = await readFile(out);
      if (pdf.subarray(0, 5).toString() !== "%PDF-") throw new Error("Chrome did not produce a PDF");
      if (pdf.length > PdfPrinter.MAX_BYTES) throw new Error("PDF too large for WhatsApp");
      return pdf;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/** One linked WhatsApp number. The session lives in authDir: treat that folder like a password. */
class WhatsAppLink {
  state: LinkState = "offline";
  phone: string | null = null;
  pairingCode: string | null = null;
  readonly inbound: Inbound[] = [];

  private readonly authDir: string;
  private sock: WASocket | null = null;
  private pairPhone: string | null = null;
  private stopping = false;
  private readonly logger = pino({ level: "warn" });

  constructor(authDir: string) {
    this.authDir = authDir;
  }

  /** The number a pairing code is being requested for, while linking. */
  get pairingPhone(): string | null {
    return this.pairPhone;
  }

  get hasSession(): boolean {
    return existsSync(join(this.authDir, "creds.json"));
  }

  /** Connects with the saved session; with `pairPhone`, starts fresh and asks WhatsApp for a pairing code for it. */
  async connect(pairPhone: string | null = null): Promise<void> {
    this.close();
    this.stopping = false;
    this.pairPhone = pairPhone;
    if (pairPhone) await rm(this.authDir, { recursive: true, force: true });
    await mkdir(this.authDir, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    this.state = "connecting";
    this.pairingCode = null;
    const sock = makeWASocket({
      auth: state,
      logger: this.logger,
      browser: Browsers.macOS("Chrome"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;
    let asked = false;
    let newLogin = false;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (update) => {
      if (sock !== this.sock) return;
      if (update.isNewLogin) newLogin = true;
      if (update.qr) {
        // Not linked. Only ask for a code when the owner asked to link a number; never sit showing QR codes.
        if (!this.pairPhone) {
          log("Not linked: link a number from the admin WhatsApp page.");
          this.state = "logged_out";
          this.close();
          return;
        }
        if (!asked) {
          asked = true;
          try {
            this.pairingCode = await sock.requestPairingCode(this.pairPhone);
            this.state = "pairing";
            log(`Pairing code for +${this.pairPhone}: ${this.pairingCode}`);
          } catch (error) {
            log("Pairing code request failed", error);
          }
        }
      }
      if (update.connection === "open") {
        this.state = "connected";
        this.pairingCode = null;
        this.pairPhone = null;
        this.phone = (sock.user?.id ?? "").split(":")[0].split("@")[0] || null;
        log(`Connected as +${this.phone}`);
      }
      if (update.connection === "close") {
        const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        this.sock = null;
        if (this.stopping) return;
        if (code === DisconnectReason.loggedOut) {
          log("Logged out by WhatsApp (unlinked on the phone, or banned). Session removed.");
          await rm(this.authDir, { recursive: true, force: true });
          this.state = "logged_out";
          this.phone = null;
          return;
        }
        // After pairing WhatsApp asks for a restart (515); other drops are network. Reconnect with the
        // saved session once linked; while still pairing, ask for a fresh code.
        this.state = "connecting";
        // creds.me is already set once a code is issued; registered / isNewLogin mean the code was entered.
        const linked = Boolean(sock.authState.creds.registered) || newLogin;
        if (linked) this.pairPhone = null;
        await sleep(code === DisconnectReason.restartRequired ? 500 : 5_000);
        if (!this.sock && !this.stopping) await this.connect(linked ? null : this.pairPhone).catch((e) => log("Reconnect failed", e));
      }
    });
    sock.ev.on("messages.upsert", ({ messages, type }) => {
      if (type !== "notify") return;
      for (const m of messages) this.receive(m);
    });
  }

  /** Only STOP / START replies leave the Mac; other messages stay on the phone. */
  private receive(m: WAMessage): void {
    if (m.key.fromMe) return;
    const text = (m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "").trim();
    if (!/^(stop|unsubscribe|start)[.!]*$/i.test(text)) return;
    // Newer chats address people by LID; the phone number then comes in remoteJidAlt.
    const jid = [m.key.remoteJid, m.key.remoteJidAlt].find((j) => j?.endsWith("@s.whatsapp.net"));
    const phone = jid?.split("@")[0].split(":")[0];
    if (phone && /^[0-9]{8,15}$/.test(phone)) this.inbound.push({ phone, text });
    else log("A STOP/START reply came without a phone number; handle it by hand.");
  }

  async send(to: string, text: string, pdf: { data: Buffer; fileName: string } | null): Promise<void> {
    if (!this.sock || this.state !== "connected") throw new Error("Not connected");
    const [found] = (await this.sock.onWhatsApp(to)) ?? [];
    if (!found?.exists) throw new Error(`+${to} is not on WhatsApp`);
    if (pdf) await this.sock.sendMessage(found.jid, { document: pdf.data, mimetype: "application/pdf", fileName: pdf.fileName, caption: text });
    else await this.sock.sendMessage(found.jid, { text });
  }

  async logout(): Promise<void> {
    this.stopping = true;
    try {
      await this.sock?.logout();
    } catch (error) {
      log("Logout call failed (removing the session anyway)", error);
    }
    this.close();
    await rm(this.authDir, { recursive: true, force: true });
    this.state = "logged_out";
    this.phone = null;
    this.pairingCode = null;
  }

  /** The owner's Off switch: disconnect but keep the session, so On reconnects without pairing. */
  pause(): void {
    this.stopping = true;
    this.pairPhone = null;
    this.close();
    this.state = "offline";
    this.pairingCode = null;
  }

  close(): void {
    const sock = this.sock;
    this.sock = null;
    sock?.end(undefined);
  }
}

class Gateway {
  private readonly config: Config;
  private readonly api: SiteApi;
  private readonly link: WhatsAppLink;
  private readonly printer: PdfPrinter;
  private results: Result[] = [];

  constructor(config: Config) {
    this.config = config;
    this.api = new SiteApi(config);
    this.link = new WhatsAppLink(config.authDir);
    this.printer = new PdfPrinter(config.chrome);
  }

  async run(): Promise<void> {
    await this.lock();
    // Connects on the first poll, once the site says the switch is on.
    this.link.state = this.link.hasSession ? "offline" : "logged_out";
    for (;;) {
      let wait = this.config.pollSeconds * 1000;
      try {
        wait = await this.tick();
      } catch (error) {
        log("Poll failed:", error instanceof Error ? error.message : error);
      }
      await sleep(wait);
    }
  }

  /** One poll: report, obey a command, send what came back. Returns how long to wait before the next poll. */
  private async tick(): Promise<number> {
    const results = this.results;
    const inbound = this.link.inbound.splice(0);
    let reply: Reply;
    try {
      reply = await this.api.poll({ state: this.link.state, phone: this.link.phone, pairingCode: this.link.pairingCode, results, inbound });
    } catch (error) {
      this.link.inbound.unshift(...inbound); // try again next poll
      throw error;
    }
    this.results = this.results.filter((r) => !results.includes(r));
    if (reply.scan) log("Scan:", reply.scan);

    const command = reply.command;
    // The site sends no messages and no link command while off ("Link" turns it on).
    if (reply.on === false && command?.type !== "unlink") {
      if (this.link.state !== "offline" && this.link.state !== "logged_out") {
        log("Switched off (admin): disconnected, session kept");
        this.link.pause();
      }
      return this.config.pollSeconds * 1000;
    }
    if (reply.on !== false && this.link.state === "offline" && this.link.hasSession && !command) {
      log("Switched on: connecting");
      await this.link.connect();
      return 5_000;
    }
    if (command?.type === "unlink" && this.link.state !== "logged_out") {
      log("Unlinking (admin)");
      await this.link.logout();
      return 1_000;
    }
    if (command?.type === "link" && !(this.link.state === "connected" && this.link.phone === command.phone) && !this.pairingFor(command.phone)) {
      log(`Linking +${command.phone} (admin)`);
      if (this.link.state === "connected") await this.link.logout();
      await this.link.connect(command.phone);
      return 3_000;
    }
    if (command) return 5_000; // pairing in progress: poll fast so the code shows quickly

    for (const m of reply.messages) {
      try {
        const pdf = m.pdfUrl ? { data: await this.printer.print(m.pdfUrl), fileName: m.fileName ?? "document.pdf" } : null;
        await this.link.send(m.to, m.text, pdf);
        this.results.push({ id: m.id, ok: true, sentTo: m.to });
        log(`Sent ${m.id} to +${m.to}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.results.push({ id: m.id, ok: false, error: message.slice(0, 300) });
        log(`Failed ${m.id}: ${message}`);
      }
      // A person's pace, not a bot's.
      await sleep(3_000 + Math.random() * 5_000);
    }
    return reply.messages.length > 0 ? 1_000 : this.config.pollSeconds * 1000;
  }

  private pairingFor(phone: string): boolean {
    return this.link.state !== "connected" && this.link.pairingPhone === phone;
  }

  /** One gateway per session folder: two would fight over the same linked device. */
  private async lock(): Promise<void> {
    const file = join(dirname(this.config.authDir), "gateway.pid");
    if (existsSync(file)) {
      const pid = Number(await readFile(file, "utf8"));
      try {
        if (pid && pid !== process.pid) {
          process.kill(pid, 0);
          throw new Error(`Another gateway is running (pid ${pid}). Stop it first.`);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    await writeFile(file, String(process.pid));
    const release = () => rm(file, { force: true }).finally(() => process.exit(0));
    process.once("SIGINT", release);
    process.once("SIGTERM", release);
  }
}

await new Gateway(new Config(process.env)).run();
