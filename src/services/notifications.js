import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Show alerts as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Stock alerts',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  } catch {
    return false;
  }
}

/** Free, on-device notification. Used in demo mode to show what a push looks like. */
export async function showLocalAlertNotification(alert) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${alert.ticker} · ${alert.kind === 'opportunity' ? 'Opportunity' : 'Threat'}`,
        body: alert.headline,
        data: { alertId: alert.id },
      },
      trigger: null, // now
    });
  } catch {
    // Notifications are a bonus; the alert is already in the feed.
  }
}

/**
 * Expo push token for server-sent pushes (live mode). Returns null when it
 * can't work: simulators, Expo Go on Android, or no EAS project configured yet.
 */
export async function getExpoPushToken() {
  try {
    if (!Device.isDevice) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
