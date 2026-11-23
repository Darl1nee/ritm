import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.darl1nee.ritm',
  appName: 'Ритм',
  webDir: 'public',
  server: {
    url: 'https://ritm-zeta.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
