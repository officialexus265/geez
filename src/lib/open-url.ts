/**
 * Open external URLs (PayChangu, etc.) in a way that works in Capacitor + web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      // Prefer system browser / Custom Tabs — user can return to the app
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url, presentationStyle: "popover" });
        return;
      } catch {
        // Browser plugin not installed — fall through
      }
      window.open(url, "_system");
      return;
    }
  } catch {
    // not Capacitor
  }

  window.location.href = url;
}

export function softNavigate(path: string) {
  if (typeof window === "undefined") return;
  try {
    // Keep navigation inside the WebView (same origin)
    window.location.assign(path);
  } catch {
    window.location.href = path;
  }
}
