import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
    setItem: async (key, value) => {
        try {
            await AsyncStorage.setItem(key, value);
            return true;
        } catch (e) {
            return false;
        }
    },
    getItem: async (key) => {
        try {
            return await AsyncStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    removeItem: async (key) => {
        try {
            await AsyncStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },
    // Sync-like getters for legacy compatibility if needed, 
    // but AsyncStorage is fundamentally async.
    getString: (key) => {
        console.warn('Sync getString called on AsyncStorage wrapper - this will not work as expected');
        return null;
    }
};

export const mmkvStorage = storage; // Alias for minimal refactoring elsewhere
