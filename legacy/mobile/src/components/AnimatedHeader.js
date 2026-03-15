import React from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, Layout } from '../theme';
import { ChevronLeft } from 'lucide-react-native';

/**
 * Universal Animated Header Component
 * Ensures consistent header behavior across all screens
 */
const AnimatedHeader = ({
    scrollY,
    title,
    subtitle,
    isDark,
    colors,
    rightComponent,
    onBack,
    badge,
    children
}) => {
    const insets = useSafeAreaInsets();

    // Consistent animations using global Layout constants
    const headerHeight = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [Layout.header.maxHeight + insets.top, Layout.header.minHeight + insets.top],
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

    const backgroundOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 0.95],
        extrapolate: 'clamp'
    });

    const childrenOpacity = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });

    const childrenTranslateY = scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0, -15],
        extrapolate: 'clamp'
    });

    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, -2],
        extrapolate: 'clamp'
    });

    const styles = getStyles(colors, insets);

    return (
        <Animated.View style={[styles.header, { height: headerHeight }]}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: isDark ? theme.palette.background : '#FFFFFF',
                        opacity: backgroundOpacity,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.glassBorder
                    }
                ]}
            />

            {/* Header Content */}
            <Animated.View style={[styles.headerContent, { transform: [{ translateY: headerTranslateY }] }]}>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ChevronLeft size={28} color={colors.text} />
                    </TouchableOpacity>
                )}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Animated.Text style={[styles.headerTitle, { fontSize: titleSize, color: colors.text }]} numberOfLines={1}>
                            {title}
                        </Animated.Text>
                        {badge && (
                            <Animated.View style={[styles.badgeContainer, { opacity: subOpacity, transform: [{ scale: subOpacity }] }]}>
                                <Text style={styles.badgeText}>{badge}</Text>
                            </Animated.View>
                        )}
                    </View>
                    {subtitle && (
                        <Animated.View style={{ height: subHeight, opacity: subOpacity, marginTop: 2 }}>
                            <Text style={[styles.headerSubtitle, { color: colors.subtext }]} numberOfLines={1}>
                                {subtitle}
                            </Text>
                        </Animated.View>
                    )}
                </View>
                {rightComponent && (
                    <View style={styles.rightSection}>
                        {rightComponent}
                    </View>
                )}
            </Animated.View>

            {/* SPACER (Fades out on scroll) - Increased range for better clearance when collapsed */}
            <Animated.View style={{ height: scrollY.interpolate({ inputRange: [0, 80], outputRange: [20, 8], extrapolate: 'clamp' }), opacity: childrenOpacity }} />

            {/* Additional children (e.g., tabs, filters) */}
            {children && (
                <Animated.View style={{
                    opacity: childrenOpacity,
                    transform: [{ translateY: childrenTranslateY }],
                    pointerEvents: scrollY.__getValue && scrollY.__getValue() > 40 ? 'none' : 'auto'
                }}>
                    {children}
                </Animated.View>
            )}
        </Animated.View>
    );
};

const getStyles = (colors, insets) => StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: Layout.header.paddingHorizontal,
        paddingTop: insets.top + 10, // Tighter top for more modern feel
        justifyContent: 'flex-start',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: Layout.header.contentHeight || 80, // Substantially roomier for premium feel
    },
    headerTitle: {
        fontWeight: '900',
        letterSpacing: -1,
        includeFontPadding: false,
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    badgeContainer: {
        marginLeft: 10,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 20, // Capsule shape
        backgroundColor: colors.primary + '12',
        borderWidth: 1,
        borderColor: colors.primary + '25',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '900',
        color: colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    backBtn: {
        marginRight: 12,
        padding: 6,
        marginLeft: -8,
    },
    rightSection: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 20,
        paddingVertical: 4, // Ensures icons stay centered in large area
    }
});

export default AnimatedHeader;

