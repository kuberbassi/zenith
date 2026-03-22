import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { LinearGradient } from './LinearGradient';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

const OfflineOverlay = ({ isVisible }) => {
    const { isDark } = useTheme();

    if (!isVisible) return null;

    const c = {
        bg: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)',
        text: isDark ? '#FFFFFF' : '#000000',
        subtext: isDark ? '#9CA3AF' : '#6B7280',
        primary: '#0A84FF'
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={isDark ? ['#000', '#111'] : ['#FFF', '#F8F9FA']}
                style={styles.content}
            >
                <WifiOff size={64} color={c.primary} strokeWidth={1.5} />
                <Text style={[styles.title, { color: c.text }]}>No Connection</Text>
                <Text style={[styles.subtitle, { color: c.subtext }]}>
                    Please check your internet settings and try again.
                </Text>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        width: width,
        height: height,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 24,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22,
        opacity: 0.8
    }
});

export default OfflineOverlay;

