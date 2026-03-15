/**
 * Cache Safety Manager
 * Handles cache versioning, data migration, and safe updates
 * to prevent issues when users update the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../lib/queryClient';

// Current cache schema version - increment this when making breaking changes
const CACHE_SCHEMA_VERSION = '2.0.0';

// Keys that should persist across cache clears (critical user data)
const PERSISTENT_KEYS = [
    'auth_token',
    'user_data',
    'hasSeenOnboarding',
    'themePreference',
    'lastSeenVersion',
];

// Keys that should be cleared on schema mismatch (cached data)
const CLEARABLE_CACHE_KEYS = [
    'REACT_QUERY_OFFLINE_CACHE',
    'tanstack-query-cache',
];

/**
 * Check and perform cache migration on app start
 * Call this in App.js after providers are set up
 */
export const performCacheSafetyCheck = async () => {
    try {
        const storedVersion = await AsyncStorage.getItem('cacheSchemaVersion');

        if (storedVersion !== CACHE_SCHEMA_VERSION) {
            console.log(`📦 Cache version mismatch: ${storedVersion} → ${CACHE_SCHEMA_VERSION}`);
            await migrateCache(storedVersion);
            await AsyncStorage.setItem('cacheSchemaVersion', CACHE_SCHEMA_VERSION);
            console.log('✅ Cache migration complete');
            return { migrated: true, from: storedVersion, to: CACHE_SCHEMA_VERSION };
        }

        return { migrated: false };
    } catch (error) {
        console.error('❌ Cache safety check failed:', error);
        // On error, force clear cache to prevent crashes
        await forceClearCache();
        return { migrated: true, error: true };
    }
};

/**
 * Migrate cache between versions
 * Add specific migration logic for each version bump
 */
const migrateCache = async (fromVersion) => {
    console.log(`🔄 Migrating cache from version: ${fromVersion || 'none'}`);

    // Clear React Query cache (stale data)
    try {
        for (const key of CLEARABLE_CACHE_KEYS) {
            await AsyncStorage.removeItem(key);
        }

        // Clear in-memory cache if queryClient exists
        if (queryClient) {
            queryClient.clear();
        }
    } catch (e) {
        console.warn('Warning: Could not clear query cache', e);
    }

    // Version-specific migrations
    if (!fromVersion) {
        // First time setup - no migration needed
        console.log('📱 First time setup, no migration needed');
    } else if (fromVersion.startsWith('1.')) {
        // Migrating from v1.x to v2.x
        console.log('🔄 Migrating from v1.x...');
        // Clear old storage format keys
        const keysToRemove = [
            'old_attendance_cache',
            'subjects_cache_v1',
            'timetable_v1',
        ];
        for (const key of keysToRemove) {
            await AsyncStorage.removeItem(key);
        }
    }
    // Add more version migrations as needed
};

/**
 * Force clear all cache (emergency recovery)
 * Preserves only critical user data
 */
export const forceClearCache = async () => {
    console.log('🧹 Force clearing cache...');

    try {
        // Get all keys
        const allKeys = await AsyncStorage.getAllKeys();

        // Filter out persistent keys
        const keysToRemove = allKeys.filter(
            key => !PERSISTENT_KEYS.includes(key)
        );

        // Remove all non-persistent keys
        if (keysToRemove.length > 0) {
            await AsyncStorage.multiRemove(keysToRemove);
        }

        // Clear React Query cache
        if (queryClient) {
            queryClient.clear();
        }

        console.log(`✅ Cleared ${keysToRemove.length} cached items`);
        return true;
    } catch (error) {
        console.error('❌ Force clear failed:', error);
        return false;
    }
};

/**
 * Validate cached data structure
 * Returns true if data is valid, false if corrupted
 */
export const validateCachedData = async (key, expectedShape) => {
    try {
        const data = await AsyncStorage.getItem(key);
        if (!data) return false;

        const parsed = JSON.parse(data);

        // Check if parsed data has expected properties
        if (typeof expectedShape === 'object') {
            for (const prop of Object.keys(expectedShape)) {
                if (!(prop in parsed)) {
                    console.warn(`⚠️ Cached data missing property: ${prop}`);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.warn(`⚠️ Invalid cached data for key: ${key}`);
        return false;
    }
};

/**
 * Safe JSON parse with fallback
 */
export const safeParseJSON = (jsonString, fallback = null) => {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn('⚠️ JSON parse failed, using fallback');
        return fallback;
    }
};

/**
 * Get storage stats for debugging
 */
export const getStorageStats = async () => {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const stats = {
            totalKeys: allKeys.length,
            persistentKeys: allKeys.filter(k => PERSISTENT_KEYS.includes(k)).length,
            cacheKeys: allKeys.filter(k => !PERSISTENT_KEYS.includes(k)).length,
            cacheVersion: await AsyncStorage.getItem('cacheSchemaVersion'),
        };
        return stats;
    } catch (e) {
        return { error: e.message };
    }
};

export default {
    performCacheSafetyCheck,
    forceClearCache,
    validateCachedData,
    safeParseJSON,
    getStorageStats,
    CACHE_SCHEMA_VERSION,
};
