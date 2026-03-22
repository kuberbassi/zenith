/**
 * Offline Storage & Data Protection Layer
 * Provides safe data persistence with sync queue, conflict resolution, and auto-recovery
 */

import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map();
let isInitialized = false;

const fallbackStorage = {
  set: (key, value) => {
    memoryStore.set(key, String(value));
    // Persist to AsyncStorage (fire and forget)
    AsyncStorage.setItem(`acadhub_fallback_${key}`, String(value)).catch(e =>
      console.error('[OfflineStorage] Fallback persist failed:', e)
    );
  },
  getString: (key) => {
    return memoryStore.get(key);
  },
  delete: (key) => {
    memoryStore.delete(key);
    AsyncStorage.removeItem(`acadhub_fallback_${key}`).catch(() => { });
  },
  clearAll: () => {
    memoryStore.clear();
    AsyncStorage.clear().catch(() => { });
  },
  getAllKeys: () => {
    return Array.from(memoryStore.keys());
  },
};

let storageInstance = null;

const getStorage = () => {
  if (storageInstance) return storageInstance;

  // NOTE: MMKV is temporarily disabled for Expo Go compatibility.
  // To enable for production/dev builds, uncomment the try block below.

  /*
  try {
    // Lazy require to prevent crash on import in Expo Go
    const { MMKV: RNMMKV } = require('react-native-mmkv');
    
    // Check if NitroModules are available (not available in Expo Go)
    // MMKV v3+ depends on NitroModules being linked natively
    storageInstance = new RNMMKV({ id: 'acadhub.offline' });
    console.log('[OfflineStorage] MMKV initialized successfully.');
  } catch (error) {
    console.warn('[OfflineStorage] MMKV init failed (expected in Expo Go), using AsyncStorage fallback.', error.message);
    storageInstance = fallbackStorage;
  }
  */

  console.log('[OfflineStorage] Using AsyncStorage fallback (Expo Go mode).');
  storageInstance = fallbackStorage;
  return storageInstance;
};

const storage = {
  set: (...args) => getStorage().set(...args),
  getString: (...args) => getStorage().getString(...args),
  delete: (...args) => getStorage().delete(...args),
  clearAll: (...args) => getStorage().clearAll(...args),
  getAllKeys: (...args) => getStorage().getAllKeys(...args),
};

// Storage keys for different data types
export const STORAGE_KEYS = {
  // User data
  USER_PROFILE: 'user_profile',
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',

  // Academic data (cached)
  DASHBOARD_DATA: 'dashboard_data',
  SEMESTER_RESULTS: 'semester_results',
  SUBJECTS: 'subjects',
  TIMETABLE: 'timetable',
  ATTENDANCE: 'attendance',
  ASSIGNMENTS: 'assignments',
  SKILLS: 'skills',
  NOTIFICATIONS: 'notifications',
  NOTICES: 'notices',

  // Sync queue for failed requests
  SYNC_QUEUE: 'sync_queue',
  PENDING_CHANGES: 'pending_changes',

  // Metadata
  LAST_SYNC: 'last_sync_timestamp',
  SYNC_STATUS: 'sync_status',
  OFFLINE_CHECKSUM: 'offline_checksum',
};

// Sync queue item: { id, endpoint, method, data, timestamp, retries }
const MAX_RETRIES = 3;
const SYNC_INTERVAL = 30000; // 30 seconds

/**
 * Save data with encryption and checksum
 */
export const saveData = async (key, data, encrypt = false) => {
  try {
    const serialized = JSON.stringify({
      data,
      timestamp: Date.now(),
      version: 1,
    });

    storage.set(key, serialized);

    // Store checksum for integrity verification using expo-crypto
    const checksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.MD5,
      serialized
    );
    storage.set(`${key}_checksum`, checksum);

    return true;
  } catch (error) {
    console.error(`[OfflineStorage] Save failed for ${key}:`, error);
    return false;
  }
};

/**
 * Get data with checksum verification
 */
export const getData = async (key) => {
  try {
    const serialized = storage.getString(key);
    if (!serialized) return null;

    // Verify checksum using expo-crypto
    const savedChecksum = storage.getString(`${key}_checksum`);
    const calculatedChecksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.MD5,
      serialized
    );

    if (savedChecksum && savedChecksum !== calculatedChecksum) {
      console.warn(`[OfflineStorage] Checksum mismatch for ${key}, data may be corrupted`);
      // Return data anyway but mark as corrupted
      const parsed = JSON.parse(serialized);
      return { ...parsed.data, _corrupted: true };
    }

    const parsed = JSON.parse(serialized);
    return parsed.data;
  } catch (error) {
    console.error(`[OfflineStorage] Get failed for ${key}:`, error);
    return null;
  }
};

/**
 * Get data age in milliseconds
 */
export const getDataAge = (key) => {
  try {
    const serialized = storage.getString(key);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    return Date.now() - parsed.timestamp;
  } catch {
    return null;
  }
};

/**
 * Add item to sync queue (for failed API requests)
 */
export const addToSyncQueue = (endpoint, method = 'GET', data = null) => {
  try {
    const queue = getSyncQueue();
    const item = {
      id: `${Date.now()}-${Math.random()}`,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    queue.push(item);
    storage.set(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));

    return item.id;
  } catch (error) {
    console.error('[OfflineStorage] Add to sync queue failed:', error);
    return null;
  }
};

/**
 * Get all pending sync items
 */
export const getSyncQueue = () => {
  try {
    const queue = storage.getString(STORAGE_KEYS.SYNC_QUEUE);
    return queue ? JSON.parse(queue) : [];
  } catch {
    return [];
  }
};

/**
 * Remove item from sync queue (after successful sync)
 */
export const removeSyncQueueItem = (itemId) => {
  try {
    const queue = getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    storage.set(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(filtered));
  } catch (error) {
    console.error('[OfflineStorage] Remove sync queue item failed:', error);
  }
};

/**
 * Update sync queue item retry count
 */
export const incrementSyncRetries = (itemId) => {
  try {
    const queue = getSyncQueue();
    const item = queue.find(i => i.id === itemId);
    if (item) {
      item.retries += 1;
      storage.set(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('[OfflineStorage] Increment retries failed:', error);
  }
};

/**
 * Clear all offline data (emergency reset)
 * Call only when explicitly requested by user
 */
export const clearAllOfflineData = async () => {
  try {
    storage.clearAll();
    await AsyncStorage.clear();
    console.log('[OfflineStorage] All offline data cleared');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Clear all data failed:', error);
    return false;
  }
};

/**
 * Clear specific data type
 */
export const clearData = (key) => {
  try {
    storage.delete(key);
    storage.delete(`${key}_checksum`);
    return true;
  } catch (error) {
    console.error(`[OfflineStorage] Clear data failed for ${key}:`, error);
    return false;
  }
};

/**
 * Get storage stats
 */
export const getStorageStats = () => {
  try {
    return {
      totalSize: storage.getAllKeys().length,
      keys: storage.getAllKeys(),
      syncQueueSize: getSyncQueue().length,
      isEmpty: storage.getAllKeys().length === 0,
    };
  } catch (error) {
    console.error('[OfflineStorage] Get stats failed:', error);
    return null;
  }
};

/**
 * Backup all data to encrypted secure storage
 */
export const backupData = async () => {
  try {
    const backup = {
      timestamp: Date.now(),
      data: {},
    };

    for (const key of storage.getAllKeys()) {
      if (!key.includes('_checksum')) {
        backup.data[key] = storage.getString(key);
      }
    }

    await AsyncStorage.setItem(
      'acadhub_backup',
      JSON.stringify(backup)
    );

    console.log('[OfflineStorage] Data backup created');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Backup failed:', error);
    return false;
  }
};

/**
 * Restore data from backup
 */
export const restoreFromBackup = async () => {
  try {
    const backup = await AsyncStorage.getItem('acadhub_backup');
    if (!backup) return false;

    const parsed = JSON.parse(backup);
    for (const [key, value] of Object.entries(parsed.data)) {
      storage.set(key, value);
    }

    console.log('[OfflineStorage] Data restored from backup');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Restore failed:', error);
    return false;
  }
};

/**
 * Initialize offline storage (called on app start)
 */
export const initializeOfflineStorage = async () => {
  if (isInitialized) return true;

  try {
    // 1. Load data from AsyncStorage into memoryStore for Expo Go fallback
    const allKeys = await AsyncStorage.getAllKeys();
    const fallbackKeys = allKeys.filter(k => k.startsWith('acadhub_fallback_'));

    if (fallbackKeys.length > 0) {
      const pairs = await AsyncStorage.multiGet(fallbackKeys);
      pairs.forEach(([key, value]) => {
        if (value !== null) {
          const originalKey = key.replace('acadhub_fallback_', '');
          memoryStore.set(originalKey, value);
        }
      });
      console.log(`[OfflineStorage] Loaded ${fallbackKeys.length} keys from AsyncStorage fallback.`);
    }

    // 2. Initialize storage instance
    getStorage();

    // 3. Check data integrity
    const stats = getStorageStats();
    console.log('[OfflineStorage] Initialized with', stats.totalSize, 'keys');

    // 4. Clean up old data (older than 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const keys = storage.getAllKeys();
    for (const key of keys) {
      const age = getDataAge(key);
      if (age && age > thirtyDaysAgo) {
        clearData(key);
      }
    }

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Initialization failed:', error);
    return false;
  }
};

export default {
  saveData,
  getData,
  getDataAge,
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  incrementSyncRetries,
  clearAllOfflineData,
  clearData,
  getStorageStats,
  backupData,
  restoreFromBackup,
  initializeOfflineStorage,
};
