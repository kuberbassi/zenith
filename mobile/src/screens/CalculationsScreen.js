import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, RefreshControl,
    Dimensions, Animated, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, Layout } from '../theme';
import { attendanceService } from '../services';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from '../components/LinearGradient';
import AnimatedHeader from '../components/AnimatedHeader';
import { useSemester } from '../contexts/SemesterContext';
import { BarChart2, TrendingUp, CheckCircle, AlertTriangle, Award, GraduationCap } from 'lucide-react-native';
import PressableScale from '../components/PressableScale';

const { width } = Dimensions.get('window');

const CalculationsScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { selectedSemester } = useSemester();
    const scrollY = useRef(new Animated.Value(0)).current;

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
        surface: isDark ? '#121212' : '#FFFFFF',
    };

    const styles = getStyles(c, isDark, insets);

    const [activeTab, setActiveTab] = useState('attendance');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Attendance data
    const [dashboardData, setDashboardData] = useState(null);
    const [reportsData, setReportsData] = useState(null);

    // Grades data
    const [semesterResults, setSemesterResults] = useState([]);

    const fetchData = async () => {
        try {
            if (activeTab === 'attendance') {
                const [dashboard, reports] = await Promise.all([
                    attendanceService.getDashboardData(selectedSemester),
                    attendanceService.getReportsData(selectedSemester)
                ]);
                setDashboardData(dashboard);
                setReportsData(reports);
            } else {
                const results = await attendanceService.getSemesterResults();
                setSemesterResults(results || []);
            }
        } catch (error) {
            console.error('Calculations fetch error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchData();
        }, [activeTab, selectedSemester])
    );

    // Calculate attendance stats
    const getAttendanceStats = () => {
        if (!dashboardData?.subjects) return { overall: 0, attended: 0, total: 0, safe: 0, risk: 0 };

        let totalAttended = 0;
        let totalClasses = 0;
        let safeCount = 0;
        let riskCount = 0;

        dashboardData.subjects.forEach(s => {
            totalAttended += s.attended_classes || 0;
            totalClasses += s.total_classes || 0;
            const pct = s.attendance_percentage || 0;
            if (pct >= 75) safeCount++;
            else riskCount++;
        });

        const overall = totalClasses > 0 ? ((totalAttended / totalClasses) * 100).toFixed(1) : 0;

        return { overall, attended: totalAttended, total: totalClasses, safe: safeCount, risk: riskCount };
    };

    // Calculate CGPA stats
    const getCGPAStats = () => {
        if (!semesterResults || semesterResults.length === 0) return { cgpa: '0.00', totalCredits: 0, semesters: 0 };

        let totalCredits = 0;
        let weightedSum = 0;

        semesterResults.forEach(r => {
            const credits = r.total_credits || 0;
            const sgpa = parseFloat(r.sgpa) || 0;
            if (credits > 0) {
                weightedSum += sgpa * credits;
                totalCredits += credits;
            }
        });

        const cgpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '0.00';
        return { cgpa, totalCredits, semesters: semesterResults.length };
    };

    const attendanceStats = getAttendanceStats();
    const cgpaStats = getCGPAStats();

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} />

            <AnimatedHeader
                scrollY={scrollY}
                title="Calculations"
                subtitle="Analytics & Statistics"
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            />

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
            >
                {/* Tab Selector */}
                <View style={styles.tabRow}>
                    <PressableScale
                        style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
                        onPress={() => setActiveTab('attendance')}
                    >
                        <BarChart2 size={18} color={activeTab === 'attendance' ? '#FFF' : c.subtext} />
                        <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>
                            Attendance
                        </Text>
                    </PressableScale>
                    <PressableScale
                        style={[styles.tab, activeTab === 'grades' && styles.tabActive]}
                        onPress={() => setActiveTab('grades')}
                    >
                        <GraduationCap size={18} color={activeTab === 'grades' ? '#FFF' : c.subtext} />
                        <Text style={[styles.tabText, activeTab === 'grades' && styles.tabTextActive]}>
                            Grades
                        </Text>
                    </PressableScale>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={c.primary} />
                    </View>
                ) : (
                    <>
                        {activeTab === 'attendance' && (
                            <View style={styles.content}>
                                {/* Overall Card */}
                                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                                    <Text style={styles.cardTitle}>📈 Overall Attendance</Text>
                                    <Text style={[styles.bigNumber, { color: parseFloat(attendanceStats.overall) >= 75 ? c.success : c.danger }]}>
                                        {attendanceStats.overall}%
                                    </Text>
                                    <Text style={styles.cardSub}>
                                        {attendanceStats.attended}/{attendanceStats.total} classes attended
                                    </Text>
                                </LinearGradient>

                                {/* Stats Row */}
                                <View style={styles.statsRow}>
                                    <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={[styles.statCard, { flex: 1 }]}>
                                        <CheckCircle size={24} color={c.success} />
                                        <Text style={styles.statValue}>{attendanceStats.safe}</Text>
                                        <Text style={styles.statLabel}>Safe</Text>
                                    </LinearGradient>
                                    <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={[styles.statCard, { flex: 1 }]}>
                                        <AlertTriangle size={24} color={c.danger} />
                                        <Text style={styles.statValue}>{attendanceStats.risk}</Text>
                                        <Text style={styles.statLabel}>At Risk</Text>
                                    </LinearGradient>
                                </View>

                                {/* Subject Breakdown */}
                                {dashboardData?.subjects?.map((subject, idx) => {
                                    const pct = subject.attendance_percentage || 0;
                                    const isSafe = pct >= 75;
                                    return (
                                        <LinearGradient key={idx} colors={[c.glassBgStart, c.glassBgEnd]} style={styles.subjectCard}>
                                            <View style={styles.subjectHeader}>
                                                <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                                                <Text style={[styles.subjectPct, { color: isSafe ? c.success : c.danger }]}>
                                                    {pct.toFixed(0)}%
                                                </Text>
                                            </View>
                                            <View style={styles.progressTrack}>
                                                <View style={[styles.progressFill, {
                                                    width: `${Math.min(pct, 100)}%`,
                                                    backgroundColor: isSafe ? c.success : c.danger
                                                }]} />
                                            </View>
                                            <Text style={styles.subjectStats}>
                                                {subject.attended_classes || 0}/{subject.total_classes || 0} •
                                                {pct < 75 ? ` Need ${Math.ceil((0.75 * (subject.total_classes || 0) - (subject.attended_classes || 0)) / 0.25)} more` : ' Safe to bunk ' + Math.floor(((subject.attended_classes || 0) - 0.75 * (subject.total_classes || 0)) / 0.75)}
                                            </Text>
                                        </LinearGradient>
                                    );
                                })}
                            </View>
                        )}

                        {activeTab === 'grades' && (
                            <View style={styles.content}>
                                {/* CGPA Card */}
                                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Award size={24} color={c.primary} />
                                        <Text style={styles.cardTitle}>Cumulative GPA</Text>
                                    </View>
                                    <Text style={[styles.bigNumber, { color: c.primary }]}>
                                        {cgpaStats.cgpa}
                                    </Text>
                                    <Text style={styles.cardSub}>
                                        {cgpaStats.totalCredits} credits • {cgpaStats.semesters} semesters
                                    </Text>
                                </LinearGradient>

                                {/* Semester Breakdown */}
                                {semesterResults.sort((a, b) => a.semester - b.semester).map((result, idx) => (
                                    <LinearGradient key={idx} colors={[c.glassBgStart, c.glassBgEnd]} style={styles.subjectCard}>
                                        <View style={styles.subjectHeader}>
                                            <Text style={styles.subjectName}>Semester {result.semester}</Text>
                                            <Text style={[styles.subjectPct, { color: c.primary }]}>
                                                SGPA: {parseFloat(result.sgpa || 0).toFixed(2)}
                                            </Text>
                                        </View>
                                        <Text style={styles.subjectStats}>
                                            {result.subjects?.length || 0} subjects • {result.total_credits || 0} credits
                                        </Text>
                                    </LinearGradient>
                                ))}

                                {semesterResults.length === 0 && (
                                    <View style={styles.emptyState}>
                                        <GraduationCap size={48} color={c.subtext} style={{ opacity: 0.5 }} />
                                        <Text style={styles.emptyText}>No results added yet</Text>
                                        <Text style={styles.emptySubtext}>Add your semester results to calculate CGPA</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}
            </Animated.ScrollView>
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    scrollContent: {
        paddingTop: Layout.header.maxHeight + insets.top + 10,
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    tabRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    tabActive: {
        backgroundColor: c.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: c.subtext,
    },
    tabTextActive: {
        color: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    content: {
        gap: 12,
    },
    card: {
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.glassBorder,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: c.subtext,
        marginBottom: 8,
    },
    bigNumber: {
        fontSize: 42,
        fontWeight: '700',
        marginVertical: 4,
    },
    cardSub: {
        fontSize: 13,
        color: c.subtext,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.glassBorder,
        gap: 6,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: c.text,
    },
    statLabel: {
        fontSize: 12,
        color: c.subtext,
    },
    subjectCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.glassBorder,
    },
    subjectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    subjectName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: c.text,
    },
    subjectPct: {
        fontSize: 16,
        fontWeight: '700',
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        marginBottom: 8,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    subjectStats: {
        fontSize: 12,
        color: c.subtext,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: c.text,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 13,
        color: c.subtext,
        marginTop: 4,
    },
});

export default CalculationsScreen;
