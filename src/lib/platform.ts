/**
 * Detect whether the app is running inside Capacitor (Android/iOS APK)
 * vs a normal browser.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Capacitor injects this
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    if (cap?.getPlatform?.() === "android" || cap?.getPlatform?.() === "ios")
      return true;
  } catch {}
  // Fallback: custom user agent or scheme check
  return false;
}

export function getPaymentReturnUrl(txRef: string): string {
  const webBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://geez-lac.vercel.app");

  if (isNativeApp()) {
    // Custom scheme → opens the APK again after PayChangu
    return `geez://deposit/return?tx_ref=${encodeURIComponent(txRef)}`;
  }

  return `${webBase}/deposit/return?tx_ref=${encodeURIComponent(txRef)}`;
}
