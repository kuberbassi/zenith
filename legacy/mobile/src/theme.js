
export const theme = {
  palette: {
    // JetBrains Official Poppy Colors
    background: '#000000', // AMOLED
    surface: '#121212',
    selection: '#AC67FF',
    blue: '#007FFF',
    purple: '#AC67FF',
    magenta: '#FF318C',
    orange: '#FF8F3F',
    green: '#59A275',
    red: '#E06260',
    text: '#DFE1E5',
    subtext: '#9FA1A8',
    border: '#1E1F22',
  },
  light: {
    primary: '#3574F0',
    text: '#1E1F22',
    subtext: '#6E6E73',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DFE1E5',
    onPrimaryContainer: '#1E1F22',
    secondary: '#B37AF3',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F0F0F0',
    onSecondaryContainer: '#1E1F22',
    tertiary: '#59A275',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E8F5E9',
    onTertiaryContainer: '#2E7D32',
    error: '#E06260',
    onError: '#FFFFFF',
    errorContainer: '#FFEBEE',
    onErrorContainer: '#C62828',
    background: '#FFFFFF',
    onBackground: '#1E1F22',
    surface: '#F7F8FA',
    onSurface: '#1E1F22',
    surfaceVariant: '#EBECF0',
    onSurfaceVariant: '#6E6E73',
    outline: '#C4C7C5',
    outlineVariant: '#DFE1E5',
    surfaceContainer: '#F2F3F5',
    surfaceContainerLow: '#FFFFFF',
    surfaceContainerHigh: '#EBECF0',
    surfaceContainerHighest: '#DFE1E5',
    surfaceDim: '#DCDCDC',
    heroCardBg: '#3574F0',
    heroText: '#FFFFFF',
    riskBadgeBg: '#F9FAFB',
    riskBadgeText: '#E06260',
    safeBadgeBg: '#F9FAFB',
    safeBadgeText: '#59A275',
    cardShadow: 'rgba(0,0,0,0.05)',
    inputBg: 'rgba(0,0,0,0.04)',
    glassBorder: 'rgba(0,0,0,0.08)',
    danger: '#E06260',
    accent: '#3574F0',
    gradients: {
      primary: ['#3574F0', '#007FFF'],
      vibrant: ['#3574F0', '#FF318C', '#FF8F3F'],
      poppy: ['#FF318C', '#FF8F3F', '#FFEF5A'],
      royal: ['#3574F0', '#AC67FF'],
      ocean: ['#007FFF', '#2E9DFF'],
      success: ['#59A275', '#76B78F'],
      orange: ['#FF8F3F', '#FFB870'],
      danger: ['#E06260', '#EB794E'],
      accent: ['#3574F0', '#FF318C'],
      glass: ['rgba(255,255,255,1)', 'rgba(240,240,240,1)'],
      card: ['#FFFFFF', '#F7F8FA'],
    }
  },
  dark: {
    primary: '#AC67FF',
    text: '#DFE1E5',
    subtext: '#9FA1A8',
    onPrimary: '#FFFFFF',
    primaryContainer: '#121212',
    onPrimaryContainer: '#DFE1E5',
    secondary: '#FF318C',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#1E1F22',
    onSecondaryContainer: '#DFE1E5',
    tertiary: '#59A275',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#1E1F22',
    onTertiaryContainer: '#59A275',
    error: '#E06260',
    onError: '#FFFFFF',
    errorContainer: '#1E1F22',
    onErrorContainer: '#E06260',
    background: '#000000', // AMOLED
    onBackground: '#DFE1E5',
    surface: '#121212',
    onSurface: '#DFE1E5',
    surfaceVariant: '#1E1F22',
    onSurfaceVariant: '#9FA1A8',
    outline: '#393B40',
    outlineVariant: '#1E1F22',
    surfaceContainer: '#121212',
    surfaceContainerLow: '#000000',
    surfaceContainerHigh: '#1E1F22',
    surfaceContainerHighest: '#2B2D30',
    surfaceDim: '#000000',
    // Custom Accents for JB Website Aesthetic
    heroCardBg: '#AC67FF',
    heroText: '#FFFFFF',
    riskBadgeBg: '#2B2D30',
    riskBadgeText: '#E06260',
    safeBadgeBg: '#2B2D30',
    safeBadgeText: '#59A275',
    cardShadow: 'rgba(0,0,0,0.5)',
    inputBg: 'rgba(255,255,255,0.06)',
    glassBorder: 'rgba(255,255,255,0.12)',
    danger: '#E06260',
    accent: '#AC67FF',
    gradients: {
      primary: ['#AC67FF', '#FF318C'], // Purple to Magenta
      vibrant: ['#AC67FF', '#FF318C', '#FF8F3F'],
      poppy: ['#FF318C', '#FF8F3F', '#FFEF5A'],
      royal: ['#AC67FF', '#007FFF'],
      ocean: ['#007FFF', '#2E9DFF'],
      success: ['#59A275', '#76B78F'],
      orange: ['#FF8F3F', '#FFB870'],
      danger: ['#E06260', '#EB794E'],
      accent: ['#AC67FF', '#FF318C'],
      glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'],
      card: ['#1E1F22', '#121212'],
    }
  },
  gradients: {
    primary: ['#AC67FF', '#FF318C'], // Purple to Magenta
    vibrant: ['#AC67FF', '#FF318C', '#FF8F3F'], // JB Logo style
    poppy: ['#FF318C', '#FF8F3F', '#FFEF5A'], // Pink to Yellow
    royal: ['#AC67FF', '#007FFF'], // Purple to Blue
    ocean: ['#007FFF', '#2E9DFF'], // Blue variants
    success: ['#59A275', '#76B78F'],
    orange: ['#FF8F3F', '#FFB870'],  // Orange gradient - was missing!
    danger: ['#E06260', '#EB794E'],
    accent: ['#AC67FF', '#FF318C'], // Matches primary/purple theme
    glass: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'],
    glassLight: ['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.75)'],
    cardDark: ['#1E1F22', '#121212'],
    cardLight: ['#FFFFFF', '#F7F8FA'],
    amoled: ['#000000', '#0a0a0a'],
  },
  glassmorphism: {
    // Background colors for glassmorphic elements
    dark: {
      background: 'rgba(18, 18, 18, 0.7)',
      backgroundLight: 'rgba(30, 31, 34, 0.6)',
      border: 'rgba(255, 255, 255, 0.1)',
      borderSubtle: 'rgba(255, 255, 255, 0.05)',
    },
    light: {
      background: 'rgba(255, 255, 255, 0.7)',
      backgroundLight: 'rgba(248, 248, 248, 0.6)',
      border: 'rgba(0, 0, 0, 0.1)',
      borderSubtle: 'rgba(0, 0, 0, 0.05)',
    },
    // Blur intensity values for expo-blur
    blur: {
      light: 40,
      medium: 60,
      heavy: 80,
    },
  },
  shadows: {
    // JetBrains-inspired shadow presets
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
  }
};

export const Layout = {
  header: {
    maxHeight: 130, // Reduced from 170 to fix "too much gap"
    minHeight: 70, // Slightly reduced
    maxTitleSize: 26, // Slightly smaller title
    minTitleSize: 18,
    contentHeight: 50, // Reduced from 80 for tighter layout
    // Spacing
    paddingHorizontal: 24,
    paddingBottom: 12
  }
};
