import React, { useRef, useCallback } from 'react';
import { Animated, TouchableOpacity, StyleSheet, Platform } from 'react-native';

import * as Haptics from 'expo-haptics';

const PressableScale = ({ children, onPress, style, scaleTo = 0.95, friction = 8, tension = 45, activeOpacity = 0.9, disabled, ...props }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        // Dynamic Haptics
        if (props.hapticStyle === 'medium') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (props.hapticStyle === 'heavy') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (props.hapticStyle === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (props.hapticStyle === 'error') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (props.hapticStyle !== 'none') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        Animated.spring(scaleAnim, {
            toValue: scaleTo,
            friction,
            tension,
            useNativeDriver: true,
        }).start();
    }, [props.hapticStyle, scaleTo, friction, tension]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction,
            tension,
            useNativeDriver: true,
        }).start();
    }, [friction, tension]);

    // Flatten style to safely access properties for inheritance
    const flatStyle = StyleSheet.flatten(style) || {};

    return (
        <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            activeOpacity={activeOpacity}
            disabled={disabled}
            style={style}
            hitSlop={props.hitSlop}
            delayPressIn={0}
            {...props}
        >
            <Animated.View style={[
                { transform: [{ scale: scaleAnim }] },
                // Inherit layout properties to ensure children align correctly
                flatStyle.flexDirection ? { flexDirection: flatStyle.flexDirection } : null,
                flatStyle.alignItems ? { alignItems: flatStyle.alignItems } : null,
                flatStyle.justifyContent ? { justifyContent: flatStyle.justifyContent } : null,
                flatStyle.flex ? { flex: 1 } : null,
                // Ensure the animated view fills parent if it has fixed dimensions
                flatStyle.width ? { width: '100%' } : null,
                flatStyle.height ? { height: '100%' } : null
            ]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

export default PressableScale;
