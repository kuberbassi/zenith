import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

const ShineOverlay = ({ style }) => {
    const { isDark } = useTheme();

    // DYNAMIC OPACITY LOGIC:
    // Light Mode: Needs STRONG highlights to be seen against white/gradients (0.6 - 0.3).
    // Dark Mode: Needs SUBTLE highlights (0.15 - 0.1) as white pops easily on dark.

    // Top Border Opacity
    const borderOpacity = isDark ? 0.15 : 0.6;

    // Gradient Sheen Opacity (Start -> End)
    const sheenStart = isDark ? 0.1 : 0.25;

    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', zIndex: 1 }, style]}>
            {/* Sheen Gradient */}
            <LinearGradient
                colors={[`rgba(255, 255, 255, ${sheenStart})`, 'rgba(255, 255, 255, 0)']}
                style={{ width: '100%', height: '50%' }}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            {/* Distinct Top Highlight Line */}
            <View
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: 1,
                    backgroundColor: `rgba(255, 255, 255, ${borderOpacity})`
                }}
            />

            {/* Subtle Bottom Rim (Maintained) */}
            <View
                style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.1)'
                }}
            />
        </View>
    );
};

export default ShineOverlay;
