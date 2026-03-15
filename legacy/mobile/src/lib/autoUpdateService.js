/**
 * In-App Auto-Update Service
 * Checks GitHub releases for new APK and installs updates in-app
 * No need to go to Play Store - just tap "Update" and restart
 */

import * as Updates from 'expo-updates';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import axios from 'axios';
import { saveData, getData } from './offlineStorage';

const GITHUB_REPO = 'kuberbassi/acadhub';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

class AutoUpdateService {
  constructor() {
    this.updateCheckInterval = 3600000; // Check every hour
    this.isChecking = false;
    this.updateAvailable = false;
  }

  /**
   * Check for updates on GitHub
   */
  async checkForUpdates() {
    if (this.isChecking) return;
    
    this.isChecking = true;
    try {
      console.log('[AutoUpdate] Checking for updates...');
      
      const response = await axios.get(GITHUB_API, {
        timeout: 5000,
      });

      const latestRelease = response.data;
      const latestVersion = latestRelease.tag_name.replace('v', '');
      const currentVersion = require('../../package.json').version;

      // Compare versions
      if (this.isNewerVersion(latestVersion, currentVersion)) {
        console.log(`[AutoUpdate] New version available: ${latestVersion}`);
        
        // Find APK download URL
        const apkAsset = latestRelease.assets.find(
          (asset) => asset.name.endsWith('.apk')
        );

        if (apkAsset) {
          this.updateAvailable = true;
          saveData('update_info', {
            version: latestVersion,
            downloadUrl: apkAsset.browser_download_url,
            releaseNotes: latestRelease.body,
            downloadedAt: null,
            filePath: null,
          });
          
          return {
            available: true,
            version: latestVersion,
            releaseNotes: latestRelease.body,
          };
        }
      }

      this.isChecking = false;
      return { available: false };
    } catch (error) {
      console.error('[AutoUpdate] Check failed:', error.message);
      this.isChecking = false;
      return { available: false, error: error.message };
    }
  }

  /**
   * Download APK
   */
  async downloadUpdate() {
    try {
      const updateInfo = getData('update_info');
      if (!updateInfo || !updateInfo.downloadUrl) {
        throw new Error('No update info available');
      }

      console.log('[AutoUpdate] Downloading APK...');

      const downloadPath = `${FileSystem.documentDirectory}acadhub-update.apk`;
      const { uri } = await FileSystem.downloadAsync(
        updateInfo.downloadUrl,
        downloadPath,
        {
          progressInterval: 1000,
        }
      );

      // Update saved info with downloaded path
      saveData('update_info', {
        ...updateInfo,
        filePath: uri,
        downloadedAt: Date.now(),
      });

      console.log('[AutoUpdate] Download complete:', uri);
      return uri;
    } catch (error) {
      console.error('[AutoUpdate] Download failed:', error.message);
      throw error;
    }
  }

  /**
   * Install downloaded APK
   */
  async installUpdate() {
    try {
      const updateInfo = getData('update_info');
      if (!updateInfo || !updateInfo.filePath) {
        throw new Error('APK not downloaded yet');
      }

      console.log('[AutoUpdate] Installing APK...');

      // Use Intent Launcher to open the APK with package installer
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ACTION_VIEW,
        {
          data: updateInfo.filePath,
          flags: 268435456, // FLAG_ACTIVITY_NEW_TASK
          type: 'application/vnd.android.package-archive',
        }
      );

      return true;
    } catch (error) {
      console.error('[AutoUpdate] Install failed:', error.message);
      throw error;
    }
  }

  /**
   * Complete update process (download + install)
   */
  async applyUpdate() {
    try {
      const filePath = await this.downloadUpdate();
      await this.installUpdate();
      return true;
    } catch (error) {
      console.error('[AutoUpdate] Apply update failed:', error.message);
      throw error;
    }
  }

  /**
   * Compare version strings (v1.0.0 vs 1.0.1)
   */
  isNewerVersion(newVersion, currentVersion) {
    const parse = (v) => v.split('.').map(Number);
    const [newMajor, newMinor, newPatch] = parse(newVersion);
    const [curMajor, curMinor, curPatch] = parse(currentVersion);

    if (newMajor > curMajor) return true;
    if (newMajor === curMajor && newMinor > curMinor) return true;
    if (newMajor === curMajor && newMinor === curMinor && newPatch > curPatch) return true;

    return false;
  }

  /**
   * Get current update status
   */
  getUpdateStatus() {
    const updateInfo = getData('update_info');
    return {
      updateAvailable: this.updateAvailable,
      updateInfo,
      isChecking: this.isChecking,
    };
  }

  /**
   * Clear update info
   */
  clearUpdateInfo() {
    saveData('update_info', null);
    this.updateAvailable = false;
  }

  /**
   * Setup auto-check on app start
   */
  setupAutoCheck() {
    console.log('[AutoUpdate] Auto-check enabled');
    
    // Check on startup
    this.checkForUpdates().catch(console.error);

    // Check periodically
    setInterval(() => {
      this.checkForUpdates().catch(console.error);
    }, this.updateCheckInterval);
  }
}

export const autoUpdateService = new AutoUpdateService();
export default autoUpdateService;
