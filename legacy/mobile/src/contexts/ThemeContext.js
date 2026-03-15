import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

import { theme } from '../theme';

// Helper to create a lighter/darker shade of a color
const adjustColor = (color, percent) => {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
};

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(false);
    const [accentColor, setAccentColor] = useState(theme.palette.purple);

    useEffect(() => {
        const loadTheme = async () => {
            const savedTheme = await AsyncStorage.getItem('user_theme');
            const savedAccent = await AsyncStorage.getItem('user_accent');
            if (savedTheme !== null) setIsDark(savedTheme === 'dark');
            if (savedAccent !== null) setAccentColor(savedAccent);
        };
        loadTheme();
    }, []);

    const toggleTheme = async () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        await AsyncStorage.setItem('user_theme', newTheme ? 'dark' : 'light');
    };

    const updateAccent = async (color) => {
        setAccentColor(color);
        await AsyncStorage.setItem('user_accent', color);
    };

    // Generate dynamic gradients based on accent color
    const accentGradients = useMemo(() => {
        const lighter = adjustColor(accentColor, 20);
        const darker = adjustColor(accentColor, -20);
        return {
            primary: [accentColor, lighter],
            accent: [accentColor, adjustColor(accentColor, 40)],
            royal: [accentColor, theme.palette.blue],
            vibrant: [accentColor, theme.palette.magenta, theme.palette.orange],
        };
    }, [accentColor]);

    // Computes the current theme colors with dynamic accent and gradients
    const currentColors = useMemo(() => {
        const base = isDark ? theme.dark : theme.light;
        return {
            ...base,
            primary: accentColor,
            heroCardBg: accentColor,
            gradients: {
                ...base.gradients,
                ...accentGradients,
            },
        };
    }, [isDark, accentColor, accentGradients]);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, accentColor, updateAccent, colors: currentColors, accentGradients }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
