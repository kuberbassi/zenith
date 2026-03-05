import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, RefreshControl, TouchableOpacity } from 'react-native';
import { attendanceService } from '../services';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle, XCircle, Trash2, Edit, AlertCircle, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AnimatedHeader from '../components/AnimatedHeader';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from '../components/LinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../components/PressableScale';
import { theme, Layout } from '../theme';

const ActivityLogScreen = ({ navigation }) => {
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

        primary: theme.palette.purple,
        success: theme.palette.green,
        danger: theme.palette.red,
        warning: theme.palette.orange,
        surface: isDark ? '#121212' : '#FFFFFF',
    };


    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchLogs = async () => {
        try {
            // Updated to fetch SYSTEM logs via service
            const data = await attendanceService.getSystemLogs();
            setLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchLogs(); }, []));

    const renderItem = ({ item }) => {
        let Icon = AlertCircle;
        let color = c.subtext;
        let gradient = [c.subtext + '20', c.subtext + '10'];

        const action = item.action || '';

        if (action.includes('Attendance')) {
            Icon = CheckCircle;
            color = c.success;
            gradient = theme.gradients.success;
        }
        else if (action.includes('Deleted')) {
            Icon = Trash2;
            color = c.danger;
            gradient = theme.gradients.danger;
        }
        else if (action.includes('Added') || action.includes('Created')) {
            Icon = CheckCircle;
            color = isDark ? theme.palette.selection : theme.palette.blue;
            gradient = theme.gradients.royal;
        }
        else if (action.includes('Overridden') || action.includes('Updated')) {
            Icon = Edit;
            color = c.warning;
            gradient = ['#FF8F3F', '#FFEF5A'];
        }
        else if (action.includes('Import') || action.includes('Auth')) {
            Icon = ArrowLeft;
            color = isDark ? theme.palette.purple : theme.palette.blue;
            gradient = theme.gradients.primary;
        }

        return (
            <PressableScale style={styles.logWrapper}>
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.logItem}>
                    <LinearGradient
                        colors={gradient}
                        style={styles.iconBox}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Icon size={18} color="#FFF" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.logTitle}>{item.action}</Text>
                        <Text style={styles.logSub} numberOfLines={2}>
                            {item.description}
                        </Text>
                    </View>
                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>
                            {item.timestamp ? (item.timestamp.$date ? new Date(item.timestamp.$date) : new Date(item.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </Text>
                    </View>
                </LinearGradient>
            </PressableScale>
        );
    };

    const headerHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [120, 80], extrapolate: 'clamp' });
    const titleSize = scrollY.interpolate({ inputRange: [0, 100], outputRange: [32, 24], extrapolate: 'clamp' });

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            <AnimatedHeader
                scrollY={scrollY}
                title="Activity Log"
                subtitle="Recent actions"
                isDark={isDark}
                colors={c}
                leftComponent={
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginLeft: -8 }}>
                        <ArrowLeft color={c.text} size={24} />
                    </TouchableOpacity>
                }
            />

            <Animated.FlatList
                data={logs} renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.listContent}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                ListEmptyComponent={!loading && <Text style={{ textAlign: 'center', color: c.subtext, marginTop: 40 }}>No logs found.</Text>}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRefreshing(true);
                    fetchLogs();
                }} tintColor={c.primary} />}
            />
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    listContent: {
        paddingTop: Layout.header.maxHeight + (insets?.top || 20) - 30,
        paddingHorizontal: 16,
        paddingBottom: 40 + insets.bottom
    },

    logWrapper: {
        marginBottom: 12,
    },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.glassBorder,
        gap: 14,
        backgroundColor: c.surface
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { height: 2 }
    },
    logTitle: { fontSize: 16, fontWeight: '800', color: c.text, letterSpacing: -0.3 },
    logSub: { fontSize: 13, color: c.subtext, marginTop: 2, lineHeight: 18 },
    timeContainer: {
        backgroundColor: c.glassBorder,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: { fontSize: 11, fontWeight: '800', color: c.subtext }
});

export default ActivityLogScreen;



