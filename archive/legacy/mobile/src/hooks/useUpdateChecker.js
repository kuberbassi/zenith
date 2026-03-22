import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';

const GITHUB_REPO = 'kuberbassi/acadhub';
const CURRENT_VERSION = require('../../package.json').version;

// Helper to compare semantic versions (returns true if v1 > v2)
const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        if (parts1[i] > parts2[i]) return true;
        if (parts1[i] < parts2[i]) return false;
    }
    return false; // versions are equal
};

const useUpdateChecker = () => {
    const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, up-to-date, downloading, error
    const [latestRelease, setLatestRelease] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const checkUpdate = useCallback(async (silent = false) => {
        if (!silent) setUpdateStatus('checking');
        try {
            console.log('🔍 Checking for updates...');
            const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
            const latest = response.data;
            const latestVersion = latest.tag_name.replace('v', '');

            // Proper semantic version comparison
            const isNewer = compareVersions(latestVersion, CURRENT_VERSION);

            if (isNewer) {
                console.log(`✨ New version available: v${latestVersion} (current: v${CURRENT_VERSION})`);
                setLatestRelease(latest);
                setUpdateStatus('available');
                return true;
            } else {
                console.log('✅ App is up to date');
                setUpdateStatus('up-to-date');
                if (!silent) {
                    setTimeout(() => setUpdateStatus('idle'), 3000);
                }
                return false;
            }
        } catch (error) {
            console.error("Update check failed", error);
            setUpdateStatus('error');
            if (!silent) {
                setTimeout(() => setUpdateStatus('idle'), 3000);
            }
            return false;
        }
    }, []);

    const downloadAndInstallUpdate = useCallback(async () => {
        if (!latestRelease) return;

        const apkAsset = latestRelease.assets.find(a => a.name.endsWith('.apk'));
        if (!apkAsset) {
            Alert.alert("Error", "No APK found in the latest release.");
            return;
        }

        setUpdateStatus('downloading');
        setDownloadProgress(0);

        try {
            // "Industry Standard" Path: Use Cache Directory (guaranteed to be writable)
            let cacheDir = FileSystem.cacheDirectory;

            if (!cacheDir) {
                throw new Error("Device storage not available.");
            }

            // Ensure directory exists (defensive)
            // Ensure directory exists (safe to call even if exists with intermediates: true)
            try {
                await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
            } catch (e) {
                // Ignore error if it exists (though intermediates: true handles it)
            }

            // Standardize path: remove trailing slash if present, then add one
            const safeDir = cacheDir.endsWith('/') ? cacheDir : `${cacheDir}/`;
            const downloadDest = `${safeDir}update.apk`; // Fixed name avoids filesystem encoding issues

            console.log('📡 Downloading to:', downloadDest);

            const downloadResumable = FileSystem.createDownloadResumable(
                apkAsset.browser_download_url,
                downloadDest,
                {
                    headers: { 'User-Agent': 'AcadHub-Mobile/1.0' } // Standard User-Agent
                },
                (progress) => {
                    const pct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
                    setDownloadProgress(pct);
                }
            );

            const result = await downloadResumable.downloadAsync();
            if (!result || !result.uri) {
                throw new Error("Download completed but returned no URI");
            }

            console.log('📦 APK Downloaded. Preparing to install...');

            // CONTENT URI RESOLUTION (Critical for Android 7+)
            let contentUri;
            try {
                contentUri = await FileSystem.getContentUriAsync(result.uri);
                console.log('🔗 Resolved Content URI:', contentUri);
            } catch (uriError) {
                console.warn('SAF Resolution failed, trying fallback:', uriError);
                contentUri = result.uri; // Fallback to raw path (works on some older OS)
            }

            // INSTALL INTENT with explicit flags (Industry Standard)
            await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
                data: contentUri,
                flags: 268435457, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
                type: 'application/vnd.android.package-archive' // Explicit MIME type
            });

            setUpdateStatus('idle');

        } catch (error) {
            console.error("❌ Update Error:", error);
            Alert.alert(
                "Update Failed",
                `System Error: ${error.message}\n\nPlease update manually from GitHub.`
            );
            setUpdateStatus('available');
        }
    }, [latestRelease]);

    return {
        updateStatus,
        latestRelease,
        downloadProgress,
        checkUpdate,
        downloadAndInstallUpdate,
        currentVersion: CURRENT_VERSION
    };
};

export default useUpdateChecker;
