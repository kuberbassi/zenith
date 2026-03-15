import React, { useRef, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, Platform,
    StatusBar, useTheme as useRNTheme, ScrollView, TouchableOpacity,
    Animated, Dimensions, RefreshControl
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, Layout } from '../theme';
import { GraduationCap, Zap, BookOpen, ChevronRight, Beaker, LayoutGrid, Clock } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import AnimatedHeader from '../components/AnimatedHeader';
import PressableScale from '../components/PressableScale';

const { width } = Dimensions.get('window');

const AcademicScreen = ({ navigation }) => {
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);

    // JetBrains Vibrant Palette
    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F7F8FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',

        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',

        // Card Colors with gradients (JetBrains Palette)
        cards: {
            results: {
                bg: isDark ? theme.gradients.vibrant : ['#FFF4E6', '#FFFAEB'],
                icon: theme.gradients.vibrant,
                text: isDark ? '#FFFFFF' : '#1E1F22',
                subtext: isDark ? 'rgba(255,255,255,0.8)' : '#92400E'
            },
            assignments: {
                bg: isDark ? theme.gradients.success : ['#ECFDF5', '#F0FDF4'],
                icon: theme.gradients.success,
                text: isDark ? '#FFFFFF' : '#1E1F22',
                subtext: isDark ? 'rgba(255,255,255,0.8)' : '#065F46'
            },
            skills: {
                bg: isDark ? theme.gradients.ocean : ['#FAF5FF', '#F3E8FF'],
                icon: theme.gradients.ocean,
                text: isDark ? '#FFFFFF' : '#1E1F22',
                subtext: isDark ? 'rgba(255,255,255,0.8)' : '#6B21A8'
            },
            courses: {
                bg: isDark ? theme.gradients.primary : ['#EFF6FF', '#DBEAFE'],
                icon: theme.gradients.primary,
                text: isDark ? '#FFFFFF' : '#1E1F22',
                subtext: isDark ? 'rgba(255,255,255,0.8)' : '#1E40AF'
            }
        }
    };

    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const menuItems = [
        {
            id: 'Results',
            name: 'Results',
            description: 'CGPA & Grades',
            icon: GraduationCap,
            colors: c.cards.results,
            route: 'Results',
        },
        {
            id: 'Assignments',
            name: 'Assignments',
            description: 'Practicals & Tasks',
            icon: Beaker,
            colors: c.cards.assignments,
            route: 'Assignments',
        },
        {
            id: 'SkillTracker',
            name: 'Skills',
            description: 'Track Your Growth',
            icon: Zap,
            colors: c.cards.skills,
            route: 'SkillTracker',
        },
        {
            id: 'CourseManager',
            name: 'Courses',
            description: 'Online Learning',
            icon: BookOpen,
            colors: c.cards.courses,
            route: 'CourseManager',
        },
    ];

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

            {/* BACKGROUND GRADIENT */}
            <LinearGradient
                colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]}
                noTexture style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* UNIVERSAL ANIMATED HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Academic"
                subtitle="EXCELLENCE HUB"
                isDark={isDark}
                colors={{ text: c.text, subtext: c.subtext }}
                rightComponent={
                    <PressableScale style={styles.iconBoxSmall}>
                        <LayoutGrid size={22} color={c.text} />
                    </PressableScale>
                }
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
                        onRefresh={() => {
                            setRefreshing(true);
                            setTimeout(() => setRefreshing(false), 500);
                        }}
                        tintColor={c.text}
                        colors={[isDark ? theme.palette.purple : theme.light.primary]}
                        progressBackgroundColor={isDark ? '#121212' : '#FFFFFF'}
                        progressViewOffset={Layout.header.minHeight + insets.top + 15}
                    />
                }
            >
                <View style={{ height: Layout.header.maxHeight + insets.top - 20 }} />

                <View style={styles.grid}>
                    {menuItems.map((item) => (
                        <PressableScale
                            key={item.id}
                            onPress={() => item.route && navigation.navigate(item.route)}
                            style={styles.cardWrapper}
                        >
                            <LinearGradient
                                colors={item.colors.bg}
                                style={styles.card}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 0.3, y: 1 }}
                            >
                                {/* Icon with gradient */}
                                <LinearGradient
                                    colors={item.colors.icon}
                                    style={styles.iconBox}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <item.icon size={28} color="#FFF" strokeWidth={2} />
                                </LinearGradient>

                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: item.colors.text }]}>
                                        {item.name}
                                    </Text>
                                    <Text style={[styles.cardDesc, { color: item.colors.subtext }]}>
                                        {item.description}
                                    </Text>
                                </View>

                                <View style={styles.arrowBox}>
                                    <ChevronRight size={20} color={item.colors.subtext} opacity={0.6} />
                                </View>
                            </LinearGradient>
                        </PressableScale>
                    ))}
                </View>

                {/* Info Banner */}
                <View style={styles.infoBox}>
                    <Clock size={14} color={c.subtext} opacity={0.6} />
                    <Text style={[styles.infoText, { color: c.subtext }]}>
                        More academic tools coming soon.
                    </Text>
                </View>

                <View style={{ height: insets.bottom + 20 }} />
            </Animated.ScrollView>
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    iconBoxSmall: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100 + insets.bottom
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    cardWrapper: {
        width: (width - 40 - 16) / 2,
        marginBottom: 0,
    },
    card: {
        height: 165,
        borderRadius: 28,
        padding: 18,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 10,
        elevation: 4
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    cardContent: {
        marginTop: 8,
        flex: 1
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: -0.3
    },
    cardDesc: {
        fontSize: 11,
        fontWeight: '600',
        opacity: 0.85,
        letterSpacing: 0.2
    },
    arrowBox: {
        position: 'absolute',
        top: 18,
        right: 18,
    },
    infoBox: {
        marginTop: 32,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    },
    infoText: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.7
    }
});

export default AcademicScreen;



