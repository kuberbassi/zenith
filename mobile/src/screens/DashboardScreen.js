import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, RefreshControl,
    Platform, StatusBar, Animated, Dimensions, Alert, ScrollView as RNScrollView
} from 'react-native';
import * as Haptics from 'expo-haptics';
import PressableScale from '../components/PressableScale';

const ScrollView = RNScrollView;
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
import { useTheme } from '../contexts/ThemeContext';
import { theme, Layout } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { attendanceService, academicService } from '../services';
import { NotificationService } from '../services/NotificationService';
import { Plus, Book, Calendar, ChevronRight, Bell, Clock, CheckCircle2, XCircle, MinusCircle, Settings, Bot } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import SemesterSelector from '../components/SemesterSelector';
import EnhancedSubjectCard from '../components/EnhancedSubjectCard';
import AddSubjectModal from '../components/AddSubjectModal';
import AnimatedHeader from '../components/AnimatedHeader';
import { LinearGradient } from '../components/LinearGradient';
import { useSemester } from '../contexts/SemesterContext';
import UserAvatar from '../components/UserAvatar';

const DashboardScreen = ({ navigation }) => {
    const { user } = useAuth();
    const { isDark, colors: themeColors } = useTheme();
    const { selectedSemester, updateSemester } = useSemester();
    const insets = useSafeAreaInsets();
    const nav = useNavigation(); // Added useNavigation hook

    // Use dynamic colors from ThemeContext (includes accent-based gradients)
    const c = themeColors;

    const styles = getStyles(c, isDark);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);

    // Initial Setup
    useEffect(() => {
        NotificationService.registerForPushNotificationsAsync();
    }, []);

    const fetchDashboardData = async (force = false) => {
        try {
            // Fetch dashboard data + silently warm notice cache in parallel + fetch user stats 
            const [data] = await Promise.all([
                attendanceService.getDashboardData(selectedSemester, force),
                attendanceService.getNotices(false).catch(() => null), // silent prefetch
            ]);
            setDashboardData(data);

            if (data?.subjects) {
                NotificationService.checkAndNotify(data.subjects, threshold);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            Alert.alert('Error', 'Failed to load dashboard data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [selectedSemester])
    );

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchDashboardData(true);
    }

    const handleSaveSubject = async (data) => {
        try {
            if (editingSubject) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (data.isOverride) {
                    await attendanceService.updateAttendanceCount(
                        data.subject_id,
                        data.attended,
                        data.total
                    );
                }
                await attendanceService.updateSubjectFullDetails(data.subject_id, data);
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await attendanceService.addSubject(data);
            }
            setModalVisible(false);
            setEditingSubject(null);
            fetchDashboardData();
        } catch (error) {
            console.error("Save subject failed", error);
            Alert.alert('Error', 'Failed to save subject. Please check your connection.');
        }
    };

    const handleDeleteSubject = async (subjectId) => {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await attendanceService.deleteSubject(subjectId);
            setModalVisible(false);
            setEditingSubject(null);
            fetchDashboardData();
        } catch (error) {
            console.error("Delete subject failed", error);
            Alert.alert('Error', 'Failed to delete subject.');
        }
    };

    const handleMarkAttendance = async (subjectId, status) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await attendanceService.markAttendance(subjectId, status);
            fetchDashboardData();
        } catch (error) {
            console.error("Mark attendance failed", error);
            Alert.alert('Error', 'Failed to mark attendance.');
        }
    };

    const threshold = user?.attendance_threshold || 75;
    const overallAttendance = dashboardData?.overall_attendance || 0;
    const isAtRisk = overallAttendance < threshold;
    const userName = user?.name?.split(' ')[0] || 'Friend';
    const dateText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });


    // HEADER ANIMATIONS
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [Layout.header.maxHeight, Layout.header.minHeight],
        extrapolate: 'clamp'
    });

    const titleSize = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [Layout.header.maxTitleSize, Layout.header.minTitleSize],
        extrapolate: 'clamp'
    });

    const subOpacity = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });

    const subHeight = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [20, 0],
        extrapolate: 'clamp'
    });

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const hasUnread = dashboardData?.subjects?.some(s => s.status_message?.includes('Attend')) || false;

    // Default sort: Theory first, then Lab, then uncategorized
    const sortSubjectsByCategory = (subjects) => {
        if (!Array.isArray(subjects)) return [];
        return [...subjects].sort((a, b) => {
            const getCategoryPriority = (sub) => {
                const cats = sub.categories || [];
                if (cats.includes('Theory')) return 0;
                if (cats.includes('Lab')) return 1;
                if (cats.length === 0) return 2;
                return 1; // Other categories treated as Lab-level priority
            };
            return getCategoryPriority(a) - getCategoryPriority(b);
        });
    };

    // Animations
    const heroAnim = useRef(new Animated.Value(0)).current; // Opacity & TranslateY
    const statsAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.stagger(150, [
            Animated.spring(heroAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            Animated.spring(statsAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
        ]).start();
    }, []);

    const heroStyle = {
        opacity: heroAnim,
        transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
    };

    const statsStyle = {
        opacity: statsAnim,
        transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
    };

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* FULL SCREEN FLUID GRADIENT BACKGROUND */}
            <LinearGradient
                colors={[c.background, c.surface, c.background]}
                noTexture style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* UNIVERSAL ANIMATED HEADER */}
            {/* Content placeholder - AnimatedHeader moved to bottom for layering */}

            <AnimatedScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        progressBackgroundColor={c.surface}
                        progressViewOffset={Layout.header.maxHeight + insets.top}
                    />
                }
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ height: Layout.header.maxHeight + insets.top - 50 }} />

                {/* LIQUID HERO CARD */}
                <Animated.View style={heroStyle}>
                    <LinearGradient
                        colors={isAtRisk
                            ? c.gradients.poppy || ['#FF318C', '#FF8F3F', '#FFEF5A']
                            : c.gradients.vibrant}
                        style={[styles.heroCard, { overflow: 'hidden' }]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
                    >
                        <View style={styles.heroInner}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.heroLabel}>AVERAGE ATTENDANCE</Text>
                                <View style={styles.heroValueRow}>
                                    <Text style={styles.heroValue}>{overallAttendance.toFixed(1)}</Text>
                                    <Text style={styles.heroSymbol}>%</Text>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressBg}>
                                    <View style={[styles.progressFill, { width: `${overallAttendance}%`, backgroundColor: '#FFFFFF' }]} />
                                </View>
                                <Text style={styles.progressText}>{overallAttendance.toFixed(1)}% Attended</Text>
                            </View>

                            <View style={[styles.statusPill, { borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                                <Text style={styles.statusText}>
                                    {isAtRisk ? 'At Risk' : 'On Track'}
                                </Text>
                            </View>
                        </View>

                        {/* Decorative Graphic */}
                        <View style={styles.ringContainer}>
                            <LinearGradient
                                colors={isAtRisk
                                    ? ['#FFFFFF', '#ffffff00']
                                    : [c.success || '#34C759', '#ffffff00']}
                                style={[styles.ring, isAtRisk && { opacity: 0.4 }]}
                            />
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* STATS ROW */}
                <Animated.View style={[styles.statsRow, statsStyle, { flexWrap: 'nowrap' }]}>
                    <LinearGradient
                        colors={c.gradients.card}
                        style={styles.statCard}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.statLabel} numberOfLines={1}>Subjects</Text>
                                <Text style={styles.statValue}>{dashboardData?.total_subjects || 0}</Text>
                            </View>
                            <View style={styles.iconCircleSmall}>
                                <Book size={18} color={c.primary} />
                            </View>
                        </View>
                    </LinearGradient>



                    <PressableScale
                        style={{ flex: 1.1, minWidth: 120 }}
                        onPress={() => {
                            setEditingSubject(null);
                            setModalVisible(true);
                        }}
                        hapticStyle="medium"
                    >
                        <LinearGradient
                            colors={isDark ? ['#2B2D30', '#1E1F22'] : ['#F0F0F0', '#E5E5E5']}
                            style={styles.addCourseBtn}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <LinearGradient
                                colors={c.gradients.primary}
                                style={styles.addCourseIconBox}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Plus size={22} color="#FFF" strokeWidth={2.5} />
                            </LinearGradient>
                            <View style={{ justifyContent: 'center' }}>
                                <Text style={styles.addCourseLabel} numberOfLines={1}>Add New</Text>
                                <Text style={styles.addCourseSub} numberOfLines={1}>Subject</Text>
                            </View>
                        </LinearGradient>
                    </PressableScale>
                </Animated.View>


                {/* SECTION TITLE & FILTER */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Courses</Text>
                    <SemesterSelector
                        selectedSemester={selectedSemester}
                        onSelect={updateSemester}
                        isDark={isDark}
                    />
                </View>

                {/* GLASS SUBJECT LIST */}
                <View style={styles.list}>
                    {sortSubjectsByCategory(dashboardData?.subjects || []).map((subject, index) => (
                        <EnhancedSubjectCard
                            key={`subj_item_${subject._id?.$oid || subject._id}_${index}`}
                            subject={subject}
                            isDark={isDark}
                            threshold={threshold / 100}
                            onPress={() => {
                                setEditingSubject(subject);
                                setModalVisible(true);
                            }}
                        />
                    ))}

                    {(!dashboardData?.subjects || dashboardData.subjects.length === 0) && !loading && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No fluid in this container.</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 80 + insets.bottom }} />
            </AnimatedScrollView>

            {/* UNIVERSAL ANIMATED HEADER - MOVED TO FRONT LAYER */}
            <AnimatedHeader
                scrollY={scrollY}
                title={getGreeting()}
                subtitle={`Welcome back, ${userName}!`}
                isDark={isDark}
                colors={c}
                rightComponent={
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <PressableScale
                            onPress={() => navigation.navigate('AiBot')}
                            style={styles.bellBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Bot size={24} color={c.text} />
                        </PressableScale>

                        <PressableScale
                            onPress={() => navigation.navigate('Notifications')}
                            style={styles.bellBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Bell size={24} color={c.text} />
                            {hasUnread && <View style={styles.badgeDot} />}
                        </PressableScale>

                        <PressableScale
                            onPress={() => navigation.navigate('SettingsTab')}
                            style={styles.profileBtn}
                        >
                            <UserAvatar user={user} size={38} colors={c} />
                        </PressableScale>
                    </View>
                }
            />

            <AddSubjectModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    setEditingSubject(null);
                }}
                onSave={handleSaveSubject}
                onDelete={handleDeleteSubject}
                initialData={editingSubject}
                isDark={isDark}
            />
        </View>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 24,
        paddingBottom: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 50,
    },
    headerContent: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 4
    },
    headerTitle: {
        fontWeight: '900',
        color: c.text,
        letterSpacing: -1,
        includeFontPadding: false
    },
    headerSub: {
        fontSize: 14,
        fontWeight: '600',
        color: c.subtext,
        textTransform: 'uppercase',
        marginTop: 0,
        letterSpacing: 1
    },
    profileBtn: {
        marginBottom: 8,
        marginLeft: 16
    },
    avatarGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center'
    },
    avatarText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 18
    },
    bellBtn: {
        marginBottom: 8,
        marginLeft: 12,
        justifyContent: 'center',
        position: 'relative'
    },
    badgeDot: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: c.danger
    },
    // Content
    scrollContent: {
        paddingHorizontal: Dimensions.get('window').width > 600 ? 40 : 20,
        paddingBottom: 40
    },
    heroCard: {
        borderRadius: 36,
        padding: 28,
        height: Dimensions.get('window').width > 600 ? 250 : 210,
        marginBottom: 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20
    },
    heroInner: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        zIndex: 2
    },
    ringContainer: {
        position: 'absolute',
        right: -60,
        top: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        zIndex: 1,
        opacity: 0.25
    },
    ring: {
        flex: 1,
        borderRadius: 90
    },
    heroLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.85)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4
    },
    heroValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    heroValue: {
        fontSize: Dimensions.get('window').width > 600 ? 80 : 60,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -3
    },
    heroSymbol: {
        fontSize: 24,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginLeft: 4,
        marginBottom: 12
    },
    progressBg: {
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 5,
        marginTop: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    progressFill: {
        height: '100%',
        borderRadius: 5,
    },
    progressText: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 8,
        letterSpacing: 0.5
    },
    statusPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.6)',
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignSelf: 'flex-start',
        marginTop: 4
    },
    statusText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.8,
        textTransform: 'uppercase'
    },
    // Stats
    statsRow: {
        flexDirection: 'row',
        flexWrap: Dimensions.get('window').width > 600 ? 'nowrap' : 'wrap',
        paddingHorizontal: Layout.screenPadding,
        gap: 12,
        marginBottom: 32,
        marginTop: 8
    },
    statCard: {
        flex: 1,
        borderRadius: 24,
        padding: 16,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: c.glassBorder,
        minHeight: 100,
        shadowColor: isDark ? '#000' : '#E5E5E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: c.subtext,
        marginBottom: 2,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        flexWrap: 'wrap'
    },
    statValue: {
        fontSize: 24, // Reduced from 32 to prevent wrapping
        fontWeight: '900',
        color: c.text,
        letterSpacing: -1
    },
    // Add Course Button
    addCourseBtn: {
        flex: 1,
        borderRadius: 24,
        padding: 12, // Tighter padding
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.glassBorder,
        gap: 12, // Reduced gap
        height: '100%',
        minHeight: 100
    },
    addCourseIconBox: {
        width: 48, height: 48,
        borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: c.primary, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4
    },
    addCourseLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: c.text,
        marginBottom: 2
    },
    addCourseSub: {
        marginTop: 1,
        color: c.subtext,
        fontSize: 11,
        fontWeight: '600'
    },
    // List
    sectionHeader: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: c.text,
        letterSpacing: -0.5,
        marginBottom: 16
    },
    list: {
        flexDirection: Dimensions.get('window').width > 800 ? 'row' : 'column',
        flexWrap: Dimensions.get('window').width > 800 ? 'wrap' : 'nowrap',
        gap: 16,
        paddingBottom: 40,
        // Ensure items stretch
        alignItems: 'stretch'
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        width: '100%'
    },
    emptyText: {
        color: c.subtext,
        fontSize: 15
    },
});

export default DashboardScreen;



