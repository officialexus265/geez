# GEEZ Deep Links (PayChangu return → App)

## How it works

| Platform | return_url sent to PayChangu |
|----------|------------------------------|
| Web browser | `https://geez-lac.vercel.app/deposit/return?tx_ref=...` |
| Android APK | `geez://deposit/return?tx_ref=...` |

## Android setup (required once)

After `npx cap add android` / `npx cap sync`, edit:

`android/app/src/main/AndroidManifest.xml`

Inside the main `<activity>` (the one with `MAIN` / `LAUNCHER`), add:

```xml
<!-- Deep link: geez://deposit/return -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="geez" android:host="deposit" />
</intent-filter>

<!-- Optional: HTTPS App Links (same domain) -->
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="geez-lac.vercel.app"
        android:pathPrefix="/deposit/return" />
</intent-filter>
```

Then:

```bash
npm install @capacitor/app
npx cap sync android
npx cap open android
# Build APK
```

## Test

1. In the APK, start a deposit.
2. Complete (or cancel) on PayChangu.
3. Phone should open **GEEZ** on the return/success screen — not stay in Chrome.
