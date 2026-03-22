/**
 * Advanced Theme System with Color Switching
 * Supports dark/light modes with custom color palettes
 */

import { saveData, getData } from './offlineStorage';

// Define color palettes
export const COLOR_PALETTES = {
  DEFAULT: {
    name: 'Default (Blue)',
    primary: '#3B82F6',
    secondary: '#8B5CF6',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
  },
  OCEAN: {
    name: 'Ocean (Teal)',
    primary: '#0891B2',
    secondary: '#0E7490',
    accent: '#06B6D4',
    success: '#14B8A6',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#0891B2',
  },
  FOREST: {
    name: 'Forest (Green)',
    primary: '#059669',
    secondary: '#047857',
    accent: '#10B981',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#06B6D4',
  },
  SUNSET: {
    name: 'Sunset (Orange)',
    primary: '#EA580C',
    secondary: '#DC2626',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#EA580C',
    error: '#DC2626',
    info: '#06B6D4',
  },
  PURPLE: {
    name: 'Purple (Grape)',
    primary: '#9333EA',
    secondary: '#7E22CE',
    accent: '#D946EF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
  },
};

export const LIGHT_THEME = {
  mode: 'light',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  surfaceVariant: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  card: '#FFFFFF',
  input: '#F9FAFB',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const DARK_THEME = {
  mode: 'dark',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  border: '#475569',
  borderLight: '#334155',
  card: '#1E293B',
  input: '#334155',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

class ThemeService {
  constructor() {
    this.currentMode = 'dark';
    this.currentPalette = COLOR_PALETTES.DEFAULT;
    this.listeners = [];
    this.loadThemePreference();
  }

  /**
   * Load saved theme preference
   */
  loadThemePreference() {
    const saved = getData('theme_preference');
    if (saved) {
      this.currentMode = saved.mode || 'dark';
      this.currentPalette = COLOR_PALETTES[saved.palette] || COLOR_PALETTES.DEFAULT;
    }
  }

  /**
   * Get current complete theme
   */
  getTheme() {
    const baseTheme = this.currentMode === 'dark' ? DARK_THEME : LIGHT_THEME;
    return {
      ...baseTheme,
      ...this.currentPalette,
      mode: this.currentMode,
    };
  }

  /**
   * Get specific color
   */
  getColor(key) {
    const theme = this.getTheme();
    return theme[key];
  }

  /**
   * Toggle between dark and light modes
   */
  toggleMode() {
    this.currentMode = this.currentMode === 'dark' ? 'light' : 'dark';
    this.saveThemePreference();
    this.notifyListeners();
  }

  /**
   * Set specific mode
   */
  setMode(mode) {
    if (mode !== 'dark' && mode !== 'light') {
      console.warn('[Theme] Invalid mode:', mode);
      return;
    }
    this.currentMode = mode;
    this.saveThemePreference();
    this.notifyListeners();
  }

  /**
   * Set color palette
   */
  setPalette(paletteName) {
    if (!COLOR_PALETTES[paletteName]) {
      console.warn('[Theme] Palette not found:', paletteName);
      return;
    }
    this.currentPalette = COLOR_PALETTES[paletteName];
    this.saveThemePreference();
    this.notifyListeners();
  }

  /**
   * Get all available palettes
   */
  getAvailablePalettes() {
    return Object.keys(COLOR_PALETTES).map((key) => ({
      id: key,
      ...COLOR_PALETTES[key],
    }));
  }

  /**
   * Create custom palette
   */
  createCustomPalette(name, colors) {
    const paletteId = `CUSTOM_${Date.now()}`;
    COLOR_PALETTES[paletteId] = {
      name,
      ...colors,
    };
    this.currentPalette = COLOR_PALETTES[paletteId];
    this.saveThemePreference();
    this.notifyListeners();
    return paletteId;
  }

  /**
   * Save theme preference to storage
   */
  saveThemePreference() {
    const paletteName = Object.keys(COLOR_PALETTES).find(
      (key) => COLOR_PALETTES[key] === this.currentPalette
    );

    saveData('theme_preference', {
      mode: this.currentMode,
      palette: paletteName,
    });
  }

  /**
   * Register listener for theme changes
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Notify all listeners of theme change
   */
  notifyListeners() {
    this.listeners.forEach((callback) => {
      callback(this.getTheme());
    });
  }

  /**
   * Get theme as CSS variables (for React)
   */
  getThemeVariables() {
    const theme = this.getTheme();
    return {
      '--color-primary': theme.primary,
      '--color-secondary': theme.secondary,
      '--color-accent': theme.accent,
      '--color-success': theme.success,
      '--color-warning': theme.warning,
      '--color-error': theme.error,
      '--color-info': theme.info,
      '--color-bg': theme.background,
      '--color-surface': theme.surface,
      '--color-text': theme.text,
      '--color-text-secondary': theme.textSecondary,
      '--color-border': theme.border,
    };
  }

  /**
   * Get theme as style object for React Native
   */
  getStyleSheet() {
    const theme = this.getTheme();
    return {
      colors: {
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        success: theme.success,
        warning: theme.warning,
        error: theme.error,
        info: theme.info,
        background: theme.background,
        surface: theme.surface,
        text: theme.text,
        textSecondary: theme.textSecondary,
        border: theme.border,
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        xxl: 32,
      },
      borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 9999,
      },
      typography: {
        h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
        h2: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
        h3: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
        h4: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
        body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
        bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
        caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
      },
    };
  }
}

export const themeService = new ThemeService();
export default themeService;
