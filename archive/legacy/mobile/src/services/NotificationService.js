import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_STORAGE_KEY = 'NOTIFIED_SUBJECTS_LOG';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const NotificationService = {

    async registerForPushNotificationsAsync() {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            try {
                if (Constants.appOwnership === 'expo') {
                    return null;
                }
                const token = (await Notifications.getExpoPushTokenAsync({
                    projectId: Constants.expoConfig?.extra?.eas?.projectId
                })).data;
                return token;
            } catch (error) {
                console.log('Push token registration skipped/failed:', error.message);
                return null;
            }
        } else {
            console.log('Must use physical device for Push Notifications');
            return null;
        }
    },

    async scheduleLocalNotification(title, body) {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: true,
            },
            trigger: null,
        });
    },

    // Single consolidated notification — no spam
    async checkAndNotify(subjects, threshold = 75) {
        if (!subjects || subjects.length === 0) return;

        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const logStr = await AsyncStorage.getItem(NOTIF_STORAGE_KEY);
            let log = logStr ? JSON.parse(logStr) : {};

            // Already sent today's summary — skip
            if (log.date === todayStr && log.sent) return;

            // Collect all subjects below threshold
            const lowSubjects = subjects.filter(s => {
                const pct = s.attendance_percentage;
                const msg = (s.status_message || '').toLowerCase();
                return pct < threshold && msg.includes('attend');
            });

            if (lowSubjects.length === 0) return;

            // Build one compact summary
            // e.g. "Math 62% · Physics 71% · DSA 68%"
            const summary = lowSubjects
                .map(s => {
                    const name = (s.name || 'Subject').length > 12
                        ? (s.name || 'Subject').substring(0, 12).trim() + '…'
                        : (s.name || 'Subject');
                    return `${name} ${Math.round(s.attendance_percentage)}%`;
                })
                .join(' · ');

            const title = `📉 ${lowSubjects.length} subject${lowSubjects.length > 1 ? 's' : ''} below ${threshold}%`;

            await this.scheduleLocalNotification(title, summary);

            // Mark as sent for today
            await AsyncStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify({
                date: todayStr,
                sent: true,
            }));

        } catch (e) {
            console.error("Notification Check Error", e);
        }
    }
};
