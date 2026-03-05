import React, { createContext, useContext, useEffect, type ReactNode } from 'react';

type Theme = 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Generate color palette from accent color
function generatePalette(accentHex: string) {
    // Sea Green palette (#3b82f6)
    return {
        '--md-sys-color-primary': accentHex,
        '--md-sys-color-on-primary': '#ffffff',
        '--md-sys-color-primary-container': '#064e3b',
        '--md-sys-color-on-primary-container': '#d1fae5',
        '--md-sys-color-secondary': '#2563eb',
        '--md-sys-color-secondary-container': '#064e3b',
        '--md-sys-color-on-secondary-container': '#d1fae5',
        '--md-sys-color-tertiary': '#60a5fa',
        '--md-sys-color-tertiary-container': '#065f46',
        '--md-sys-color-on-tertiary-container': '#a7f3d0',
    };
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Forced values for Sea Green Refinement
    const theme: Theme = 'dark';
    const accentColor = '#3b82f6';

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light');
        root.classList.add('dark');

        const palette = generatePalette(accentColor);
        Object.entries(palette).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

    }, []);

    // No-op functions for components that still call them
    const toggleTheme = () => { };
    const setTheme = () => { };
    const setAccentColor = () => { };

    const value: ThemeContextType = {
        theme,
        toggleTheme,
        setTheme,
        accentColor,
        setAccentColor
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
