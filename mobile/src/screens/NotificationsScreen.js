import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, RefreshControl, Linking } from 'react-native';
import { theme, Layout } from '../theme';
import { attendanceService } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import { Bell, Info, Megaphone, ExternalLink, FileText } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import * as Haptics from 'expo-haptics';
import AnimatedHeader from '../components/AnimatedHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../components/PressableScale';

const NotificationsScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();

    // AMOLED Theme
    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',

        glassBgStart: isDark ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)',
        glassBgEnd: isDark ? 'rgba(30,31,34,0.85)' : 'rgba(255,255,255,0.85)',
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',

        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',

        primary: theme.palette.selection,
        success: theme.palette.green,
        danger: theme.palette.red,
        surface: isDark ? '#121212' : '#FFFFFF',
    };


    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [uniNotices, setUniNotices] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (force = false) => {
        try {
            const data = await attendanceService.getNotices(force);
            setUniNotices(data || []);
        } catch (error) { console.error(error); }
        finally { setRefreshing(false); }
    };

    const handleOpenLink = async (url) => {
        if (url && await Linking.canOpenURL(url)) await Linking.openURL(url);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            // Handle DD-MM-YYYY (University scraping common format)
            const parts = dateString.split('-');
            if (parts.length === 3) return `${parts[0]}/${parts[1]}/${parts[2]}`;
            return dateString;
        } catch (e) { return dateString; }
    };

    const renderItem = ({ item }) => {
        const displayTitle = item.title || 'Notice';
        const displayLink = item.link;
        const displayTime = formatDate(item.date);

        return (
            <PressableScale
                activeOpacity={displayLink ? 0.7 : 1}
                onPress={() => displayLink && handleOpenLink(displayLink)}
                style={styles.cardWrapper}
            >
                <LinearGradient
                    colors={isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : ['#FFFFFF', '#F8F9FA']}
                    style={styles.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                >
                    {/* Vertical Marker */}
                    <LinearGradient
                        colors={theme.gradients.vibrant}
                        style={styles.marker}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        noTexture // sub-gradient doesn't need shine
                    />

                    <View style={styles.cardContent}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle} numberOfLines={2}>
                                {displayTitle}
                            </Text>
                            <View style={styles.dateContainer}>
                                <Text style={styles.cardDate}>
                                    {displayTime}
                                </Text>
                            </View>
                        </View>

                        {displayLink && (
                            <View style={styles.linkCircle}>
                                <ExternalLink size={12} color={c.primary} />
                            </View>
                        )}
                    </View>
                </LinearGradient>
            </PressableScale>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* UNIVERSAL ANIMATED HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Notifications"
                subtitle="UNIVERSITY NOTICES"
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            />

            <Animated.FlatList
                data={uniNotices}
                renderItem={renderItem}
                keyExtractor={(item, idx) => (item.id || item._id || idx).toString()}
                contentContainerStyle={styles.list}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                ListHeaderComponent={<View style={{ height: Layout.header.maxHeight + (insets.top || 20) - 30 }} />}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                        <Bell size={48} color={c.subtext} style={{ opacity: 0.5 }} />
                        <Text style={{ color: c.subtext, marginTop: 16, fontWeight: '600' }}>No new notices</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setRefreshing(true);
                            fetchData(true);
                        }}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        progressBackgroundColor={c.surface}
                        progressViewOffset={Layout.header.minHeight + (insets.top || 20) + 15}
                    />
                }
            />
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    list: {
        paddingHorizontal: 20,
        paddingBottom: 100 + insets.bottom
    },
    cardWrapper: {
        marginBottom: 12,
    },
    card: {
        flexDirection: 'row',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.glassBorder,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        overflow: 'hidden',
    },
    marker: {
        width: 4,
        height: '100%',
    },
    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingLeft: 12,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        letterSpacing: -0.2,
        lineHeight: 20
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4
    },
    cardDate: {
        fontSize: 11,
        fontWeight: '600',
        color: c.subtext,
        letterSpacing: 0.2
    },
    linkCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: c.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12
    }
});

export default NotificationsScreen;



