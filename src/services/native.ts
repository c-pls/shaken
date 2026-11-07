import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Configures the native mobile status bar to match Hagane's light theme.
 */
export const initNativeStatusBar = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.debug('StatusBar configuration not supported', err);
  }
};
