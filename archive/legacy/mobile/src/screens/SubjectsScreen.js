
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, RefreshControl } from 'react-native';
import { theme, Layout } from '../theme';
import { useSemester } from '../contexts/SemesterContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import { ChevronRight, Percent, Book, Beaker, Calculator, Atom, Code, FlaskConical } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedHeader from '../components/AnimatedHeader';
import PressableScale from '../components/PressableScale';

const SubjectsScreen = ({ navigation }) => {
    const { isDark, colors: themeColors } = useTheme();
    const insets = useSafeAreaInsets();
    const { selectedSemester } = useSemester();

    // Use dynamic colors from ThemeContext (includes accent-based gradients)
    const c = themeColors;

    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSubjects = async () => {
        try {
            const response = await api.get(`/api/academic/subjects?semester=${selectedSemester}`);
            setSubjects(response.data?.data || response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSubjects();
    }, [selectedSemester]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSubjects();
    };

    const renderItem = ({ item }) => {
        const percentage = item.attendance_percentage || 0;
        const isSafe = percentage >= 75;
        const { Icon, gradient } = getSubjectIcon(item.name);

        return (
            <PressableScale
                style={styles.cardWrapper}
                onPress={() => navigation.navigate('SubjectDetail', { subject: item })}
            >
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.card}>
                    <View style={styles.cardHeader}>
                        <LinearGradient
                            colors={gradient}
                            style={styles.iconBox}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Icon size={22} color="#FFF" />
                        </LinearGradient>
                        <View style={styles.headerText}>
                            <Text style={styles.subjectName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.professor} numberOfLines={1}>{item.professor || 'No Professor Assigned'}</Text>
                        </View>
                        <View style={[styles.percentBadge, { backgroundColor: (isSafe ? c.success : c.danger) + '15' }]}>
                            <Text style={[styles.percentText, { color: isSafe ? c.success : c.danger }]}>
                                {percentage.toFixed(0)}%
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{item.attended_classes || 0}</Text>
                            <Text style={styles.statLabel}>Attended</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{item.total_classes || 0}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={[styles.statValue, { color: percentage < 75 ? c.danger : c.success }]}>
                                {percentage < 75 ?
                                    `+${Math.ceil((0.75 * (item.total_classes || 0) - (item.attended_classes || 0)) / 0.25)}` :
                                    `Safe`
                                }
                            </Text>
                            <Text style={styles.statLabel}>{percentage < 75 ? 'Need' : 'Status'}</Text>
                        </View>
                    </View>
                </LinearGradient>
            </PressableScale>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            <AnimatedHeader
                scrollY={scrollY}
                title="All Subjects"
                subtitle="Attendance Overview"
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            />

            <Animated.FlatList
                data={subjects}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.listContent}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        progressBackgroundColor={isDark ? '#000000' : '#FFFFFF'}
                        progressViewOffset={Layout.header.minHeight + insets.top + 15}
                    />
                }
                ListEmptyComponent={
                    !loading && <View style={styles.emptyContainer}>
                        <Book size={48} color={c.subtext} style={{ opacity: 0.5 }} />
                        <Text style={styles.emptyText}>No subjects found.</Text>
                    </View>
                }
            />
        </View>
    );
};

// Helper for vibrant icons
const getSubjectIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('lab') || lower.includes('practical')) return { Icon: FlaskConical, gradient: theme.gradients.success };
    if (lower.includes('math')) return { Icon: Calculator, gradient: theme.gradients.royal };
    if (lower.includes('physics')) return { Icon: Atom, gradient: theme.gradients.ocean };
    if (lower.includes('chem')) return { Icon: Beaker, gradient: theme.gradients.vibrant };
    if (lower.includes('computer') || lower.includes('code')) return { Icon: Code, gradient: theme.gradients.primary };
    return { Icon: Book, gradient: theme.gradients.magenta };
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    listContent: {
        paddingHorizontal: 16,
        paddingTop: Layout.header.maxHeight + (insets?.top || 20) + 12,
        paddingBottom: 40 + insets.bottom,
        flexDirection: Dimensions.get('window').width > 600 ? 'row' : 'column',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    cardWrapper: {
        marginBottom: 16,
        width: Dimensions.get('window').width > 600 ? '48%' : '100%',
    },
    card: {
        padding: 18,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.glassBorder,
        backgroundColor: c.surface,
        minHeight: 180
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    headerText: {
        flex: 1,
    },
    subjectName: {
        fontSize: 17,
        fontWeight: '800',
        color: c.text,
        letterSpacing: -0.3
    },
    professor: {
        fontSize: 12,
        fontWeight: '600',
        color: c.subtext,
        marginTop: 2
    },
    percentBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    percentText: {
        fontSize: 14,
        fontWeight: '800',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.glassBorder
    },
    stat: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '800',
        color: c.text,
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: c.subtext,
        textTransform: 'uppercase',
        marginTop: 4,
        letterSpacing: 0.5
    },
    divider: {
        width: 1,
        backgroundColor: c.glassBorder,
        height: '100%'
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        gap: 16
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '600',
        color: c.subtext
    }
});

export default SubjectsScreen;



