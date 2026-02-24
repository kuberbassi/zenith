import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, StyleSheet, TouchableOpacity,
    ScrollView, Dimensions, ActivityIndicator
} from 'react-native';
import { LinearGradient } from './LinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Sparkles, Gift } from 'lucide-react-native';
import { theme } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import Constants from 'expo-constants';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/kuberbassi/attendance-tracker/releases/latest';
const LAST_SEEN_VERSION_KEY = 'lastSeenAppVersion';

const ChangelogModal = () => {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [changelog, setChangelog] = useState(null);

    const c = isDark ? theme.dark : theme.light;
    const currentVersion = Constants.expoConfig?.version || '1.0.0';

    useEffect(() => {
        checkForNewVersion();
    }, []);

    const checkForNewVersion = async () => {
        try {
            const lastSeenVersion = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);

            // If this is a new version the user hasn't seen
            if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
                // Fetch changelog from GitHub
                const response = await axios.get(GITHUB_RELEASES_URL, {
                    headers: { Accept: 'application/vnd.github.v3+json' }
                });

                const release = response.data;
                const releaseVersion = release.tag_name.replace('v', '');

                // STRICT CHECK: Only show if the GitHub Release matches the Current App Version
                // AND we haven't seen this version before.
                // This prevents showing v1.0.0 notes to a v2.0.0 user.
                if (release && releaseVersion === currentVersion) {
                    setChangelog({
                        version: releaseVersion,
                        name: release.name || `Version ${release.tag_name}`,
                        body: release.body || 'Bug fixes and improvements.',
                        publishedAt: new Date(release.published_at).toLocaleDateString()
                    });
                    setVisible(true);
                } else {
                    console.log(`Changelog skipped: Release v${releaseVersion} != Current v${currentVersion}`);
                }
            }

            // Update stored version
            await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
        } catch (error) {
            console.log('Changelog check error:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setVisible(false);
    };

    // Helper to render text with BOLD support
    const renderStyledText = (text, style) => {
        // Split by **bold** markers
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return (
            <Text style={style}>
                {parts.map((part, index) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        // Bold content
                        return (
                            <Text key={index} style={{ fontWeight: 'bold', color: isDark ? '#FFF' : '#000' }}>
                                {part.slice(2, -2)}
                            </Text>
                        );
                    }
                    return <Text key={index}>{part}</Text>;
                })}
            </Text>
        );
    };

    // Format markdown-ish changelog text
    const formatChangelog = (text) => {
        if (!text) return [];

        // Split by lines and process
        return text.split('\n').map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            // Headers
            if (trimmed.startsWith('### ')) {
                return { type: 'header', text: trimmed.replace('### ', ''), key: index };
            }
            if (trimmed.startsWith('## ')) {
                return { type: 'subheader', text: trimmed.replace('## ', ''), key: index };
            }
            // List items
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return { type: 'bullet', text: trimmed.slice(2), key: index };
            }
            // Key-Value style bullets (e.g. "**Feature:** Description")
            if (trimmed.startsWith('**') && trimmed.includes(':')) {
                return { type: 'bullet', text: trimmed, key: index };
            }

            // Regular text
            return { type: 'text', text: trimmed, key: index };
        }).filter(Boolean);
    };

    if (!visible || !changelog) return null;

    const formattedChangelog = formatChangelog(changelog.body);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={[
                    styles.container,
                    {
                        backgroundColor: c.surfaceContainer,
                        marginTop: insets.top + 60,
                        marginBottom: insets.bottom + 60
                    }
                ]}>
                    {/* Header */}
                    <LinearGradient
                        colors={theme.gradients.primary}
                        style={styles.header}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={styles.headerContent}>
                            <Gift size={24} color="#FFFFFF" />
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>What's New</Text>
                                <Text style={styles.headerVersion}>v{changelog.version}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <X size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Content */}
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                    >
                        <Text style={[styles.releaseName, { color: c.onSurface }]}>
                            {changelog.name}
                        </Text>
                        <Text style={[styles.releaseDate, { color: c.onSurfaceVariant }]}>
                            Released {changelog.publishedAt}
                        </Text>

                        <View style={styles.changelogBody}>
                            {formattedChangelog.map((item) => {
                                if (item.type === 'header') {
                                    return (
                                        <Text key={item.key} style={[styles.sectionHeader, { color: c.primary }]}>
                                            {renderStyledText(item.text, {})}
                                        </Text>
                                    );
                                }
                                if (item.type === 'subheader') {
                                    return (
                                        <Text key={item.key} style={[styles.subHeader, { color: c.onSurface }]}>
                                            {renderStyledText(item.text, {})}
                                        </Text>
                                    );
                                }
                                if (item.type === 'bullet') {
                                    return (
                                        <View key={item.key} style={styles.bulletRow}>
                                            <View style={[styles.bulletDot, { backgroundColor: c.primary }]} />
                                            {renderStyledText(item.text, [styles.bulletText, { color: c.onSurface }])}
                                        </View>
                                    );
                                }
                                return (
                                    <Text key={item.key} style={[styles.bodyText, { color: c.onSurfaceVariant }]}>
                                        {renderStyledText(item.text, {})}
                                    </Text>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { borderTopColor: c.outlineVariant }]}>
                        <TouchableOpacity onPress={handleClose} activeOpacity={0.8}>
                            <LinearGradient
                                colors={theme.gradients.primary}
                                style={styles.closeBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Text style={styles.closeBtnText}>Got it!</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
    },
    container: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        maxHeight: height * 0.75,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerText: {
        gap: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerVersion: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    releaseName: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    releaseDate: {
        fontSize: 14,
        marginBottom: 20,
    },
    changelogBody: {
        gap: 8,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    subHeader: {
        fontSize: 15,
        fontWeight: '600',
        marginTop: 12,
        marginBottom: 6,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginVertical: 4,
    },
    bulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 7,
    },
    bulletText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    bodyText: {
        fontSize: 15,
        lineHeight: 22,
    },
    footer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
    },
    closeBtn: {
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ChangelogModal;

