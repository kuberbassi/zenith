import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PressableScale from './PressableScale';
import { theme } from '../theme';
import { LinearGradient } from './LinearGradient';

const EnhancedSubjectCard = ({ subject, onPress, isDark, threshold: propThreshold, onMark }) => {
    // Aquamorphic Palette
    const c = {
        glassBgStart: isDark ? 'rgba(43, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        glassBgEnd: isDark ? 'rgba(43, 45, 48, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        glassBorder: isDark ? theme.palette.border : 'rgba(0,0,0,0.08)',

        text: isDark ? theme.palette.text : '#1E1F22',
        subtext: isDark ? theme.palette.subtext : '#636366',

        success: theme.palette.green,
        danger: theme.palette.red,

        iconBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        warning: theme.palette.orange,
    };

    const styles = getStyles(c, isDark);

    const pct = parseFloat(subject.attendance_percentage || 0);
    const attended = subject.attended || subject.attended_classes || 0;
    const total = subject.total || subject.total_classes || 0;

    const threshold = propThreshold || 0.75;
    let statsValue = '0';
    let statsLabel = 'SKIPS';
    let statsColor = c.success;

    const current = total > 0 ? attended / total : 0;

    if (current >= threshold) {
        const skips = Math.floor((attended - threshold * total) / threshold);
        statsValue = skips.toString();
        statsLabel = 'SKIPS';
        statsColor = c.success;
    } else {
        const needed = Math.ceil((threshold * total - attended) / (1 - threshold));
        statsValue = needed.toString();
        statsLabel = 'ATTEND';
        statsColor = c.danger;
    }

    return (
        <PressableScale onPress={onPress}>
            <LinearGradient
                colors={isDark ? theme.gradients.cardDark : ['#FFFFFF', '#F8F9FA']}
                style={styles.card}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <View style={styles.iconBox}>
                        <Text style={{ fontSize: 24 }}>📘</Text>
                    </View>
                    <View style={styles.titleContent}>
                        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{subject.name}</Text>
                        <Text style={styles.professor} numberOfLines={1} ellipsizeMode="tail">{subject.professor || 'No Professor'}</Text>
                    </View>

                    {/* Fluid Ring Badge */}
                    <LinearGradient
                        colors={pct < (threshold * 100) ? theme.gradients.danger : theme.gradients.success}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.percentBadge}
                    >
                        <View style={styles.percentInner}>
                            <Text style={styles.percentText}>
                                {pct.toFixed(0)}
                                <Text style={{ fontSize: 10 }}>%</Text>
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Status Message (Bunk Guard) */}
                <View style={styles.statusFooter}>
                    <Text style={[styles.statusMsg, { color: pct < (threshold * 100) ? c.danger : c.success }]}>
                        {subject.status_message || (pct < (threshold * 100) ? `Attend next class` : 'Safe to bunk')}
                    </Text>
                </View>

                {/* Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCol}>
                        <Text style={styles.statValue}>{attended}</Text>
                        <Text style={styles.statLabel}>ATTENDED</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statCol}>
                        <Text style={styles.statValue}>{total}</Text>
                        <Text style={styles.statLabel}>TOTAL</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statCol}>
                        <Text style={[styles.statValue, { color: statsColor }]}>{statsValue}</Text>
                        <Text style={[styles.statLabel, { color: statsColor }]}>{statsLabel}</Text>
                    </View>
                </View>

            </LinearGradient>
        </PressableScale>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    card: {
        borderRadius: 28,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: c.glassBorder,
        // Stronger Shadow for Visibility
        shadowColor: isDark ? '#000' : '#4A5568',
        shadowOffset: { width: 0, height: 12 }, // Deeper offset
        shadowOpacity: isDark ? 0.6 : 0.25,     // Much higher opacity for light mode
        shadowRadius: 24,                       // Softer spread
        elevation: 12,                          // Higher android elevation
        backgroundColor: isDark ? '#2B2D30' : '#FFFFFF' // Ensure solid background for shadow
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 20,
        backgroundColor: c.iconBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
        borderColor: c.glassBorder
    },
    titleContent: {
        flex: 1,
        marginRight: 12,
        justifyContent: 'center'
    },
    name: {
        fontSize: 18,
        fontWeight: '800',
        color: c.text,
        marginBottom: 4,
        letterSpacing: -0.5
    },
    professor: {
        fontSize: 13,
        color: c.subtext,
        fontWeight: '600'
    },
    percentBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        padding: 2, // Border effect from gradient
        overflow: 'hidden',
    },
    percentInner: {
        flex: 1,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)', // Subtle overlay
    },
    percentText: {
        fontWeight: '900',
        fontSize: 16,
        color: '#FFFFFF', // High contrast on gradient
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: c.glassBorder
    },
    statCol: {
        alignItems: 'center',
        flex: 1
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: c.text,
        marginBottom: 2
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: c.subtext,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    divider: {
        width: 1,
        height: '60%',
        backgroundColor: c.glassBorder,
        alignSelf: 'center'
    },
    statusFooter: {
        marginBottom: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        borderWidth: 1,
        borderColor: c.glassBorder,
    },
    statusMsg: {
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.2
    },
});

export default React.memo(EnhancedSubjectCard);

