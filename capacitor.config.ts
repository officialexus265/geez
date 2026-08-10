import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geez.savings',
  appName: 'GEEZ',
  webDir: 'out',
  server: {
    url: 'https://geez-lac.vercel.app',
    cleartext: true
  }
};

export default config;