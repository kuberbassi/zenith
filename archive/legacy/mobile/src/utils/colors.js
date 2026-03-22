// Centralized AMOLED Theme Color System
export const getThemeColors = (isDark) => ({
    // Backgrounds
    bg: {
        primary: isDark ? '#000000' : '#FFFFFF',
        secondary: isDark ? '#000000' : '#F8F9FA',
        tertiary: isDark ? '#0A0A0A' : '#F1F3F5',
    },

    // Glass/Card Effects
    glass: {
        start: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
        end: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
        border: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    },

    // Text Hierarchy
    text: {
        primary: isDark ? '#FFFFFF' : '#000000',
        secondary: isDark ? '#9CA3AF' : '#6B7280',
        tertiary: isDark ? '#6B7280' : '#9CA3AF',
    },

    // Semantic Colors
    accent: '#FF3B30',
    success: isDark ? '#34C759' : '#10B981',
    warning: isDark ? '#FF9500' : '#F59E0B',
    info: isDark ? '#0A84FF' : '#3B82F6',
    danger: '#FF3B30',

    // Card Backgrounds (for colored cards)
    cardColors: {
        orange: isDark ? ['#FF9500', '#FFCC00'] : ['#FFF4E6', '#FFFAEB'],
        green: isDark ? ['#34C759', '#30D158'] : ['#ECFDF5', '#F0FDF4'],
        purple: isDark ? ['#BF5AF2', '#AF52DE'] : ['#FAF5FF', '#F3E8FF'],
        blue: isDark ? ['#0A84FF', '#64D2FF'] : ['#EFF6FF', '#DBEAFE'],
        red: isDark ? ['#FF3B30', '#FF6B6B'] : ['#FEF2F2', '#FEE2E2'],
    },
});
