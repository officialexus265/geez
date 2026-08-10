# GEEZ — Our Shared Savings Vault

Private, playful shared savings app for two people, powered by PayChangu.

## Features

- Real PayChangu deposits (Airtel Money, TNM Mpamba, Bank, Cards)
- Dual-approval withdrawals (partner code via Email + SMS + personal PIN)
- Goals with animated progress
- Live dashboard totals
- History + branded receipts (print/PDF)
- Admin branding uploads (logo, favicon, OG, **app icon**, splash)
- PWA + basic offline support
- Dark / Light themes (Romantic Red + Army Green)

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill Supabase, PayChangu, SMTP, httpSMS keys
```

In Supabase:
1. Run `supabase/schema.sql`
2. Create a **public** storage bucket named `branding`
3. Register both accounts, then set one profile `role = 'admin'`

```bash
npm run dev
```

---

## Make it live on Vercel (via GitHub) — PowerShell

### 1. Create GitHub repo and push

```powershell
cd path\to\geez
git init
git add .
git commit -m "GEEZ v1 - shared savings vault"
gh repo create geez --private --source=. --remote=origin --push
# Or create the repo on github.com then:
# git remote add origin https://github.com/YOUR_USERNAME/geez.git
# git branch -M main
# git push -u origin main
```

### 2. Deploy on Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import the GitHub repo `geez`
3. Framework: **Next.js** (auto-detected)
4. Add Environment Variables (from your `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PAYCHANGU_SECRET_KEY`
   - `PAYCHANGU_PUBLIC_KEY`
   - `PAYCHANGU_WEBHOOK_SECRET`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - `HTTPSMS_API_KEY`, `HTTPSMS_FROM_NUMBER`
   - `NEXT_PUBLIC_APP_URL` = `https://your-app.vercel.app`
5. Click **Deploy**

### 3. After deploy

- Update PayChangu webhook URL to: `https://your-app.vercel.app/api/paychangu/webhook`
- Update `NEXT_PUBLIC_APP_URL` in Vercel to the real domain and redeploy
- In Supabase Auth → URL Configuration, add your Vercel domain

---

## Create an Android APK (manual install) with Android Studio

The easiest reliable way is **Capacitor** (wraps the live web app).

### Option A — Capacitor (recommended)

On your PC (PowerShell):

```powershell
cd path\to\geez
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "GEEZ" "com.geez.savings" --web-dir=out
```

In `capacitor.config.ts` set:

```ts
server: {
  url: "https://YOUR-APP.vercel.app",
  cleartext: true
}
```

Then:

```powershell
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. When finished, click **locate** → copy the APK to your phone
4. On phone: allow “Install from unknown sources” and install the APK

You can also change the app icon in Android Studio:
`android/app/src/main/res/mipmap-*/` — replace the icons with your uploaded app icon.

### Option B — Simple WebView APK (faster)

1. Open Android Studio → New Project → **Empty Views Activity**
2. Name: GEEZ, package: `com.geez.savings`
3. In `MainActivity` load your Vercel URL in a WebView
4. Add internet permission in `AndroidManifest.xml`
5. Build → Build APK → install on phone

---

## Admin Branding

Go to **/settings** (only visible/usable by admin):
- App Logo
- Favicon
- OG Image
- **App Icon** (home screen icon for PWA + APK)
- Splash / Opening screen image

Upload high-quality PNG (512×512 for app icon recommended).

---

Made with ❤️ for you two.
