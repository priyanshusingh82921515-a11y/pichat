// Ready-to-use Capacitor configuration for packaging Quadline as a native Android APK / AAB.
// Usage on your machine:
//   npm install @capacitor/core @capacitor/cli @capacitor/android
//   npm run build
//   npx cap add android
//   npx cap sync android
//   npx cap open android

const capacitorConfig = {
  appId: 'app.quadline.chat',
  appName: 'Quadline',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Point to your live hosted Quadline server so WebSockets, Calls, and Media Uploads work natively inside the APK:
    url: process.env.QUADLINE_ANDROID_SERVER_URL || undefined,
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0D1117',
  },
};

export default capacitorConfig;
