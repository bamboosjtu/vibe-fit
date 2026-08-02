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
      // 与 res/values/colors.xml 的 colorPrimary 保持一致
      backgroundColor: '#05A978',
      showSpinner: false,
    },
    LocalNotifications: {
      // 使用现有的 ic_launcher 资源作为状态栏小图标
      // （颜色由系统着色为白色，建议后续提供专门的白色透明图标）
      smallIcon: 'ic_launcher',
      iconColor: '#05A978',
    },
  },
};

export default config;
