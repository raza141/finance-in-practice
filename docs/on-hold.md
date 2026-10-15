# On hold

## Weekly "Your week in class" email (since 2026-10-15)

- Built and deployed (migration `042_weekly_digest` is on production), but **`CRON_SECRET` is deliberately not set** on Vercel, so nothing is sent.
- Vercel Cron still calls `/api/cron/weekly-digest` every Sunday 05:00 UTC; without the secret it answers 401. A failed run in Vercel → Settings → Cron Jobs is expected while this is on hold.
- "Email me a preview" on a client's admin page still works (it only emails the owner).
- **To turn it on:** add `CRON_SECRET` (any long random text) under Vercel → Settings → Environment Variables → Production, then redeploy.
