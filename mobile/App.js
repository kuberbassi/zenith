import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, useColorScheme, View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { theme } from './src/theme';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { LayoutDashboard, Calendar as CalendarIcon, Settings, BarChart2, GraduationCap } from 'lucide-react-native';
import { LinearGradient } from './src/components/LinearGradient';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import AcademicScreen from './src/screens/AcademicScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubjectDetailScreen from './src/screens/SubjectDetailScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import SkillTrackerScreen from './src/screens/SkillTrackerScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ActivityLogScreen from './src/screens/ActivityLogScreen';
import TimetableSetupScreen from './src/screens/TimetableSetupScreen';
import AssignmentsScreen from './src/screens/AssignmentsScreen';
import CourseManagerScreen from './src/screens/CourseManagerScreen';
import TimetableScreen from './src/screens/TimetableScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AiBotScreen from './src/screens/AiBotScreen';
import useRealTimeSync from './src/hooks/useRealTimeSync';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SemesterProvider } from './src/contexts/SemesterContext';
import { UpdateProvider } from './src/contexts/UpdateContext';
import NetInfo from '@react-native-community/netinfo';
import OfflineOverlay from './src/components/OfflineOverlay';
import ChangelogModal from './src/components/ChangelogModal';


import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, clientPersister } from './src/lib/queryClient';
import { performCacheSafetyCheck } from './src/utils/CacheSafetyManager';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const GlassTabBarBackground = () => {
  const { isDark } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={isDark
          ? ['rgba(30,31,34,0.92)', 'rgba(30,31,34,0.98)']
          : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)']}
        style={[StyleSheet.absoluteFill, { borderRadius: 30 }]}
      />
      {/* Subtle border for glass depth */}
      <View style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
      }} />
    </View>
  );
};

const MainTabs = () => {
  const { isDark, accentColor } = useTheme();
  const primary = accentColor || theme.palette.purple;
  const insets = require('react-native-safe-area-context').useSafeAreaInsets();

  // Create a semi-transparent version for backgrounds
  const accentBgColor = `${primary}33`; // 20% opacity

  // Dynamic bottom offset: ensures tab bar clears 3-button nav bars
  const tabBottom = Platform.OS === 'ios' ? 24 : Math.max(insets.bottom, 16);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 10,
          height: 64,
          marginHorizontal: 24,
          alignSelf: 'center',
          width: Dimensions.get('window').width - 48,
          bottom: tabBottom,
          borderRadius: 32,
          paddingBottom: 0,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 20,
        },
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View
                  style={{
                    position: 'absolute', width: 44, height: 44, borderRadius: 22,
                    backgroundColor: accentBgColor,
                  }}
                />
              )}
              <LayoutDashboard color={color} size={24} strokeWidth={focused ? 2.2 : 1.8} />
              {focused && <View style={{ position: 'absolute', bottom: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: primary }} />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={CalendarScreen}
        options={{
          tabBarLabel: 'Timeline',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: accentBgColor }} />
              )}
              <CalendarIcon color={color} size={24} strokeWidth={focused ? 2.2 : 1.8} />
              {focused && <View style={{ position: 'absolute', bottom: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: primary }} />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
      />
      <Tab.Screen
        name="AcademicTab"
        component={AcademicScreen}
        options={{
          tabBarLabel: 'Academy',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: accentBgColor }} />
              )}
              <GraduationCap color={color} size={24} strokeWidth={focused ? 2.2 : 1.8} />
              {focused && <View style={{ position: 'absolute', bottom: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: primary }} />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: accentBgColor }} />
              )}
              <BarChart2 color={color} size={24} strokeWidth={focused ? 2.2 : 1.8} />
              {focused && <View style={{ position: 'absolute', bottom: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: primary }} />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Config',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{ position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: accentBgColor }} />
              )}
              <Settings color={color} size={24} strokeWidth={focused ? 2.2 : 1.8} />
              {focused && <View style={{ position: 'absolute', bottom: -10, width: 4, height: 4, borderRadius: 2, backgroundColor: primary }} />}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        }}
      />
    </Tab.Navigator>
  );
}


const AppNavigator = () => {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [isOffline, setIsOffline] = React.useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = React.useState(null); // null = loading, true/false = checked
  const colors = isDark ? theme.dark : theme.light;

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // Run cache safety check on app start
  React.useEffect(() => {
    performCacheSafetyCheck().then(result => {
      if (result.migrated) {
        console.log('📦 Cache migrated:', result);
      }
    });
  }, []);

  // Check if user has seen onboarding
  React.useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const seen = await AsyncStorage.getItem('hasSeenOnboarding');
        setHasSeenOnboarding(seen === 'true');
      } catch (e) {
        console.error('Error checking onboarding status:', e);
        setHasSeenOnboarding(true); // Default to true on error
      }
    };
    if (user) {
      checkOnboarding();
    }
  }, [user]);

  // Initialize Real-time Sync
  useRealTimeSync();

  if (authLoading || (user && hasSeenOnboarding === null)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.onSurface }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: colors.background },
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            presentation: 'card',
            animationEnabled: true,
            cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
            headerMode: 'none',
          }}
        >
          {!user ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : !hasSeenOnboarding ? (
            <Stack.Screen name="Onboarding">
              {(props) => <OnboardingScreen {...props} onComplete={() => setHasSeenOnboarding(true)} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Reports" component={ReportsScreen} />
              <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} />
              <Stack.Screen name="Results" component={ResultsScreen} />
              <Stack.Screen name="SkillTracker" component={SkillTrackerScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
              <Stack.Screen name="TimetableSetup" component={TimetableSetupScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="Assignments" component={AssignmentsScreen} />
              <Stack.Screen name="CourseManager" component={CourseManagerScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="Timetable" component={TimetableScreen} />
              <Stack.Screen name="AiBot" component={AiBotScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <OfflineOverlay isVisible={isOffline} />
      {hasSeenOnboarding && <ChangelogModal />}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: clientPersister }}
      >
        <AuthProvider>
          <ThemeProvider>
            <SemesterProvider>
              <UpdateProvider>
                <AppNavigator />
              </UpdateProvider>
            </SemesterProvider>
          </ThemeProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
