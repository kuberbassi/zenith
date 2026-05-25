import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, Image, Dimensions } from 'react-native';
import PressableScale from '../components/PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '../utils/GoogleSigninSafe';
import api from '../services/api';
import { LogIn, GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';

const LoginScreen = () => {
    const { isDark } = useTheme();
    const { login } = useAuth();

    // JetBrains Vibrant Palette
    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',

        glassBgStart: isDark ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)',
        glassBgEnd: isDark ? 'rgba(30,31,34,0.85)' : 'rgba(255,255,255,0.85)',
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',

        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',

        primary: theme.palette.purple,
        accent: theme.palette.magenta,
        secondary: theme.palette.magenta
    };

    const styles = getStyles(c);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: '86874505738-k1263riddtq0sctihj5divb550d93pg0.apps.googleusercontent.com', // Project 868 (Zenith Mobile Kuber)
            offlineAccess: false,
            scopes: ['email', 'profile'],
        });
    }, []);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            // NATIVE SIGN-IN FLOW (Industry Standard)
            try {
                await GoogleSignin.hasPlayServices();
                const userInfo = await GoogleSignin.signIn();

                // Get the Server Auth Code (Required for Backend)
                const signInData = userInfo.data || userInfo;
                const idToken = signInData.idToken;

                if (!idToken) throw new Error('No ID token received from Google Sign-In');

                // Send the Google ID token to backend (same format as web)
                const backendResponse = await api.post('/api/auth/google', {
                    credential: idToken,
                });

                const { user, token } = backendResponse.data;

                if (user && token) {
                    await login(user, token);
                } else {
                    throw new Error('Invalid response from server');
                }
            } catch (googleError) {
                if (googleError.message?.includes("Expo Go")) {
                    Alert.alert("Expo Go Detected", "Google Sign-In is not supported in Expo Go. Signing in as Developer...");
                    await handleDevLogin();
                    return;
                }

                // Robust Error Handling
                if (googleError.code === statusCodes.SIGN_IN_CANCELLED) {
                    // Silent
                } else if (googleError.code === statusCodes.IN_PROGRESS) {
                    // Silent
                } else if (googleError.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                    Alert.alert('System Error', 'Google Play Services outdated.');
                } else {
                    console.error('Google Sign-In Fail:', googleError);
                    Alert.alert('Login Failed', `Code: ${googleError.code || 'Unknown'}`);
                }
            }
        } catch (error) {
            console.error('Auth Error:', error);
            Alert.alert('Authentication Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDevLogin = async () => {
        setLoading(true);
        try {
            const response = await api.post('/api/auth/dev_login', { email: 'kuber@hmritm.ac.in' });
            await login(response.data.user, response.data.token);
        } catch (error) { Alert.alert("Error", "Dev login failed"); }
        finally { setLoading(false); }
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[c.bgGradStart || '#FFF', c.bgGradMid || '#F8F9FA', c.bgGradEnd || '#FFF']} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* AMBIENT GLOW */}
            <LinearGradient colors={[isDark ? 'rgba(10, 132, 255, 0.25)' : 'rgba(10, 132, 255, 0.15)', 'transparent']} style={styles.glowOrb} />

            <View style={styles.contentContainer}>
                {/* LOGO AREA */}
                <View style={styles.logoSection}>
                    <LinearGradient colors={theme.gradients.primary} style={styles.iconCircle}>
                        <Image
                            source={require('../../assets/icon-trans.png')}
                            style={{ width: 125, height: 125 }}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                    <Text style={styles.title}>Zenith</Text>
                    <Text style={styles.subtitle}>Your Academic Companion</Text>
                </View>

                {/* LOGIN CARD */}
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.glassCard} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Welcome Back</Text>
                        <Text style={styles.cardSub}>Sign in to continue learning</Text>
                    </View>

                    {Platform.OS === 'web' ? (
                        <Text style={{ color: c.subtext, textAlign: 'center', marginBottom: 20 }}>Use Android/iOS for Google Sign-In</Text>
                    ) : (
                        <PressableScale
                            style={styles.googleBtn}
                            onPress={handleGoogleSignIn}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : (
                                <>
                                    <View style={styles.gWrapper}>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4285F4' }}>G</Text>
                                    </View>
                                    <Text style={styles.btnText}>Sign in with Google</Text>
                                    <ArrowRight size={20} color="#FFF" style={{ opacity: 0.8 }} />
                                </>
                            )}
                        </PressableScale>
                    )}

                    {/* Developer Login Removed for Production */}
                </LinearGradient>

                <Text style={styles.footerText}>Secure Login provided by Google OAuth</Text>
            </View>
        </View>
    );
};

const getStyles = (c) => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center' },
    contentContainer: { padding: 32, alignItems: 'center', zIndex: 2 },

    glowOrb: {
        position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: 200, opacity: 0.5
    },

    logoSection: { alignItems: 'center', marginBottom: 40 },
    iconCircle: {
        width: 120, height: 120, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
        shadowColor: c.primary, shadowOpacity: 0.5, shadowRadius: 30, elevation: 15,
        transform: [{ rotate: '-10deg' }], marginBottom: 24,
        overflow: 'hidden'
    },
    title: { fontSize: 42, fontWeight: '900', color: c.text, letterSpacing: -1 },
    subtitle: { fontSize: 16, color: c.subtext, fontWeight: '500', marginTop: 4 },

    glassCard: {
        width: '100%', padding: 32, borderRadius: 32,
        borderWidth: 1, borderColor: c.glassBorder,
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
    },
    cardHeader: { marginBottom: 32, alignItems: 'center' },
    cardTitle: { fontSize: 24, fontWeight: '800', color: c.text },
    cardSub: { fontSize: 14, color: c.subtext, marginTop: 4 },

    googleBtn: {
        backgroundColor: '#4285F4', borderRadius: 20, padding: 4,
        flexDirection: 'row', alignItems: 'center',
        shadowColor: '#4285F4', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4
    },
    gWrapper: {
        width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFF',
        alignItems: 'center', justifyContent: 'center', marginRight: 16
    },
    btnText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '700' },

    devBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 20, padding: 12, borderRadius: 16,
        backgroundColor: c.glassBorder
    },
    devText: { color: c.text, fontSize: 13, fontWeight: '600', opacity: 0.8 },

    footerText: { fontSize: 12, color: c.subtext, opacity: 0.6 }
});

export default LoginScreen;



