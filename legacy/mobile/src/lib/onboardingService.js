/**
 * Advanced Onboarding Experience
 * Guided introduction to all features with interactive tutorials
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
} from 'react-native';
import { themeService } from './themeService';
import { saveData, getData } from './offlineStorage';

export const ONBOARDING_STEPS = {
  WELCOME: 0,
  FEATURES: 1,
  SETUP: 2,
  DASHBOARD: 3,
  ATTENDANCE: 4,
  NOTIFICATIONS: 5,
  SETTINGS: 6,
  COMPLETE: 7,
};

class OnboardingService {
  constructor() {
    this.currentStep = ONBOARDING_STEPS.WELCOME;
    this.completed = getData('onboarding_completed') || false;
    this.skipped = getData('onboarding_skipped') || false;
  }

  /**
   * Get current step details
   */
  getStepDetails(step) {
    const steps = {
      [ONBOARDING_STEPS.WELCOME]: {
        id: 'welcome',
        title: '👋 Welcome to AcadHub!',
        subtitle: 'Your personal academic assistant',
        description: 'Track attendance, manage courses, view results, and stay updated with notifications.',
        actionText: 'Get Started',
        image: '📚',
      },
      [ONBOARDING_STEPS.FEATURES]: {
        id: 'features',
        title: '✨ Key Features',
        subtitle: 'Everything you need',
        features: [
          {
            icon: '📊',
            title: 'Dashboard',
            description: 'Overview of attendance, results, and upcoming classes',
          },
          {
            icon: '📋',
            title: 'Attendance Tracker',
            description: 'Monitor your attendance percentage per subject',
          },
          {
            icon: '📈',
            title: 'Results & Analytics',
            description: 'Track grades, analyze performance, predict outcomes',
          },
          {
            icon: '🔔',
            title: 'Smart Notifications',
            description: 'Stay informed about important academic updates',
          },
          {
            icon: '📅',
            title: 'Timetable',
            description: 'Manage your class schedule and events',
          },
          {
            icon: '📥',
            title: 'Excel Export',
            description: 'Download your data in Excel format',
          },
        ],
        actionText: 'Continue',
      },
      [ONBOARDING_STEPS.SETUP]: {
        id: 'setup',
        title: '⚙️ Quick Setup',
        subtitle: 'Configure your preferences',
        steps: [
          '1. Go to Settings and add your academic details',
          '2. Configure notification preferences',
          '3. Customize your theme and appearance',
          '4. Enable offline mode for data protection',
        ],
        actionText: 'Next',
      },
      [ONBOARDING_STEPS.DASHBOARD]: {
        id: 'dashboard',
        title: '📊 Dashboard Overview',
        subtitle: 'Your academic snapshot',
        tips: [
          '✓ Quick access to all important metrics',
          '✓ View current semester progress',
          '✓ See predicted grades and outcomes',
          '✓ Track attendance at a glance',
          '✓ Recent notifications and updates',
        ],
        actionText: 'Next',
      },
      [ONBOARDING_STEPS.ATTENDANCE]: {
        id: 'attendance',
        title: '📋 Attendance Tracking',
        subtitle: 'Monitor your attendance',
        tips: [
          '✓ View attendance per subject',
          '✓ Track daily attendance logs',
          '✓ Get alerts for low attendance',
          '✓ Export attendance reports',
          '✓ Predict attendance trends',
        ],
        actionText: 'Next',
      },
      [ONBOARDING_STEPS.NOTIFICATIONS]: {
        id: 'notifications',
        title: '🔔 Stay Informed',
        subtitle: 'Never miss important updates',
        tips: [
          '✓ Real-time notifications about results',
          '✓ Attendance alerts and reminders',
          '✓ Class schedule changes',
          '✓ Academic announcements',
          '✓ Custom notification filtering',
        ],
        actionText: 'Next',
      },
      [ONBOARDING_STEPS.SETTINGS]: {
        id: 'settings',
        title: '⚙️ Settings & More',
        subtitle: 'Customize your experience',
        settings: [
          {
            icon: '🌙',
            title: 'Dark/Light Mode',
            description: 'Choose your preferred theme',
          },
          {
            icon: '🎨',
            title: 'Color Palettes',
            description: 'Select from 5+ color themes',
          },
          {
            icon: '📲',
            title: 'App Updates',
            description: 'Auto-update feature for latest APK',
          },
          {
            icon: '🔐',
            title: 'Security',
            description: 'Offline mode, biometric auth, encryption',
          },
          {
            icon: '📊',
            title: 'Data Export',
            description: 'Export all your academic data',
          },
          {
            icon: '♿',
            title: 'Accessibility',
            description: 'Screen reader and font size options',
          },
        ],
        actionText: 'Finish',
      },
      [ONBOARDING_STEPS.COMPLETE]: {
        id: 'complete',
        title: '🎉 All Set!',
        subtitle: 'Ready to explore',
        message: 'You\'re all set to use AcadHub. Explore the app and make the most of your academic journey!',
        actionText: 'Start Using AcadHub',
      },
    };

    return steps[step];
  }

  /**
   * Move to next step
   */
  nextStep() {
    if (this.currentStep < ONBOARDING_STEPS.COMPLETE) {
      this.currentStep += 1;
    }
  }

  /**
   * Move to previous step
   */
  previousStep() {
    if (this.currentStep > ONBOARDING_STEPS.WELCOME) {
      this.currentStep -= 1;
    }
  }

  /**
   * Complete onboarding
   */
  completeOnboarding() {
    this.completed = true;
    this.currentStep = ONBOARDING_STEPS.COMPLETE;
    saveData('onboarding_completed', true);
  }

  /**
   * Skip onboarding
   */
  skipOnboarding() {
    this.skipped = true;
    saveData('onboarding_skipped', true);
  }

  /**
   * Reset onboarding
   */
  resetOnboarding() {
    this.completed = false;
    this.skipped = false;
    this.currentStep = ONBOARDING_STEPS.WELCOME;
    saveData('onboarding_completed', false);
    saveData('onboarding_skipped', false);
  }

  /**
   * Check if onboarding should be shown
   */
  shouldShowOnboarding() {
    return !this.completed && !this.skipped;
  }
}

// Export singleton instance
export const onboardingService = new OnboardingService();

/**
 * Onboarding Screen Component
 */
export const OnboardingScreen = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(ONBOARDING_STEPS.WELCOME);
  const theme = themeService.getTheme();

  const step = onboardingService.getStepDetails(currentStep);

  const handleNext = () => {
    if (currentStep === ONBOARDING_STEPS.COMPLETE) {
      onboardingService.completeOnboarding();
      onComplete?.();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > ONBOARDING_STEPS.WELCOME) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onboardingService.skipOnboarding();
    onSkip?.();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 30,
      alignItems: 'center',
    },
    image: {
      fontSize: 60,
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    description: {
      fontSize: 16,
      color: theme.textSecondary,
      lineHeight: 24,
      marginBottom: 20,
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    featureCard: {
      width: '48%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    featureTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    stepsList: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    stepItem: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
    },
    settingsGrid: {
      gap: 12,
    },
    settingsCard: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    settingsIcon: {
      fontSize: 28,
      marginRight: 12,
      width: 40,
    },
    settingsText: {
      flex: 1,
    },
    settingsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    settingsDescription: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: 12,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.surfaceVariant,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 20,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      width: `${((currentStep + 1) / (ONBOARDING_STEPS.COMPLETE + 1)) * 100}%`,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    skipButton: {
      padding: 12,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      color: theme.textTertiary,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1 }}
        scrollEnabled={true}
      >
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.header}>
          <Text style={styles.image}>{step.image || step.icon || '✨'}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
        </View>

        {step.description && (
          <View style={styles.content}>
            <Text style={styles.description}>{step.description}</Text>
          </View>
        )}

        {step.features && (
          <View style={styles.content}>
            <View style={styles.featureGrid}>
              {step.features.map((feature, index) => (
                <View key={index} style={styles.featureCard}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {step.steps && (
          <View style={styles.content}>
            <View style={styles.stepsList}>
              {step.steps.map((stepText, index) => (
                <Text key={index} style={styles.stepItem}>
                  {stepText}
                </Text>
              ))}
            </View>
          </View>
        )}

        {step.tips && (
          <View style={styles.content}>
            <View style={styles.stepsList}>
              {step.tips.map((tip, index) => (
                <Text key={index} style={styles.stepItem}>
                  {tip}
                </Text>
              ))}
            </View>
          </View>
        )}

        {step.settings && (
          <View style={styles.content}>
            <View style={styles.settingsGrid}>
              {step.settings.map((setting, index) => (
                <View key={index} style={styles.settingsCard}>
                  <Text style={styles.settingsIcon}>{setting.icon}</Text>
                  <View style={styles.settingsText}>
                    <Text style={styles.settingsTitle}>{setting.title}</Text>
                    <Text style={styles.settingsDescription}>{setting.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {step.message && (
          <View style={styles.content}>
            <Text style={styles.description}>{step.message}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {currentStep > ONBOARDING_STEPS.WELCOME && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handlePrevious}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.buttonText}>{step.actionText}</Text>
          </TouchableOpacity>
        </View>

        {currentStep < ONBOARDING_STEPS.COMPLETE && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip tutorial</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default {
  onboardingService,
  OnboardingScreen,
  ONBOARDING_STEPS,
};
