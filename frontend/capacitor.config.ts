import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.talisman.app',
  appName: 'Talisman',
  webDir: 'dist',
  // For dev: uncomment to load from a live dev server instead of bundled assets
  // server: {
  //   url: 'http://192.168.x.x:5173',
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      backgroundColor: '#1B4332',
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      backgroundColor: '#2D6A4F',
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
};

export default config;
