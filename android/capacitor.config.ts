import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 项目根目录为 android/，web 资源指向 pwa 前端构建产物。
// 详见 android/docs/android-architecture.md。
const config: CapacitorConfig = {
  appId: 'com.vibefit.app',
  appName: 'VibeFit',
  webDir: '../pwa/frontend/dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#1976d2',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#1976d2',
    },
  },
};

export default config;
