import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, Switch,
    ScrollView, TextInput, Alert, ActivityIndicator, Animated, RefreshControl, Modal
} from 'react-native';
import { theme, Layout as AppLayout } from '../theme';
import PressableScale from '../components/PressableScale';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LogOut, User, Bell, ChevronRight, Edit2,
    Download, Upload, Trash2, FileText, AlertTriangle, Camera,
    RefreshCw, CheckCircle2, ArrowDownCircle, HelpCircle, X
} from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import { attendanceService } from '../services';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AnimatedHeader from '../components/AnimatedHeader';
import { useUpdate } from '../contexts/UpdateContext';
import { useSemester } from '../contexts/SemesterContext';
import UserAvatar from '../components/UserAvatar';
import * as Haptics from 'expo-haptics';


const SettingsScreen = ({ navigation }) => {
    // ... partial replacement around specific areas ...
    // Wait, I should do a full replace or targeted chunks.
    // Targeted chunks are safer for large files.

    // 1. Update imports and hook usage
    const { user, logout, updateUser } = useAuth();
    const { isDark, toggleTheme, colors: themeColors, updateAccent, accentColor } = useTheme();
    const { selectedSemester, updateSemester } = useSemester();
    const insets = useSafeAreaInsets();

    const c = {
        ...themeColors,
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',
        glassBgStart: isDark ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)',
        glassBgEnd: isDark ? 'rgba(30,31,34,0.85)' : 'rgba(255,255,255,0.85)',
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',
        primary: themeColors.primary, // FIX: Use dynamic theme color
        danger: theme.palette.red,
        success: theme.palette.green,
        inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    };

    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    // ... state ...
    const [editingProfile, setEditingProfile] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [profileData, setProfileData] = useState({
        name: user?.name || '',
        course: user?.course || user?.branch || '',
        semester: user?.semester ? String(user.semester) : '',
        batch: user?.batch || '',
        email: user?.email || '',
        college: user?.college || '',
        phone_number: user?.phone_number || '',
        headline: user?.headline || '',
        linkedin_url: user?.linkedin_url || '',
        github_url: user?.github_url || '',
        portfolio_url: user?.portfolio_url || '',
    });

    const [minAttendance, setMinAttendance] = useState(user?.attendance_threshold ? String(user.attendance_threshold) : '75');
    const [warningThreshold, setWarningThreshold] = useState(user?.warning_threshold ? String(user.warning_threshold) : '76');
    const [attendanceThreshold, setAttendanceThreshold] = useState('75'); // Legacy state, can be merged
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [showHowToUse, setShowHowToUse] = useState(false);

    const { updateStatus, latestRelease, downloadProgress, checkUpdate, downloadAndInstallUpdate, currentVersion } = useUpdate();

    useEffect(() => {
        if (user) {
            setProfileData(prev => ({
                ...prev,
                name: user.name || prev.name,
                email: user.email || prev.email,
                course: user.course || user.branch || prev.course,
                semester: user.semester || user.current_semester ? String(user.semester || user.current_semester) : prev.semester,
                batch: user.batch || prev.batch,
                college: user.college || prev.college,
                phone_number: user.phone_number || prev.phone_number,
                headline: user.headline || prev.headline,
                linkedin_url: user.linkedin_url || prev.linkedin_url,
                github_url: user.github_url || prev.github_url,
                portfolio_url: user.portfolio_url || prev.portfolio_url,
            }));

            // Sync preferences from user context
            if (user.attendance_threshold) setMinAttendance(String(user.attendance_threshold));
            if (user.warning_threshold) setWarningThreshold(String(user.warning_threshold));
        }
    }, [user]);

    // Fetch profile and preferences separately (matching web)
    const loadPrefs = async () => {
        try {
            // We need to import api temporarily for profile endpoint
            const api = require('../services/api').default;

            // 1. Load user profile (name, email, course, batch, college, etc)
            const profileResponse = await api.get('/api/profile');
            // API wraps response in { success: true, data: {...} }
            if (profileResponse.data?.success && profileResponse.data?.data) {
                const data = profileResponse.data.data;
                console.log('📥 Profile loaded:', { email: data.email, semester: data.semester, attendance_threshold: data.attendance_threshold });

                setProfileData(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    email: data.email || prev.email,
                    course: data.course || data.branch || prev.course,
                    batch: data.batch || prev.batch,
                    college: data.college || prev.college,
                    semester: data.semester ? String(data.semester) : prev.semester,
                    phone_number: data.phone_number || prev.phone_number,
                    headline: data.headline || prev.headline,
                    linkedin_url: data.linkedin_url || prev.linkedin_url,
                    github_url: data.github_url || prev.github_url,
                    portfolio_url: data.portfolio_url || prev.portfolio_url,
                }));

                // Set attendance thresholds from profile
                if (data.attendance_threshold) {
                    setMinAttendance(String(data.attendance_threshold));
                    console.log('✅ Min attendance set to:', data.attendance_threshold);
                }
                if (data.warning_threshold) {
                    setWarningThreshold(String(data.warning_threshold));
                    console.log('✅ Warning threshold set to:', data.warning_threshold);
                }

                // 2. Also load preferences endpoint for additional settings
                try {
                    const prefsResponse = await attendanceService.getPreferences();
                    if (prefsResponse) {
                        console.log('📥 Preferences loaded:', prefsResponse);
                        if (prefsResponse.attendance_threshold) {
                            setMinAttendance(String(prefsResponse.attendance_threshold));
                        }
                        if (prefsResponse.warning_threshold) {
                            setWarningThreshold(String(prefsResponse.warning_threshold));
                        }
                    }
                } catch (prefError) {
                    console.log('⚠️ Preferences endpoint not available, using profile data');
                }

                // CRITICAL FIX: Update global context with fetched picture so Avatar refreshes
                // Backend sends 'picture', not 'profile_pic_url'
                // ALSO Update other fields (Name, Course, etc.) so Header syncs with Desktop changes
                const updatedUser = {
                    ...user,
                    name: data.name || user.name,
                    email: data.email || user.email,
                    course: data.course || data.branch || user.course,
                    branch: data.branch || data.course || user.branch,
                    batch: data.batch || user.batch,
                    college: data.college || user.college,
                    semester: data.semester,
                    phone_number: data.phone_number || user.phone_number,
                    headline: data.headline || user.headline,
                    linkedin_url: data.linkedin_url || user.linkedin_url,
                    github_url: data.github_url || user.github_url,
                    portfolio_url: data.portfolio_url || user.portfolio_url,
                    attendance_threshold: data.attendance_threshold,
                    warning_threshold: data.warning_threshold,
                };

                if (data.picture) {
                    updatedUser.picture = data.picture;
                }

                updateUser(updatedUser);
            }
        } catch (e) {
            console.error('❌ Error loading profile/preferences:', e.message);
        }
    };

    useEffect(() => { loadPrefs(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await loadPrefs(); // Reload all preferences
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshing(false);
        }
    };

    // ... Actions (Keep as is) ...
    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            const updatedSemester = Number(profileData.semester);
            const attThreshold = parseInt(minAttendance);
            const warnThreshold = parseInt(warningThreshold);

            const dataToSave = {
                ...profileData,
                semester: updatedSemester, // Ensure it's passed as number
                attendance_threshold: attThreshold,
                warning_threshold: warnThreshold
            };

            console.log('💾 Saving profile and preferences:', {
                name: dataToSave.name,
                phone: dataToSave.phone_number,
                attendance_threshold: attThreshold
            });

            // Update Backend via Service
            await attendanceService.updateProfile(dataToSave);

            // Also update preferences endpoint for proper sync
            try {
                await attendanceService.updatePreferences({
                    attendance_threshold: attThreshold,
                    warning_threshold: warnThreshold
                });
                console.log('✅ Preferences saved successfully');
            } catch (prefError) {
                console.log('⚠️ Preferences update skipped (endpoint may not exist)');
            }

            // Update global semester context
            if (updateSemester) await updateSemester(updatedSemester);

            // Update Local Auth Context with fresh data from server to be safe
            try {
                const freshProfile = await attendanceService.getProfile();
                if (freshProfile && freshProfile.data) {
                    const data = freshProfile.data;
                    updateUser({
                        ...user,
                        ...data,
                        // Ensure semester stays synced
                        semester: data.semester || data.current_semester || updatedSemester
                    });
                } else {
                    // Fallback to local data
                    updateUser({ ...user, ...dataToSave });
                }
            } catch (err) {
                updateUser({ ...user, ...dataToSave });
            }

            setEditingProfile(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("✓ Success", "Profile and settings updated successfully.");
        } catch (error) {
            console.error('❌ Save profile error:', error.message);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    const handleExportData = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setLoading(true);
            const data = await attendanceService.exportData();
            const dataToSave = JSON.stringify(data, null, 2);
            const fileUri = FileSystem.cacheDirectory + 'acadhub_backup.json';
            await FileSystem.writeAsStringAsync(fileUri, dataToSave);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert("Saved", "Backup saved to " + fileUri);
            }
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Export failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleImportData = async () => {
        // Show warning about existing data BEFORE file picker
        Alert.alert(
            "⚠️ Import Warning",
            "Importing data will REPLACE all your current subjects, attendance logs, and settings.\n\n💡 If you want to keep your existing data, export a backup first.\n\n🗑️ For a clean import, consider using 'Delete All Data' before importing.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "I Understand, Continue",
                    onPress: async () => {
                        try {
                            const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
                            if (result.canceled) return;
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setLoading(true);
                            const fileUri = result.assets[0].uri;
                            const fileContent = await FileSystem.readAsStringAsync(fileUri);
                            await attendanceService.importData(JSON.parse(fileContent));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert("✓ Success", "Data imported successfully! Refreshing...", [{
                                text: "OK",
                                onPress: () => loadPrefs() // Refresh to show new data
                            }]);
                        } catch (error) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert("Error", "Import failed. Please check the file format.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // handleDeleteAllData removed

    const handleUploadPFP = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'image/*',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            setLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const file = result.assets[0];

            // Create form data matching backend expectations
            const formData = new FormData();
            formData.append('file', {
                uri: file.uri,
                name: file.name || 'profile.jpg',
                type: file.mimeType || 'image/jpeg'
            });

            // Use direct Axios call with explicit multipart header
            const api = require('../services/api').default;

            const response = await api.post('/api/profile/upload_pfp', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                transformRequest: (data, headers) => {
                    return formData;
                }
            });

            if (response?.data?.url) {
                // Update user context with new picture
                await updateUser({ ...user, picture: response.data.url });

                // Also refresh profile data to ensure sync
                await loadPrefs();

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("✓ Success", "Profile picture updated successfully!");
            } else {
                throw new Error("No URL returned from server");
            }
        } catch (error) {
            console.error("Upload Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            if (error.response) {
                console.error("Server Response:", error.response.status, error.response.data);
                Alert.alert("Upload Failed", `Server error: ${error.response.status}`);
            } else if (error.request) {
                console.error("No Response:", error.request);
                Alert.alert("Network Error", "Could not reach server.");
            } else {
                Alert.alert("Error", error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Standardized Animations
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [AppLayout.header.maxHeight, AppLayout.header.minHeight],
        extrapolate: 'clamp'
    });



    const titleSize = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [AppLayout.header.maxTitleSize, AppLayout.header.minTitleSize],
        extrapolate: 'clamp'
    });

    // Subtitle fade
    const subOpacity = scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });

    return (
        <View style={{ flex: 1 }}>
            {/* BACKGROUND */}
            <LinearGradient
                colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]}
                noTexture style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* UNIVERSAL ANIMATED HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Settings"
                subtitle="Preferences & Account"
                isDark={isDark}
                colors={c}
            />

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.text}
                        colors={[isDark ? theme.palette.purple : theme.light.primary]}
                        progressBackgroundColor={isDark ? '#121212' : '#FFFFFF'}
                        progressViewOffset={AppLayout.header.minHeight + insets.top + 15}
                    />
                }
            >
                <View style={{ height: 140 }} />

                {/* NEW HERO PROFILE CARD */}
                {/* NEW HERO PROFILE CARD */}
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                    <PressableScale onPress={handleUploadPFP} style={{ position: 'relative', marginBottom: 16 }}>
                        <UserAvatar user={user} size={100} colors={c} style={styles.heroAvatar} />
                        <View style={styles.editBadge}>
                            <Camera size={14} color="#FFF" />
                        </View>
                    </PressableScale>
                    <Text style={styles.heroName}>{user?.name || 'Student'}</Text>
                    <Text style={styles.heroEmail}>{user?.email}</Text>
                </View>

                {/* PROFILE CARD */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Profile Details</Text>
                        <PressableScale onPress={() => editingProfile ? handleSaveProfile() : setEditingProfile(true)}>
                            {editingProfile ? <Text style={{ color: c.primary, fontWeight: '700' }}>Save</Text> : <Edit2 size={20} color={c.primary} />}
                        </PressableScale>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={[styles.input, editingProfile && styles.inputActive]}
                            value={profileData.name}
                            onChangeText={t => setProfileData({ ...profileData, name: t })}
                            editable={editingProfile}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Course</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.course}
                                onChangeText={t => setProfileData({ ...profileData, course: t })}
                                editable={editingProfile}
                            />
                        </View>
                        <View style={{ width: 80 }}>
                            <Text style={styles.label}>Sem</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.semester}
                                keyboardType='numeric'
                                onChangeText={t => setProfileData({ ...profileData, semester: t })}
                                editable={editingProfile}
                            />
                        </View>
                    </View>

                    {/* BATCH & COLLEGE (Added to match Web App) */}
                    <View style={[styles.row, { marginTop: 16 }]}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Batch</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.batch}
                                onChangeText={t => setProfileData({ ...profileData, batch: t })}
                                editable={editingProfile}
                                placeholder="2025-29"
                                placeholderTextColor={c.subtext}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>College</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.college}
                                onChangeText={t => setProfileData({ ...profileData, college: t })}
                                editable={editingProfile}
                                placeholder="HMRITM"
                                placeholderTextColor={c.subtext}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Headline</Text>
                        <TextInput
                            style={[styles.input, editingProfile && styles.inputActive]}
                            value={profileData.headline}
                            onChangeText={t => setProfileData({ ...profileData, headline: t })}
                            editable={editingProfile}
                            placeholder="Student / Developer / Explorer"
                            placeholderTextColor={c.subtext}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <TextInput
                            style={[styles.input, editingProfile && styles.inputActive]}
                            value={profileData.phone_number}
                            onChangeText={t => setProfileData({ ...profileData, phone_number: t })}
                            editable={editingProfile}
                            placeholder="+91 0000000000"
                            placeholderTextColor={c.subtext}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>LinkedIn</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.linkedin_url}
                                onChangeText={t => setProfileData({ ...profileData, linkedin_url: t })}
                                editable={editingProfile}
                                placeholder="linkedin.com/in/..."
                                placeholderTextColor={c.subtext}
                                autoCapitalize="none"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>GitHub</Text>
                            <TextInput
                                style={[styles.input, editingProfile && styles.inputActive]}
                                value={profileData.github_url}
                                onChangeText={t => setProfileData({ ...profileData, github_url: t })}
                                editable={editingProfile}
                                placeholder="github.com/..."
                                placeholderTextColor={c.subtext}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Text style={styles.label}>Portfolio / Website</Text>
                        <TextInput
                            style={[styles.input, editingProfile && styles.inputActive]}
                            value={profileData.portfolio_url}
                            onChangeText={t => setProfileData({ ...profileData, portfolio_url: t })}
                            editable={editingProfile}
                            placeholder="https://..."
                            placeholderTextColor={c.subtext}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={{ marginTop: 16 }}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={[styles.input, { opacity: 0.6 }]}
                            value={profileData.email}
                            editable={false}
                        />
                    </View>

                </LinearGradient >

                {/* PREFERENCES */}
                < LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card} >
                    <Text style={styles.sectionTitle}>Preferences</Text>

                    <View style={[styles.row, { alignItems: 'center', marginBottom: 16 }]}>
                        <View>
                            <Text style={styles.settingLabel}>Dark Mode</Text>
                            <Text style={styles.settingSub}>{isDark ? 'Dark Theme' : 'Light Theme'}</Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                toggleTheme();
                            }}
                            trackColor={{ false: '#767577', true: c.primary }}
                            thumbColor={'#f4f3f4'}
                        />
                    </View>

                    <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 12, marginBottom: 16 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={[styles.iconBox, { backgroundColor: c.text + '10' }]}>
                                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: accentColor }} />
                            </View>
                            <Text style={styles.settingLabel}>Accent Color</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingLeft: 44 }}>
                            {[theme.palette.purple, theme.palette.blue, theme.palette.magenta, theme.palette.orange, theme.palette.green, theme.palette.red].map((color, i) => (
                                <PressableScale
                                    key={i}
                                    onPress={() => {
                                        if (accentColor !== color) Haptics.selectionAsync();
                                        updateAccent(color);
                                    }}
                                    style={{ padding: 4, borderWidth: 2, borderColor: accentColor === color ? c.text : 'transparent', borderRadius: 20 }}
                                >
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color }} />
                                </PressableScale>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={[styles.row, { marginTop: 16 }]}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={styles.label}>Min Attendance %</Text>
                            <TextInput
                                style={styles.input}
                                value={minAttendance}
                                onChangeText={setMinAttendance}
                                keyboardType='numeric'
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Warning %</Text>
                            <TextInput
                                style={styles.input}
                                value={warningThreshold}
                                onChangeText={setWarningThreshold}
                                keyboardType='numeric'
                            />
                        </View>
                    </View>

                    <PressableScale
                        onPress={handleSaveProfile}
                        hapticStyle="medium"
                    >
                        <LinearGradient colors={c.gradients.primary} style={styles.updateBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Update Preferences</Text>
                        </LinearGradient>
                    </PressableScale>
                </LinearGradient>

                {/* SYSTEM & UPDATES */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <Text style={styles.sectionTitle}>System</Text>

                    {/* Update Checker */}
                    <View style={styles.updateCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 }}>
                            <View style={[styles.iconBox, { backgroundColor: c.primary + '15' }]}>
                                <RefreshCw size={18} color={c.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>App Version</Text>
                                <Text style={styles.settingSub}>Current: v{currentVersion}</Text>
                            </View>
                            {updateStatus === 'idle' && (
                                <TouchableOpacity onPress={checkUpdate} style={styles.checkBtn}>
                                    <Text style={styles.checkBtnText}>Check Update</Text>
                                </TouchableOpacity>
                            )}
                            {updateStatus === 'checking' && <ActivityIndicator size="small" color={c.primary} />}
                            {updateStatus === 'up-to-date' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle2 size={16} color="#4CAF50" />
                                    <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>Up to date</Text>
                                </View>
                            )}
                        </View>

                        {updateStatus === 'available' && (
                            <View style={styles.availableBox}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.releaseTitle}>New Version: {latestRelease.tag_name}</Text>
                                    <Text style={styles.releaseNotes} numberOfLines={2}>{latestRelease.name}</Text>
                                </View>
                                <TouchableOpacity onPress={downloadAndInstallUpdate} style={styles.downloadBtn}>
                                    <ArrowDownCircle size={20} color="#FFF" />
                                    <Text style={styles.downloadBtnText}>Update Now</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {updateStatus === 'downloading' && (
                            <View style={{ marginTop: 8 }}>
                                <Text style={styles.downloadText}>Downloading update... {Math.round(downloadProgress * 100)}%</Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.divider} />

                    <PressableScale style={styles.actionRow} onPress={() => navigation.navigate('ActivityLog')}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                            <View style={[styles.iconBox, { backgroundColor: c.subtext + '15' }]}>
                                <FileText size={18} color={c.text} />
                            </View>
                            <Text style={styles.settingLabel}>System Logs</Text>
                        </View>
                        <ChevronRight size={18} color={c.subtext} />
                    </PressableScale>

                    <View style={styles.divider} />

                    <PressableScale style={styles.actionRow} onPress={() => setShowHowToUse(true)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                            <View style={[styles.iconBox, { backgroundColor: theme.palette.purple + '15' }]}>
                                <HelpCircle size={18} color={theme.palette.purple} />
                            </View>
                            <View>
                                <Text style={styles.settingLabel}>How to Use App</Text>
                                <Text style={styles.settingSub}>Quick guide to all features</Text>
                            </View>
                        </View>
                        <ChevronRight size={18} color={c.subtext} />
                    </PressableScale>

                    <View style={styles.divider} />

                    <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 12, fontSize: 14 }]}>Data Management</Text>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <PressableScale style={[styles.actionRow, { flex: 1, backgroundColor: c.glassBgStart, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder }]} onPress={handleExportData}>
                            <View style={[styles.iconBox, { backgroundColor: c.primary + '10' }]}>
                                <Download size={18} color={c.primary} />
                            </View>
                            <View style={{ marginLeft: 10 }}>
                                <Text style={{ fontWeight: '700', color: c.text }}>Export</Text>
                                <Text style={{ fontSize: 10, color: c.subtext }}>Backup JSON</Text>
                            </View>
                        </PressableScale>

                        <PressableScale style={[styles.actionRow, { flex: 1, backgroundColor: c.glassBgStart, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder }]} onPress={handleImportData}>
                            <View style={[styles.iconBox, { backgroundColor: c.success + '10' }]}>
                                <Upload size={18} color={c.success} />
                            </View>
                            <View style={{ marginLeft: 10 }}>
                                <Text style={{ fontWeight: '700', color: c.text }}>Import</Text>
                                <Text style={{ fontSize: 10, color: c.subtext }}>Restore Data</Text>
                            </View>
                        </PressableScale>
                    </View>

                </LinearGradient>



                {/* DANGER ZONE */}
                <View style={styles.dangerZoneContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                        <AlertTriangle size={16} color={c.danger} strokeWidth={2.5} />
                        <Text style={[styles.sectionTitle, { color: c.danger, marginBottom: 0, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }]}>Danger Zone</Text>
                    </View>

                    <PressableScale style={styles.dangerBtn} onPress={logout} hapticStyle="heavy">
                        <View style={[styles.dangerIconBox, { backgroundColor: c.danger + '15', marginRight: 16 }]}>
                            <LogOut size={18} color={c.danger} strokeWidth={2.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dangerText}>Log Out</Text>
                            <Text style={styles.dangerSubtext}>Sign out from this device</Text>
                        </View>
                        <ChevronRight size={18} color={c.danger + '60'} />
                    </PressableScale>

                    <PressableScale
                        style={[styles.dangerBtn, { marginTop: 12, borderColor: c.danger + '40', backgroundColor: c.danger + '05' }]}
                        onPress={() => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

                            // Get current user email for safety verification
                            const userEmail = user?.email?.toLowerCase() || '';

                            Alert.alert(
                                "⚠️ DELETE ALL DATA",
                                `This will permanently delete all your subjects, attendance logs, timetable, and settings.\n\n📥 A backup file will be saved to your device first.\n\n🔒 Deleting data for: ${userEmail}\n\nAre you absolutely sure?`,
                                [
                                    {
                                        text: "Cancel",
                                        style: "cancel",
                                        onPress: () => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }
                                    },
                                    {
                                        text: "Delete Everything",
                                        style: "destructive",
                                        onPress: async () => {
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                            setLoading(true);
                                            try {
                                                console.log('🗑️ Attempting to delete all data for:', userEmail);

                                                // 📥 MANDATORY: Force download backup FIRST
                                                Alert.alert("Downloading Backup", "Please wait while we save your backup file...");

                                                try {
                                                    // Export data first
                                                    const exportData = await attendanceService.exportData();
                                                    const filename = `acadhub-backup-BEFORE-DELETE-${userEmail.replace('@', '_at_').replace(/\./g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
                                                    const fileUri = FileSystem.documentDirectory + filename;

                                                    // Write to file
                                                    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2));

                                                    // Force share/save the backup
                                                    if (await Sharing.isAvailableAsync()) {
                                                        await Sharing.shareAsync(fileUri, {
                                                            mimeType: 'application/json',
                                                            dialogTitle: 'Save your backup before deletion',
                                                            UTI: 'public.json'
                                                        });
                                                    } else {
                                                        Alert.alert("Backup Saved", `Backup saved to: ${fileUri}`);
                                                    }

                                                    console.log('✅ Backup downloaded successfully');
                                                } catch (backupError) {
                                                    console.error('❌ Backup failed:', backupError);
                                                    Alert.alert(
                                                        "Backup Failed",
                                                        "Could not create backup. Deletion cancelled for your safety.\n\nPlease try exporting your data manually first.",
                                                        [{ text: "OK" }]
                                                    );
                                                    setLoading(false);
                                                    return; // ABORT deletion if backup fails
                                                }

                                                // Final confirmation after backup
                                                Alert.alert(
                                                    "Backup Complete",
                                                    "Your backup has been saved. Do you want to proceed with deletion?",
                                                    [
                                                        { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
                                                        {
                                                            text: "Yes, Delete Now",
                                                            style: "destructive",
                                                            onPress: async () => {
                                                                try {
                                                                    const result = await attendanceService.deleteAllData(userEmail);
                                                                    console.log('✅ Delete result:', result);

                                                                    const backupId = result?.backup_id || 'N/A';

                                                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                                                    Alert.alert(
                                                                        "✓ Reset Complete",
                                                                        `All data has been deleted.\n\n📦 Server Backup ID: ${backupId}\n📥 Local backup saved to device.\n\nYou will now be logged out.`,
                                                                        [{
                                                                            text: "OK",
                                                                            onPress: async () => {
                                                                                await logout();
                                                                            }
                                                                        }]
                                                                    );
                                                                } catch (deleteError) {
                                                                    console.error('❌ Delete failed:', deleteError);
                                                                    let errorMsg = deleteError.message || 'Unknown error';
                                                                    if (deleteError.response?.data?.error) {
                                                                        errorMsg = deleteError.response.data.error;
                                                                    }
                                                                    Alert.alert("Error", `Failed to delete data.\n\n${errorMsg}`);
                                                                } finally {
                                                                    setLoading(false);
                                                                }
                                                            }
                                                        }
                                                    ]
                                                );
                                            } catch (e) {
                                                console.error('❌ Process failed:', e.message, e.response?.data);
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                                Alert.alert("Error", `Operation failed: ${e.message}`);
                                                setLoading(false);
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                        hapticStyle="error"
                    >
                        <View style={[styles.dangerIconBox, { backgroundColor: c.danger + '15', marginRight: 16 }]}>
                            <Trash2 size={18} color={c.danger} strokeWidth={2.5} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dangerText}>Delete All Data</Text>
                            <Text style={styles.dangerSubtext}>Permanently remove account & data</Text>
                        </View>
                        <AlertTriangle size={18} color={c.danger} />
                    </PressableScale>

                    {/* Reset Data Removed */}
                </View>
            </Animated.ScrollView>

            {/* FULL-SCREEN LOADING OVERLAY - Positioned at root level to cover entire screen */}
            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={c.primary} />
                </View>
            )}

            {/* How to Use Modal */}
            <Modal
                visible={showHowToUse}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowHowToUse(false)}
            >
                <View style={{ flex: 1, backgroundColor: isDark ? '#0D0D0D' : '#F7F8FA' }}>
                    {/* Header with safe area */}
                    <LinearGradient
                        colors={c.gradients.primary}
                        style={{ paddingTop: insets.top, paddingBottom: 20, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ gap: 4 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' }}>User Guide</Text>
                                <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>Master AcadHub</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowHowToUse(false)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 20 }}>
                                <X size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* Content */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }} showsVerticalScrollIndicator={false}>

                        <View style={{ marginBottom: 8 }}>
                            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>🚀 Get Started Fast</Text>
                            <Text style={{ color: c.subtext, fontSize: 13, fontWeight: '500' }}>Follow these simple steps to track like a pro.</Text>
                        </View>

                        {[
                            { color: '#AC67FF', t: '1. Select Your Semester', d: 'Tap the semester badge on the Dashboard. This segments your subjects and attendance by term.', icon: '📅' },
                            { color: '#FF318C', t: '2. Add All Subjects', d: 'Use the ➕ button on Dashboard. Add separate entries for Theory, Lab, and Tutorials to stay precise.', icon: '📚' },
                            { color: '#FF8F3F', t: '3. Configure Timetable', d: 'Go to Schedule tab → Manage → ⚙️. Define your period timings (e.g., 9:00 - 10:00). Then map subjects to slots.', icon: '⏰' },
                            { color: '#34C759', t: '4. Precision Marking', d: 'Mark Present ✅ or Absent ❌ from Calendar. Long press for bulk marking or substitution details.', icon: '✋' },
                            { color: '#1E90FF', t: '5. Dynamic Results', d: 'Academy → Results. Add internals & externals. We calculate your SGPA/CGPA automatically based on credits.', icon: '🏆' },
                            { color: '#FFD700', t: '6. Official IPU Notices', d: 'Check the 🔔 bell icon for official scraper updates. Swipe down to refresh the feed instantly.', icon: '🔔' }
                        ].map((step, i) => (
                            <View
                                key={i}
                                style={{
                                    flexDirection: 'row',
                                    backgroundColor: c.glassBgStart,
                                    borderRadius: 24,
                                    padding: 20,
                                    borderWidth: 1,
                                    borderColor: c.glassBorder,
                                    alignItems: 'center',
                                    gap: 16
                                }}
                            >
                                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: step.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 24 }}>{step.icon}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: step.color, fontSize: 15, fontWeight: '800', marginBottom: 4 }}>{step.t}</Text>
                                    <Text style={{ color: c.text, fontSize: 13, lineHeight: 18, fontWeight: '500', opacity: 0.9 }}>{step.d}</Text>
                                </View>
                            </View>
                        ))}

                        <LinearGradient
                            colors={isDark ? ['#1E1F22', '#121212'] : ['#F0F0F0', '#E5E5E5']}
                            style={{ padding: 20, borderRadius: 24, marginTop: 10, borderWidth: 1, borderColor: c.glassBorder }}
                        >
                            <Text style={{ color: c.primary, fontSize: 15, fontWeight: '800', marginBottom: 12 }}>💡 Pro Tips</Text>
                            <View style={{ gap: 10 }}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.text, marginTop: 6 }} />
                                    <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>Enable notifications to get a summary of your classes every morning.</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.text, marginTop: 6 }} />
                                    <Text style={{ color: c.text, fontSize: 13, flex: 1 }}>Sync your data periodically by performing an export from Settings.</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        <PressableScale
                            onPress={() => setShowHowToUse(false)}
                            style={{ backgroundColor: c.primary, padding: 18, borderRadius: 24, alignItems: 'center', marginTop: 10 }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>Got it, thanks!</Text>
                        </PressableScale>

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    headerContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 10,
        paddingHorizontal: 24,
        justifyContent: 'flex-end',
        paddingBottom: 20
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'flex-end'
    },
    headerTitle: {
        fontWeight: '900',
        color: c.text,
        letterSpacing: -1,
        includeFontPadding: false
    },
    headerSubtitle: {
        fontSize: 14,
        color: c.subtext,
        fontWeight: '600',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    // Hero Styles
    heroAvatar: {
        width: 100, height: 100,
        borderRadius: 50, borderWidth: 3, borderColor: c.glassBorder,
        overflow: 'hidden',
        shadowColor: c.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2, shadowRadius: 16, elevation: 8
    },
    heroName: {
        fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 4
    },
    heroEmail: {
        fontSize: 14, color: c.subtext, fontWeight: '500'
    },
    editBadge: {
        position: 'absolute', bottom: 4, right: 4,
        backgroundColor: c.primary, padding: 8, borderRadius: 14,
        borderWidth: 2, borderColor: '#000'
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 70 + insets.bottom
    },
    card: {
        borderRadius: 26,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: c.glassBorder
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: c.text,
        marginBottom: 16
    },
    inputGroup: {
        marginBottom: 16
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: c.subtext,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    input: {
        backgroundColor: c.inputBg,
        borderRadius: 16,
        padding: 16,
        color: c.text,
        fontSize: 15,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    inputActive: {
        borderColor: c.primary,
        backgroundColor: c.glassBgEnd
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: c.text
    },
    settingSub: {
        fontSize: 12,
        color: c.subtext
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    divider: {
        height: 1,
        backgroundColor: c.glassBorder,
        marginVertical: 12
    },
    updateBtn: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: c.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    dangerZoneContainer: {
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: c.danger + '30',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(224, 98, 96, 0.03)',
    },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 20,
        gap: 14,
        borderWidth: 1,
        borderColor: c.danger + '20',
        backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.02)',
    },
    dangerIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerText: {
        fontSize: 16,
        fontWeight: '800',
        color: c.danger,
        letterSpacing: -0.3
    },
    dangerSubtext: {
        fontSize: 12,
        fontWeight: '600',
        color: c.subtext,
        marginTop: 2,
    },
    loader: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center', alignItems: 'center',
        zIndex: 100
    },
    updateCard: {
        padding: 4
    },
    checkBtn: {
        backgroundColor: c.primary + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.primary + '30'
    },
    checkBtnText: {
        color: c.primary,
        fontSize: 12,
        fontWeight: 'bold'
    },
    availableBox: {
        backgroundColor: c.primary + '10',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
        borderColor: c.primary + '20'
    },
    releaseTitle: {
        color: c.text,
        fontSize: 14,
        fontWeight: '800'
    },
    releaseNotes: {
        color: c.subtext,
        fontSize: 12,
        marginTop: 2
    },
    downloadBtn: {
        backgroundColor: c.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        shadowColor: c.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
    },
    downloadBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold'
    },
    downloadText: {
        color: c.subtext,
        fontSize: 12,
        marginBottom: 8,
        fontWeight: '600'
    },
    progressBar: {
        height: 6,
        backgroundColor: c.inputBg,
        borderRadius: 3,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        backgroundColor: c.primary,
        borderRadius: 3
    }
});

export default SettingsScreen;



