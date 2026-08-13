# Return to app after PayChangu

PayChangu only accepts https return URLs (not geez://).

## How return works

1. return_url = https://geez-lac.vercel.app/deposit/return?tx_ref=...
2. On Android, if App Links are verified, that HTTPS URL can open the GEEZ app
3. AndroidManifest needs HTTPS intent-filter for geez-lac.vercel.app
4. assetlinks.json must include the correct signing certificate SHA-256

## Manifest intent-filter (inside main activity)

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="geez-lac.vercel.app" android:pathPrefix="/deposit/return" />
</intent-filter>
```

## Get SHA-256 of debug keystore

```bash
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Copy SHA256 and put in public/.well-known/assetlinks.json

## After payment

User may land in Chrome on the success page — they tap "Open in app" if offered, or switch back to GEEZ manually. Dashboard will show the deposit once status=success.
