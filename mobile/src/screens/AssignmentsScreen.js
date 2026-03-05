import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert, Animated, RefreshControl, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSemester } from '../contexts/SemesterContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../components/LinearGradient';
import { theme, Layout } from '../theme';
import { Plus, Minus, CheckCircle, Beaker, FileText, Filter } from 'lucide-react-native';
// import api from '../services/api'; // Removed in favor of attendanceService
import { attendanceService } from '../services';
import * as Haptics from 'expo-haptics';
import AnimatedHeader from '../components/AnimatedHeader';

const AssignmentsScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const { selectedSemester } = useSemester();
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All');

    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',

        glassBgStart: isDark ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)',
        glassBgEnd: isDark ? 'rgba(30,31,34,0.85)' : 'rgba(255,255,255,0.85)',
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',

        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',

        primary: theme.palette.green,
        secondary: theme.palette.purple,
        tertiary: theme.palette.orange,
        surface: isDark ? '#121212' : '#FFFFFF',
    };

    useEffect(() => { fetchSubjects(); }, [selectedSemester]);

    const fetchSubjects = async () => {
        try {
            // Fetch subjects for the selected semester
            const data = await attendanceService.getDashboardData(selectedSemester);
            if (data && data.subjects) {
                setSubjects(data.subjects);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to load subjects");
        }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchSubjects();
    };

    const updatePracticals = async (subjectId, updates) => {
        try {
            await attendanceService.updatePracticals(subjectId, updates);
            // Optimistic Update
            setSubjects(prev => prev.map(s => {
                if (s._id === subjectId) {
                    const current = s.practicals || { total: 10, completed: 0, hardcopy: false };
                    return { ...s, practicals: { ...current, ...updates } };
                }
                return s;
            }));
        } catch (e) { Alert.alert("Error", "Update failed"); fetchSubjects(); }
    };

    const updateAssignments = async (subjectId, updates) => {
        try {
            await attendanceService.updateAssignments(subjectId, updates);
            setSubjects(prev => prev.map(s => {
                if (s._id === subjectId) {
                    const current = s.assignments || { total: 4, completed: 0, hardcopy: false };
                    return { ...s, assignments: { ...current, ...updates } };
                }
                return s;
            }));
        } catch (e) { Alert.alert("Error", "Update failed"); fetchSubjects(); }
    };

    const filteredSubjects = subjects.filter(s => {
        // Safe category extraction (handling array or single string)
        const cats = s.categories || (s.category ? [s.category] : ['Theory']);

        // 1. Core Filter: Must have either 'Practical' or 'Assignment' category to show
        const hasWork = cats.includes('Practical') || cats.includes('Assignment');
        if (!hasWork) return false;

        // 2. Tab Filter (if we add tabs later, logic is here)
        if (filter === 'All') return true;
        return cats.includes(filter);
    });

    // Default sort: Theory first, then Lab, then uncategorized
    const sortSubjectsByCategory = (subs) => {
        return [...subs].sort((a, b) => {
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

    const sortedFilteredSubjects = sortSubjectsByCategory(filteredSubjects);

    const renderItem = ({ item }) => {
        const practicals = item.practicals || { total: 10, completed: 0, hardcopy: false };
        const assignments = item.assignments || { total: 4, completed: 0, hardcopy: false };

        // Determine what to show based on subject categories (matching web logic)
        const cats = item.categories || (item.category ? [item.category] : ['Theory']);
        const hasPracticals = cats.includes('Practical');
        const hasAssignments = cats.includes('Assignment');

        // Calculate Progress ONLY for active tracks (matching web)
        let total = 0;
        let completed = 0;
        if (hasPracticals) { total += practicals.total; completed += practicals.completed; }
        if (hasAssignments) { total += assignments.total; completed += assignments.completed; }
        const progress = total > 0 ? (completed / total) * 100 : 0;

        return (
            <View style={styles.card}>
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} noTexture style={StyleSheet.absoluteFill} />
                {/* Progress Bar Top */}
                <View style={{ height: 4, backgroundColor: c.glassBorder, width: '100%', position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' }}>
                    <LinearGradient colors={theme.gradients.success} style={{ height: '100%', width: `${progress}%` }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
                </View>

                <View style={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={[styles.subjectName, { color: c.text }]}>{item.name}</Text>
                        <Text style={[styles.code, { color: c.subtext }]}>{item.code}</Text>
                    </View>

                    {/* Practicals Section */}
                    {hasPracticals && (
                        <View style={{ marginBottom: 16 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: c.subtext }]}>PRACTICALS</Text>
                                <Text style={[styles.counter, { color: c.secondary }]}>{practicals.completed}/{practicals.total}</Text>
                            </View>
                            <View style={styles.controls}>
                                <View style={styles.stepper}>
                                    <TouchableOpacity
                                        onPress={() => updatePracticals(item._id, { completed: Math.max(0, practicals.completed - 1) })}
                                        style={styles.stepBtn}
                                    >
                                        <Minus size={16} color={c.subtext} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updatePracticals(item._id, { completed: Math.min(practicals.total, practicals.completed + 1) })}
                                    >
                                        <LinearGradient colors={theme.gradients.ocean} style={styles.stepBtnActive}>
                                            <Plus size={16} color="#FFF" />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        updatePracticals(item._id, { hardcopy: !practicals.hardcopy });
                                    }}
                                    style={styles.toggleBtn}
                                >
                                    {practicals.hardcopy ? (
                                        <LinearGradient colors={theme.gradients.success} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
                                    ) : (
                                        <View style={[StyleSheet.absoluteFill, { borderRadius: 10, borderWidth: 1, borderColor: c.glassBorder }]} />
                                    )}
                                    <CheckCircle size={14} color={practicals.hardcopy ? "#FFF" : c.subtext} />
                                    <Text style={[styles.toggleText, { color: practicals.hardcopy ? "#FFF" : c.subtext }]}>
                                        {practicals.hardcopy ? 'SUBMITTED' : 'MARK DONE'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Separator if both sections are present */}
                    {hasPracticals && hasAssignments && (
                        <View style={{ height: 1, backgroundColor: c.border, width: '100%', opacity: 0.3, marginBottom: 16 }} />
                    )}

                    {/* Assignments Section */}
                    {hasAssignments && (
                        <View>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: c.subtext }]}>ASSIGNMENTS</Text>
                                <Text style={[styles.counter, { color: c.tertiary }]}>{assignments.completed}/{assignments.total}</Text>
                            </View>
                            <View style={styles.controls}>
                                <View style={styles.stepper}>
                                    <TouchableOpacity
                                        onPress={() => updateAssignments(item._id, { completed: Math.max(0, assignments.completed - 1) })}
                                        style={[styles.stepBtn, { borderColor: c.border }]}
                                    >
                                        <Minus size={16} color={c.subtext} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => updateAssignments(item._id, { completed: Math.min(assignments.total, assignments.completed + 1) })}
                                        style={[styles.stepBtn, { backgroundColor: c.tertiary, borderColor: c.tertiary }]}
                                    >
                                        <Plus size={16} color="#FFF" />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                        updateAssignments(item._id, { hardcopy: !assignments.hardcopy });
                                    }}
                                    style={styles.toggleBtn}
                                >
                                    {assignments.hardcopy ? (
                                        <LinearGradient colors={theme.gradients.success} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} />
                                    ) : (
                                        <View style={[StyleSheet.absoluteFill, { borderRadius: 10, borderWidth: 1, borderColor: c.glassBorder }]} />
                                    )}
                                    <CheckCircle size={14} color={assignments.hardcopy ? "#FFF" : c.subtext} />
                                    <Text style={[styles.toggleText, { color: assignments.hardcopy ? "#FFF" : c.subtext }]}>
                                        {assignments.hardcopy ? 'SUBMITTED' : 'MARK DONE'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const styles = StyleSheet.create({
        card: {
            borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: c.glassBorder, overflow: 'hidden',
            backgroundColor: c.surface,
            shadowColor: "#000", shadowOffset: { height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
        },
        subjectName: { fontSize: 18, fontWeight: '800', flex: 1, letterSpacing: -0.5 },
        code: { fontSize: 12, fontWeight: '700', opacity: 0.6 },
        sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
        sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
        counter: { fontSize: 12, fontWeight: '900' },
        controls: { flexDirection: 'row', gap: 12 },
        stepper: { flexDirection: 'row', gap: 8, flex: 1 },
        stepBtn: {
            width: 44, height: 40, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder,
            alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        },
        stepBtnActive: {
            width: 44, height: 40, borderRadius: 12,
            alignItems: 'center', justifyContent: 'center',
        },
        toggleBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderRadius: 12, height: 40, position: 'relative'
        },
        toggleText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }
    });

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFill} />
            <AnimatedHeader
                title="Assignments"
                subtitle="TRACK YOUR WORK"
                scrollY={scrollY}
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            >
                {/* Filter Tabs - Styled like Skills Page */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 12, gap: 10, marginTop: 8 }}
                >
                    {[
                        { id: 'All', color: ['#0A84FF', '#3DA5FF'] },
                        { id: 'Assignment', color: ['#FF9500', '#FFAD33'] },
                        { id: 'Practical', color: ['#34C759', '#5CD97A'] }
                    ].map(tab => (
                        <TouchableOpacity
                            key={tab.id}
                            onPress={() => { setFilter(tab.id); Haptics.selectionAsync(); }}
                            style={{ borderRadius: 20, overflow: 'hidden' }}
                        >
                            {filter === tab.id ? (
                                <LinearGradient
                                    colors={tab.color}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 16,
                                        shadowColor: tab.color[0],
                                        shadowOpacity: 0.35,
                                        shadowRadius: 8,
                                        elevation: 5
                                    }}
                                >
                                    <Text style={{
                                        color: '#FFF',
                                        fontSize: 13,
                                        fontWeight: '800',
                                        letterSpacing: 0.5
                                    }}>
                                        {tab.id}
                                    </Text>
                                </LinearGradient>
                            ) : (
                                <View style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
                                }}>
                                    <Text style={{
                                        color: c.subtext,
                                        fontSize: 13,
                                        fontWeight: '700',
                                        letterSpacing: 0.5
                                    }}>
                                        {tab.id}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </AnimatedHeader>

            <Animated.FlatList
                contentContainerStyle={{ padding: 20, paddingBottom: 100 + insets.bottom, paddingTop: 140 + insets.top }} // Adjusted padding for new header
                data={sortedFilteredSubjects}
                renderItem={renderItem}
                keyExtractor={item => item._id}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.text}
                        colors={[isDark ? theme.palette.purple : theme.light.primary]}
                        progressBackgroundColor={isDark ? '#121212' : '#FFFFFF'}
                        progressViewOffset={Layout.header.minHeight + insets.top + 15}
                    />
                }
            />
        </View>
    );
};

export default AssignmentsScreen;



