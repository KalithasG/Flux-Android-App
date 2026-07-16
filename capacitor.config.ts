import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.flux.app',
  appName: 'Flux',
  webDir: 'dist',
  backgroundColor: '#FFFFFF',
  // Edge-to-edge/safe-area is handled by Capacitor 8's built-in SystemBars:
  // with viewport-fit=cover (index.html) the WebView receives real
  // env(safe-area-inset-*) values, which the app's CSS already consumes.
  plugins: {
    SplashScreen: {
      // App.tsx hides the native splash itself, handing off to the in-app
      // animated splash without a white flash.
      launchAutoHide: false,
      backgroundColor: '#FFFFFF',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false
    },
    Keyboard: {
      // 'none' matches mobile-web behavior: the keyboard overlays the viewport
      // instead of resizing the WebView (which made bottom sheets jump).
      // Bottom-anchored UI lifts itself via the --keyboard-height CSS var.
      resize: KeyboardResize.None
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com']
    }
  }
};

export default config;
