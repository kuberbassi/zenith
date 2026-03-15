import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
    DASHBOARD: 'CACHE_DASHBOARD',
    TIMETABLE: 'CACHE_TIMETABLE',
    PENDING_ACTIONS: 'PENDING_ACTIONS',
    LAST_SYNC: 'LAST_SYNC_TIMESTAMP'
};

class OfflineService {

    // --- Connectivity Helper ---
    async isOnline() {
        const state = await NetInfo.fetch();
        return state.isConnected && state.isInternetReachable;
    }

    // --- Caching Strategy ---

    // Save data to cache with timestamp
    async saveToCache(key, data) {
        try {
            const payload = {
                timestamp: Date.now(),
                data: data
            };
            await AsyncStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.error('Cache Save Error:', error);
        }
    }

    // Get data from cache
    async getFromCache(key) {
        try {
            const stored = await AsyncStorage.getItem(key);
            if (!stored) return null;
            return JSON.parse(stored).data;
        } catch (error) {
            console.error('Cache Read Error:', error);
            return null;
        }
    }

    // Hybrid Fetch: Network First, Fallback to Cache
    // integrityCheck: boolean - if true, checks versioning (not fully implemented here but placeholder)
    async fetchWithCache(key, networkPromise) {
        const online = await this.isOnline();

        if (online) {
            try {
                const response = await networkPromise();
                // If successful, update cache
                // Note: response.data assumed
                this.saveToCache(key, response.data);
                return { data: response.data, source: 'network' };
            } catch (error) {
                console.log('Network failed, falling back to cache...', error.message);
                // Fallback below
            }
        }

        // Offline or Network Fail
        const cachedData = await this.getFromCache(key);
        if (cachedData) {
            return { data: cachedData, source: 'cache' };
        }

        // No cache and offline/fail
        throw new Error('No internet and no saved data.');
    }

    // --- Action Queueing (Mutation Protection) ---

    // Queue an action (like mark attendance) to be run later
    async queueAction(actionType, payload) {
        try {
            const queueStr = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
            const queue = queueStr ? JSON.parse(queueStr) : [];

            const newAction = {
                id: Date.now().toString(),
                type: actionType,
                payload: payload, // { subject_id, status, date }
                timestamp: Date.now()
            };

            queue.push(newAction);
            await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(queue));
            return true;
        } catch (e) {
            console.error("Queue Action Error", e);
            return false;
        }
    }

    // Process the queue
    async syncPendingActions(apiClient) {
        const queueStr = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
        if (!queueStr) return;

        const queue = JSON.parse(queueStr);
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} offline actions...`);
        const online = await this.isOnline();
        if (!online) return;

        const remainingQueue = [];

        for (const action of queue) {
            try {
                // Determine API Call based on action type
                // We use the passed 'apiClient' to handle headers/auth
                if (action.type === 'MARK_ATTENDANCE') {
                    await apiClient.post('/api/attendance/mark', action.payload);
                } else if (action.type === 'UPDATE_PROFILE') {
                    await apiClient.put('/api/profile', action.payload);
                }
                // Success: item removed (not added to remaining)
            } catch (error) {
                console.error(`Sync Failed for action ${action.id}`, error);
                // Keep in queue if it's a network error? 
                // If it's a logic error (400), we probably should discard or log it to avoid loop.
                // Robustness: If status 500 or Network Error, keep it.
                // If 400/404, valid request but bad data -> Discard to avoid loop.
                if (!error.response || error.response.status >= 500) {
                    remainingQueue.push(action);
                }
            }
        }

        await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(remainingQueue));
    }
}

export const offlineService = new OfflineService();
export const KEYS = CACHE_KEYS;
