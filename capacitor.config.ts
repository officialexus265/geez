import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.geez.savings",
  appName: "GEEZ",
  webDir: "out",
  server: {
    url: "https://geez-lac.vercel.app",
    cleartext: true,
  },
  // Deep link scheme: geez://deposit/return?tx_ref=...
  plugins: {
    App: {
      // handled in JS via App.addListener('appUrlOpen')
    },
  },
  android: {
    allowMixedContent: true,
  },
  // Custom URL scheme registered when you add intent filters (see docs/DEEP_LINKS.md)
};

export default config;
