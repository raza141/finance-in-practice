# WhatsApp notifications: what was built (18 Oct 2026)

Built overnight from what we agreed in the grilling session. **Nothing is deployed or pushed.** Everything is committed locally on `main`. Production needs one database migration before it can go live (step 1 below).

**No real WhatsApp message has been sent yet**, and linking a number has not been tried. Everything else was tested against the dev database with a pretend gateway (details at the end).

---

## How it works

```
Your Mac (always on)                          Website (Vercel)
whatsapp-gateway/gateway.ts                   /api/whatsapp/gateway
  - linked to the new SIM's WhatsApp            - checks Cal.com, invoices, Classroom every 5 min
  - every 60 s: "here's my status,  ───────►    - queues messages in the database
    here's what I sent"                         - hands back the next messages to send
  - sends them, prints invoice PDFs  ◄───────   - admin page: /admin/whatsapp
```

- Nothing on the internet connects to your Mac. The Mac calls the website and sends with one secret password.
- If the Mac is off, messages wait in the database and go out when it's back. Anything older than 7 days is dropped rather than sent late.
- Your database password, Cal.com key and Google Classroom key stay on the website. The Mac only holds the gateway password and the WhatsApp session.

## What gets sent

| When | Message | Who |
|---|---|---|
| A booking is confirmed (in admin **or** from Cal.com's email) | "Your session is confirmed ✅" with time and link | That student |
| Day before the session | Reminder (only if they booked more than 26 h ahead) | That student |
| 1 hour before | Reminder (only if they booked more than 3 h ahead). The only message allowed during quiet hours. | That student |
| Booking cancelled or moved | Waiting reminders for the old time are cancelled | – |
| Invoice issued (any way: issue, send, issue-and-pay, monthly) | Your usual invoice WhatsApp text (Settings template) **plus the PDF** | That client |
| Receipt issued | Your receipt text **plus the PDF** | That client |
| Invoice 5 days past due, still unpaid | One polite reminder with the PDF | That client |
| Further overdue reminders | **Only when you press** "Remind on WhatsApp" (Overdue invoices section) | That client |
| Post in a **private class** (consultancy / one-to-one) | Sent at once: "New assignment in …: title, due, link" | That student |
| Post in a **course or batch class** (CFA/FRM) | **Waits on /admin/whatsapp.** Students Classroom assigned it to are pre-ticked. You can change the ticks or edit the text (`{name}` = first name), then **Send** or **Don't send** | Only the ticked students |
| A mock or assignment you sent has a due date | "Nudge" button: messages only those students who haven't turned it in | Those students |

**Safety rules built in**
- **"Save this number" first.** Each student gets an intro message before anything else (once per phone number). Nothing else goes to them until that intro has gone out. If you change a student's phone number on their client page, they get a new intro.
- **STOP / START.** A student replying STOP is never messaged again until they reply START. Opted-out students are listed on the WhatsApp page.
- **Quiet hours.** Nothing goes out 22:00–08:00 Dubai time except the 1-hour reminder. Messages wait until 08:00.
- **Sent once.** Every event's message has a unique key. If the Mac crashes mid-send, that message is marked **"unknown"** and never resent automatically. You check the chat and press "Send again" only if it didn't arrive.
- **Human pace.** 3–8 seconds between messages.
- **Nothing old is announced.** Only bookings, invoices and class posts from *after* the first number is linked get a message. Exception: the day-before and hour-before **reminders** also go out for sessions booked earlier.
- **Rechecked before sending.** If an invoice is voided, or paid while its overdue reminder waits (e.g. overnight), that message is cancelled rather than sent.
- **Test mode is on by default.** Until you press **Go live**, every message goes to *your* test number instead, starting `[TEST: for Ali, +971…]`. In test mode, nothing is sent to students at all.
  - Anything that happens during test mode (a booking confirmed, an invoice issued) counts as done. It is **not** sent to the student again after Go live. Only the "save this number" intro is sent for real later.

## Switching numbers (banned, or you want a new one)

On /admin/whatsapp, type the new number and press **Link**. A pairing code appears within a few seconds (press Refresh). On the phone with that number, go to WhatsApp → Settings → Linked devices → Link a device → *Link with phone number instead*, and type the code. No QR scanning.

When the new number connects, every student who'd had the intro gets *"Finance in Practice has a new WhatsApp number: this one"* from it. In live mode they also get the same by email. **Unlink** stops all sending immediately.

---

## Steps for you tomorrow

### A. Try it locally first (safe: dev database, test mode)
1. `cd frontend && npm run dev`. `.env.local` already has a `WHATSAPP_GATEWAY_SECRET` I added for local testing.
2. In a second terminal: `cd whatsapp-gateway && npm start`. Its `.env` already points at `http://localhost:3000` with the same secret.
3. Open http://localhost:3000/admin/whatsapp. Enter **your own number** as the test number → **Use test mode**.
4. Type the **new SIM's** number → **Link**. Refresh, then enter the code on the new phone.
5. To see a message: the dev database is empty. Add a client with *your* phone, issue an invoice to them, and wait up to 5 minutes. You should get the intro, then the invoice with its PDF, on your number.

### B. Production
0. **Check Neon first.** The Mac calls the website every 60 s, and each call wakes the database, so it never goes to sleep. Open Neon → your project → Usage, and check the plan's monthly compute allowance against "always on". If the allowance runs out, the **whole website's** database stops, not just WhatsApp. If it's tight, set `POLL_SECONDS=300` in `whatsapp-gateway/.env`; messages then go out within about 5 minutes.
1. **Run the migration in production first** (Vercel → Storage → Query, as before):
   `cd frontend && npm run db:migrate -- --print 044_whatsapp`. Paste the one line it prints and run it. If you push before this, the build guard stops the deploy.
2. Make a secret: `openssl rand -hex 32`. Add it in Vercel as **`WHATSAPP_GATEWAY_SECRET`** (Production), then push `main` (`git push`).
3. In `whatsapp-gateway/.env`, set `SITE_URL=https://financeinpractice.me` and the **same** secret.
   - SITE_URL must be the exact address the site answers on, not one that redirects (www vs no-www). A redirect drops the password, and every call fails with 401. Check with `curl -sI https://financeinpractice.me/api/whatsapp/gateway`: it must **not** answer 301, 307 or 308.
4. Keep the Mac awake: `sudo pmset -a sleep 0 disksleep 0` (or System Settings → Energy → never sleep).
5. Start it at login: follow the 3 lines at the top of `whatsapp-gateway/me.financeinpractice.whatsapp.plist`. Its log is `/tmp/fip-whatsapp.log`.
   - The project is on `/Volumes/Project`. If that drive isn't mounted at login, the gateway keeps retrying until it is.
6. /admin/whatsapp → test number → Link the SIM → check a few test messages → **Go live**.
   - If you already linked the SIM while testing locally, the session in `whatsapp-gateway/auth/` carries over. The page should simply show it connected; press Link again only if it doesn't.
7. If `/tmp/fip-whatsapp.log` says "Operation not permitted", macOS is blocking a background program from reading `/Volumes/Project`. Give `node` Full Disk Access (System Settings → Privacy & Security), or move `whatsapp-gateway/` into your home folder and update the path in the plist.

---

## Changes from what we agreed (please read)

1. **The website does the watching, not the Mac.** I'd said the Mac would check Classroom and Cal.com. Instead, the website checks them each time the Mac calls in, at most every 5 minutes. Reason: it reuses the Cal.com, Classroom and invoice code you already have, and keeps those keys off the Mac. Behaviour is the same.
2. **"WhatsApp is down" email only works while the Mac is running.** If the WhatsApp link drops for 30 minutes, you get one email (to `EMAIL_REPLY_TO`). If the **Mac itself is off**, nothing can send that email: a scheduled job on Vercel would need `CRON_SECRET`, which you've put on hold. In that case the page shows "Gateway not running · last seen X min ago".
3. **Student alone in a course class.** "Automatic" applies to *private classes* (the ones added on a client's page). A university student who is the only person in a regular course class still goes through the button. If you want that class automatic, add it as a private class on their client page.
4. **Invoices to clients without a client record** (no saved client) are not sent on WhatsApp. Use the existing WhatsApp share button for those.
5. **Overdue reminders** apply only to invoices issued after WhatsApp is switched on. Older overdue invoices appear in the list, and you remind them with the button.
6. **Only English, Dubai quiet hours.** Times in booking messages use the student's own time zone from Cal.com. Quiet hours are Dubai time for everyone.

## Not tested yet, so watch for these
- **Receipts.** They use the same path as invoices, and their links stay valid at least 90 days, but no real receipt was issued overnight.
- **A real WhatsApp send, pairing by code, PDF delivery inside WhatsApp, and STOP replies from a real phone.** None were possible overnight. The library is Baileys 7.0.0-rc14, the current release. It's a release candidate, so expect a small fix or two on first run.
- **Cal.com booking detection with a real confirmed booking.** It ran against your real Cal.com account and found nothing new, which is correct; there was no new booking.
- **Classroom posts and buttons with real classes.** The code ran against the dev database's connection, which found nothing new. The logic is unit-tested.
- **Unofficial route.** WhatsApp can still ban the SIM. That's why it's a separate SIM, and why switching numbers is one button.
- **Database wake-ups.** The Mac polls every 60 s, which keeps the Neon database awake all the time. Check Neon's usage page after a few days. If compute hours climb, raise `POLL_SECONDS` in `whatsapp-gateway/.env`, e.g. to 120.

## What was tested overnight (dev database, test data removed afterwards)
- Wrong password → refused. Pairing → code shown → connected → `enabled_at` set and first scan run.
- An issued invoice → intro + invoice (with PDF) + overdue reminder queued once each. A second scan queued nothing new.
- Quiet hours held everything at 03:45 Dubai time.
- Test mode → all three went to the test number with the `[TEST: …]` label.
- Send results recorded, including a failure ("not on WhatsApp").
- Live mode → a student's messages wait until their intro has gone out, then follow.
- A test-mode intro doesn't count as the real one, so the real intro still goes out after Go live.
- STOP → student switched off and their waiting messages cancelled.
- New number linked → "new number" message queued for introduced students.
- Invoice voided while its message waited → message cancelled, not sent.
- PDF: printed the invoice page with your Mac's Chrome: correct one-page invoice, and the client's "viewed" count stayed at 0. A missing or expired link is refused rather than attached.
- Admin page rendered with real data (screenshot checked).
- Checks: typecheck, lint, all 367 tests (7 new) pass. The gateway script type-checks.

## Files
- `frontend/scripts/db/migrate.mts`: migration `044_whatsapp` (tables `whatsapp_link`, `whatsapp_messages`, `whatsapp_class_posts`; clients get `whatsapp_intro_phone`, `whatsapp_off`). Applied to **dev only**.
- `frontend/src/domains/whatsapp/`
  - `services/WhatsAppText.ts`: message wording, quiet hours, reminder timing
  - `server/WhatsAppOutbox.ts`: queue, intro-first rule, test mode
  - `server/WhatsAppScanner.ts`: bookings, invoices, overdue, Classroom
  - `server/WhatsAppGateway.ts`: the Mac's call
  - `server/WhatsAppClassPosts.ts`: batch posts, nudges, overdue list
  - `actions/whatsapp.ts`
  - a test file
- `frontend/src/app/api/whatsapp/gateway/route.ts`, `frontend/src/app/admin/(panel)/whatsapp/page.tsx`, and a "WhatsApp" entry in the admin menu.
- `frontend/src/domains/invoices/components/ViewBeacon.tsx`: the gateway printing a PDF doesn't count as the client viewing it.
- `whatsapp-gateway/`: the Mac program (`gateway.ts`), `.env.example` and the auto-start file. `auth/`, which is the WhatsApp session, is git-ignored; treat it like a password.
