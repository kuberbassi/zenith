import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, Animated, UIManager, Platform } from 'react-native';
import { theme, Layout } from '../theme';
import { attendanceService } from '../services';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { BarChart2, TrendingDown, Activity, Zap, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedHeader from '../components/AnimatedHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useSemester } from '../contexts/SemesterContext';
import PressableScale from '../components/PressableScale';
import academicService from '../services/academic.service';
import { LineChart } from 'react-native-chart-kit';

const AnalyticsScreen = () => {
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { selectedSemester } = useSemester();
    const { user } = useAuth();
    const threshold = user?.attendance_threshold || 75;
    const warningThreshold = user?.warning_threshold || (threshold - 5);

    // AMOLED Theme
    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F7F8FA',
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
        accent: theme.palette.magenta,
        surface: isDark ? '#121212' : '#FFFFFF',
    };

    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [weeklyRawData, setWeeklyRawData] = useState(null);
    const [allResults, setAllResults] = useState([]);
    const [overallCgpa, setOverallCgpa] = useState('0.00');

    const fetchData = async () => {
        try {
            const [reportRes, weeklyRes, resultsRes] = await Promise.all([
                attendanceService.getReportsData(selectedSemester),
                attendanceService.getDayOfWeekAnalytics(selectedSemester),
                attendanceService.getSavedIPUResults()
            ]);
            setReportData(reportRes);
            setWeeklyRawData(weeklyRes);
            if (resultsRes) {
                setAllResults(resultsRes.semesters || []);
                setOverallCgpa(resultsRes.cgpa || '0.00');
            }
        } catch (error) {
            console.error("Analytics Fetch Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    useFocusEffect(useCallback(() => { fetchData(); }, [selectedSemester]));

    // Data Processing
    const getWeeklyData = () => {
        if (!weeklyRawData?.days) return [];

        const dayOrder = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };

        return weeklyRawData.days
            .map(d => ({
                day: d.day.charAt(0),
                fullDay: d.day,
                count: d.percentage || 0,
                total: d.total || 0,
                sortKey: dayOrder[d.day] || 8
            }))
            .filter(d => d.sortKey <= 5) // Mon-Fri Only
            .sort((a, b) => a.sortKey - b.sortKey);
    };

    const getFocusSubjects = () => {
        if (!Array.isArray(reportData?.subject_breakdown)) return [];
        return [...reportData.subject_breakdown].sort((a, b) => a.percentage - b.percentage).slice(0, 4);
    };

    const getTotalStats = () => {
        if (!reportData?.subject_breakdown) return { attended: 0, total: 0, overallPct: 0 };
        const attended = reportData.subject_breakdown.reduce((s, x) => s + (x.attended || 0), 0);
        const total = reportData.subject_breakdown.reduce((s, x) => s + (x.total || 0), 0);
        const overallPct = total > 0 ? (attended / total) * 100 : 0;
        return { attended, total, overallPct };
    };


    const weeklyData = React.useMemo(() => getWeeklyData(), [reportData, weeklyRawData]);
    const focusSubjects = React.useMemo(() => getFocusSubjects(), [reportData]);
    const stats = React.useMemo(() => getTotalStats(), [reportData]);
    const weeklyHasData = weeklyData.some(d => d.total > 0);

    const headerHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [120, 80], extrapolate: 'clamp' });
    const titleSize = scrollY.interpolate({ inputRange: [0, 100], outputRange: [32, 24], extrapolate: 'clamp' });
    const subHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [20, 0], extrapolate: 'clamp' });
    const subOpacity = scrollY.interpolate({ inputRange: [0, 50], outputRange: [1, 0], extrapolate: 'clamp' });

    // SGPA Chart Data Formatting
    const sgpaLabels = allResults.map(r => `Sem ${r.semester}`);
    const sgpaDataset = allResults.map(r => parseFloat(r.sgpa) || 0);
    const sgpaChartData = {
        labels: sgpaLabels.length ? sgpaLabels : ['Sem 1'],
        datasets: [{ data: sgpaDataset.length ? sgpaDataset : [0] }]
    };
    const maxSgpaValue = Math.max(...(sgpaDataset.length ? sgpaDataset : [0]), 10);
    const chartConfig = {
        backgroundGradientFrom: c.surface,
        backgroundGradientFromOpacity: 0,
        backgroundGradientTo: c.surface,
        backgroundGradientToOpacity: 0,
        color: (opacity = 1) => c.primary,
        strokeWidth: 2,
        barPercentage: 0.5,
        useShadowColorFromDataset: false,
        decimalPlaces: 2
    };

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* UNIVERSAL ANIMATED HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Analytics"
                subtitle={`Trends & Insights • Sem ${selectedSemester}`}
                isDark={isDark}
                colors={c}
            />

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        progressBackgroundColor={c.surface}
                        progressViewOffset={Layout.header.minHeight + insets.top + 15}
                    />
                }
            >
                {/* Overall Stats Grid */}
                {allResults.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                        <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={[styles.card, { flex: 1, marginBottom: 0, paddingVertical: 16 }]}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: c.subtext, marginBottom: 4 }}>OVERALL CGPA</Text>
                            <Text style={{ fontSize: 32, fontWeight: '800', color: c.text }}>
                                {overallCgpa}
                            </Text>
                        </LinearGradient>
                        <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={[styles.card, { flex: 1, marginBottom: 0, paddingVertical: 16 }]}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: c.subtext, marginBottom: 4 }}>TOTAL CREDITS</Text>
                            <Text style={{ fontSize: 32, fontWeight: '800', color: c.primary }}>
                                {allResults.reduce((acc, sem) => acc + (parseInt(sem.total_credits) || 0), 0)}
                            </Text>
                        </LinearGradient>
                    </View>
                )}

                {/* SGPA Performance Trend Card */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <View style={[styles.cardHeader, { marginBottom: 12 }]}>
                        <View style={[styles.iconBox, { backgroundColor: c.accent + '20' }]}>
                            <TrendingDown size={18} color={c.accent} style={{ transform: [{ scaleY: -1 }] }} />
                        </View>
                        <Text style={styles.cardTitle}>SGPA Trend</Text>
                    </View>

                    {sgpaDataset.length > 0 ? (
                        <View style={{ overflow: 'hidden', paddingBottom: 16 }}>
                            <LineChart
                                data={sgpaChartData}
                                width={Dimensions.get('window').width - 72}
                                height={220}
                                chartConfig={chartConfig}
                                bezier
                                style={{ marginVertical: 8, borderRadius: 16, marginLeft: -16 }}
                                fromZero
                                yAxisSuffix=""
                                yAxisInterval={1}
                            />
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Activity size={32} color={c.subtext} />
                            <Text style={styles.emptyText}>No academic data</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Weekly Chart Card */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <View style={[styles.cardHeader, { marginBottom: 24 }]}>
                        <View style={[styles.iconBox, { backgroundColor: c.primary + '20' }]}>
                            <BarChart2 size={18} color={c.primary} />
                        </View>
                        <Text style={styles.cardTitle}>Weekly Attendance</Text>
                    </View>

                    {weeklyHasData ? (
                        <View style={styles.chartRow}>
                            {(weeklyData || []).map((item, index) => (
                                <View key={index} style={styles.barGroup}>
                                    <View style={styles.barTrack}>
                                        <LinearGradient
                                            colors={item.count >= threshold ? theme.gradients.success : item.count > warningThreshold ? theme.gradients.orange : theme.gradients.danger}
                                            style={[styles.barFill, { height: `${Math.max(item.count, 15)}%` }]}
                                            start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }}
                                        />
                                    </View>
                                    <Text style={styles.dayLabel}>{item.day}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Activity size={32} color={c.subtext} />
                            <Text style={styles.emptyText}>No data this week</Text>
                        </View>
                    )}
                </LinearGradient>

                {/* Focus Areas */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconBox, { backgroundColor: c.danger + '20' }]}>
                            <TrendingDown size={18} color={c.danger} />
                        </View>
                        <Text style={styles.cardTitle}>Focus Areas</Text>
                    </View>

                    {(focusSubjects || []).map((sub, idx) => {
                        const pct = sub.percentage || 0;
                        const statusColor = pct >= threshold ? c.success : pct > warningThreshold ? c.warning : c.danger;
                        return (
                            <View key={idx} style={styles.focusRow}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text style={styles.subjectName} numberOfLines={1}>{sub.name}</Text>
                                    <Text style={[styles.pctText, { color: statusColor }]}>{pct.toFixed(0)}%</Text>
                                </View>
                                <View style={styles.progTrack}>
                                    <LinearGradient
                                        colors={pct >= threshold ? theme.gradients.success : pct > warningThreshold ? theme.gradients.orange : theme.gradients.danger}
                                        style={[styles.progFill, { width: `${pct}%` }]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </LinearGradient>

                {/* Summary */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconBox, { backgroundColor: c.success + '20' }]}>
                            <Zap size={18} color={c.success} />
                        </View>
                        <Text style={styles.cardTitle}>Summary</Text>
                    </View>

                    <Text style={styles.summaryText}>
                        You have attended <Text style={{ fontWeight: '800', color: c.text }}>{stats.attended}</Text> out of <Text style={{ fontWeight: '800', color: c.text }}>{stats.total}</Text> classes.
                        Overall attendance is <Text style={{ fontWeight: '800', color: stats.overallPct >= threshold ? c.success : stats.overallPct > warningThreshold ? c.warning : c.danger }}>{(stats.overallPct || 0).toFixed(1)}%</Text>.
                    </Text>

                    <View style={styles.legend}>
                        <View style={styles.legendItem}>
                            <CheckCircle size={14} color={c.success} />
                            <Text style={styles.legendText}>Target ({threshold}%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <AlertTriangle size={14} color={c.warning} />
                            <Text style={styles.legendText}>Warning ({warningThreshold}%)</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <AlertTriangle size={14} color={c.danger} />
                            <Text style={styles.legendText}>Risk</Text>
                        </View>
                    </View>
                </LinearGradient>

            </Animated.ScrollView>
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    headerContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        justifyContent: 'flex-end', paddingBottom: 16
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: c.glassBgStart, borderBottomWidth: 1, borderBottomColor: c.glassBorder
    },
    headerContent: { paddingHorizontal: 24 },
    headerTitle: { fontWeight: '900', color: c.text, letterSpacing: -1 },
    headerSub: { color: c.subtext, fontWeight: '600', fontSize: 13, marginTop: 4 },

    scrollContent: { padding: 16, paddingTop: 140, paddingBottom: 100 + insets.bottom },
    card: {
        borderRadius: 24, padding: 20, marginBottom: 20,
        borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 18, fontWeight: '800', color: c.text },

    chartRow: { flexDirection: 'row', justifyContent: 'space-between', height: 110, alignItems: 'flex-end', paddingBottom: 8, paddingTop: 10 },
    barGroup: { alignItems: 'center', gap: 8, flex: 1 },
    barTrack: { width: 14, height: '100%', backgroundColor: c.glassBgEnd, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' }, // Thicker, rounded
    barFill: { width: '100%', borderRadius: 8 },
    dayLabel: { fontSize: 12, fontWeight: '700', color: c.subtext },

    emptyState: { alignItems: 'center', justifyContent: 'center', height: 120, gap: 8 },
    emptyText: { color: c.subtext, fontWeight: '600' },

    focusRow: { marginBottom: 20 }, // More spacing
    subjectName: { fontSize: 15, fontWeight: '700', color: c.text, flex: 1, marginBottom: 6 },
    pctText: { fontSize: 15, fontWeight: '800' },
    progTrack: { height: 12, backgroundColor: c.glassBgEnd, borderRadius: 6, overflow: 'hidden' }, // Thicker
    progFill: { height: '100%', borderRadius: 6 },

    summaryText: { fontSize: 16, color: c.subtext, lineHeight: 26, fontWeight: '500' }, // Larger text
    legend: { flexDirection: 'row', gap: 16, marginTop: 20 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontSize: 13, fontWeight: '700', color: c.subtext }
});

export default AnalyticsScreen;



