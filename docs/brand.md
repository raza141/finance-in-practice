# Finance in Practice: brand guide

One page that every screen follows: the public website, the student portal, admin, emails and WhatsApp.
Goal: students and clients never have to learn our UI. We use the patterns they already know from
LinkedIn, Google Classroom, Notion and their banking apps, in our own colours.

Tokens live in `frontend/src/app/globals.css` (`@theme`). Never hard-code a hex value in a component.

## 0. Locked

The brand is enforced, not just written down. `frontend/src/core/brand.test.ts` runs with every test run and fails when:

- a class uses a hex value (`bg-[#…]`) instead of a token;
- a Tailwind hue is used that has no job here (only red, emerald, violet, indigo, slate; the admin schedule's per-course colours are the one exception);
- a font is loaded or set anywhere but the root layout (Inter, Merriweather, JetBrains Mono);
- a core token changes value: canvas #0b1120, surface #151e32, line #24304a, gold #d4af37, quant #22d3ee, ink #f8fafc, muted #aab6c8.

Screens that copy another product's look on purpose (the Google review card, the WhatsApp chat preview, the Google result preview) are listed in the test as exceptions.

**Background**: every page is `canvas` navy with the faint finance grid (`FinanceBackdrop`, `bg-grid-lines`); cards float on it with blur. No photos, gradients or light sections behind content.

## 1. Voice

- Plain and short. Say what the thing is: "Book a session", not "Start your journey".
- No taglines, eyebrows or helper text unless a student would be stuck without it.
- Numbers over adjectives: "Exam in 29 days · 1 of 5 topics done".
- Exam brands are always written with ® on first use (CFA®, FRM®) and never as if we are them.

## 2. Logo

- Use the exact lockup in `frontend/public/brand/fip-logo.png` only. Never re-typeset, recolour, stretch or add effects.
- Top-left in every bar, 30px high, linking to the website home.
- Keep clear space equal to the height of the "F" on all sides.

## 3. Colour: one job per colour

| Token | Hex | Job | Never |
|---|---|---|---|
| `canvas` | #0b1120 | Page background | |
| `surface` / `surface-raised` | #151e32 / #1c2740 | Cards, menus, raised buttons | |
| `line` | #24304a | Borders, dividers | |
| `ink` | #f8fafc | Body text, headings | |
| `muted` | #aab6c8 | Secondary text (still 4.5:1 on canvas) | Long paragraphs |
| `gold` | #d4af37 | **Money and commitment**: Book, Enrol, Pay, Accept; the active tab and page switch; exam day; overdue (dashed); counts that need action | Decoration, links |
| `quant` (cyan) | #22d3ee | **Go and do**: links, Join session, focus rings, sessions in the calendar | Prices, warnings |
| red-300 | | Cancel, sign out, errors only | Anything reversible |
| `quant-bright` / `quant-soft` | #67e8f9 / #cffafe | Top of the cyan button; text on cyan chips | |
| `google-green` (+ `-dark`, `-light`) | #1e8e3e | Opens Google Classroom (their brand, so students recognise it) | Anything else |
| `linkedin` (+ `-dark`) | #0a66c2 | Follow us on LinkedIn, share | Anything else |
| `whatsapp` (+ `-dark`) | #25d366 | WhatsApp chat and share | Anything else |
| `code` | #22272e | Code blocks | Anything else |

**One gold.** Gold is always #d4af37 at full strength: buttons, the selected page switch, badges, overdue topics. No second gold (no amber or yellow), and no faded gold for states: a disabled gold button turns neutral grey (`globals.css` does this for every gold button). `gold-bright` exists only as the hover state.

Colour never carries meaning alone: overdue is dashed **and** gold, done is ticked **and** dimmed.

## 4. Type

| Role | Font | Use |
|---|---|---|
| Headings | Merriweather italic, normal weight | Page and card titles ("Your study plan") |
| Body and UI | Inter | Everything else, 16px base on phones |
| Labels and data | JetBrains Mono, uppercase, wide tracking, 11px | Card labels ("NEXT SESSION"), figures, buttons in the portal |

Scale: 12 / 14 / 16 / 20 / 24 / 30. Numbers that change (timers, money, scores) use tabular figures.

## 5. Buttons: one primary action per screen

Shared classes: `frontend/src/core/components/ui/buttonStyles.ts` and `frontend/src/domains/students/components/buttons.ts`.

| Kind | Look | When |
|---|---|---|
| Primary | Raised gold (`RAISED_GOLD`, `BOOK_BUTTON`) | The one money or commitment action on the screen |
| Do now | Raised solid cyan (`RAISED_QUANT`, `JOIN_BUTTON`) | Join a live session, start a mock |
| Secondary | Dark with cyan outline (`RAISED_PLAIN`, `BUTTON`) | Open, view, change |
| Quiet | Text only, muted | Cancel, Not now, Keep it |
| Destructive | Text, red on hover, behind a confirm | Cancel a session, sign out |

Keep the raised bevel, the glow and the tilt: they are part of the brand. No arrows inside buttons.

## 6. Icons

- **One set: Lucide** (24px, 1.5–2px round stroke, outline). It's what Notion, Linear, Vercel and shadcn use, so the shapes are already familiar.
- No emoji as icons in UI (the brand test checks).
- An icon always sits next to a label, except the avatar and close buttons, which carry an `aria-label`.
- Same meaning, same icon, everywhere:

| Meaning | Icon |
|---|---|
| Home | house |
| Sessions, Zoom, live class | video camera |
| Study plan, dates, deadlines | calendar |
| Mocks, tests, practice | clipboard with a tick |
| Classroom, course, programme | graduation cap |
| Progress, marks | line chart |
| Mistakes notebook | notebook |
| Hours & payments, invoices | receipt |
| Location, in person | map pin |
| Materials, files | file |
| Settings | gear |
| Sign out | log-out arrow |

## 7. Layout and placement (the same on every page)

- **Bar**: one sticky bar, 64px. Logo left, main navigation centre on wide screens, account right ("Me" menu: name, account pages, sign out). No second bar under it.
- **Phones and tablets (< 1024px)**: main navigation becomes a bottom tab bar, at most 5 items, icon over label, the active one gold. Content leaves room for it.
- **A tab with several pages** (Sessions: Book a session, My sessions; Mocks: Mock exams, Progress, Mistakes notebook, Topic drill) opens a small menu in the bar on wide screens and shows a pill switch at the top of the page on every screen.
- **Two-column pages**: the main working area left, the narrow side panel (live preview, latest posts) right, about 22–24rem (Study plan, Book a session, Classroom). On phones they stack.
- **Badges**: a small gold count on a tab only when something needs the student (overdue topics, sessions awaiting confirmation).
- **Every tab has a URL** (`?tab=…`), so refresh, Back and shared links land in the same place.
- **Width and rhythm**: `page-container` for everything, so the bar, cards and logo share one left edge. Spacing on a 4/8px scale; cards 24px padding (32px on desktop), 24px between cards.
- **Cards**: `rounded-3xl`, `border-white/10`, `bg-canvas/70` with blur; menus and popovers `rounded-2xl`, `bg-surface`.
- **Marketing pages** keep the website navbar and footer; the student portal, mock screens and admin never show them.

## 8. Motion

- 150–200ms for hover and press, 300ms for panels. Ease out on entry.
- Glow and tilt stay on the website hero and cards; the scrambling course title stays.
- Everything respects `prefers-reduced-motion`.

## 9. Accessibility (non-negotiable)

- Text contrast 4.5:1, icons and borders 3:1.
- Visible cyan focus ring on every control; keyboard reaches everything; drag always has a button alternative.
- Touch targets 44px on phones (24px minimum on desktop).
- Live changes (saved, booked, moved) are announced with `role="status"`.

## 10. Rolling it out

1. Portal: one bar, bottom tab bar, dropdowns, Me menu. **Done (Nov 2026).**
2. `lucide-react` across the portal, website and admin; the brand test fails on emoji used as icons. **Done (Nov 2026).** Kept on purpose: brand logos (Google, LinkedIn, WhatsApp), charts, and the animated answer tick.
3. Website header and footer: same placement rules (logo left, nav centre, one gold action right).
4. Admin: same tokens, buttons and icons; its sidebar stays (admins aren't students).
5. Emails and WhatsApp templates: logo, gold for the one action, the same words as the buttons on the site.

Any screen that breaks a rule here is a bug: fix the screen, or change this guide on purpose.
