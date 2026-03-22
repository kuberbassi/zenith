import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import ShineOverlay from './ShineOverlay';

export const LinearGradient = ({ children, style, noTexture = false, ...props }) => {
    // Extract border radius from style to ensure ShineOverlay matches the shape
    const flatStyle = StyleSheet.flatten(style) || {};
    const {
        borderRadius,
        borderTopLeftRadius, borderTopRightRadius,
        borderBottomLeftRadius, borderBottomRightRadius,
        borderTopStartRadius, borderTopEndRadius,
        borderBottomStartRadius, borderBottomEndRadius
    } = flatStyle;

    const radiusStyle = {
        borderRadius,
        borderTopLeftRadius, borderTopRightRadius,
        borderBottomLeftRadius, borderBottomRightRadius,
        borderTopStartRadius, borderTopEndRadius,
        borderBottomStartRadius, borderBottomEndRadius
    };

    return (
        <ExpoLinearGradient style={[style, { overflow: 'hidden' }]} {...props}>
            {!noTexture && <ShineOverlay style={radiusStyle} />}
            {children}
        </ExpoLinearGradient>
    );
};
