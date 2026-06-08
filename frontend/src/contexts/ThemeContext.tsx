import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = localStorage.getItem('zenith_theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return 'light';
    });

    const [accentColor, setAccentColorState] = useState(() => {
        return theme === 'dark' ? '#ecece9' : '#1d1c1a';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.remove('light');
            root.classList.add('dark');
            setAccentColorState('#ecece9');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
            setAccentColorState('#1d1c1a');
        }
        localStorage.setItem('zenith_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    };

    const setTheme = (t: Theme) => {
        setThemeState(t);
    };

    const setAccentColor = (color: string) => {
        setAccentColorState(color);
    };

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
