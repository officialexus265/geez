# Free automated messaging (loan reminders + defaults)

## Option A — cron-job.org (free)

1. Create free account at https://cron-job.org
2. New cron job:
   - URL: `https://geez-lac.vercel.app/api/cron/loans?secret=YOUR_CRON_SECRET`
   - Schedule: once daily (e.g. 05:00 UTC)
   - Method: GET
3. On Vercel set env: `CRON_SECRET=YOUR_CRON_SECRET`

## Option B — Vercel Cron

See `vercel.json` — runs `/api/cron/loans` daily (availability depends on Vercel plan).

## What it does

1. Sends loan due reminders (30/15/10/5/1 days) — in-app + email + SMS
2. Processes overdue loans (deduct from fixed goals)

## Email (required for withdraw codes + reminders)

Vercel env:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=GEEZ <your@gmail.com>
```

Gmail: use an App Password (Google Account → Security → App passwords).
