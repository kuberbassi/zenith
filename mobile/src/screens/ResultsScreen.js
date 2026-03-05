import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    TextInput, Alert, ActivityIndicator, Animated, Platform, UIManager, LayoutAnimation,
    StatusBar, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, Layout } from '../theme';
import { attendanceService } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import {
    ChevronDown, ChevronUp, Info, Edit3, Save, X, Trash2, Plus,
    Award, TrendingUp, BookOpen, GraduationCap, Download, BarChart2, Zap
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AnimatedHeader from '../components/AnimatedHeader';
import { LinearGradient } from '../components/LinearGradient';
import SemesterSelector from '../components/SemesterSelector';
import PressableScale from '../components/PressableScale';

// Enable LayoutAnimation
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { useSemester } from '../contexts/SemesterContext';

const ResultsScreen = ({ navigation }) => {
    const { isDark, colors: themeColors } = useTheme();
    const insets = useSafeAreaInsets();
    const { selectedSemester } = useSemester();

    // AMOLED Theme
    const c = {
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',

        glassBgStart: isDark ? 'rgba(30,31,34,0.95)' : 'rgba(255,255,255,0.95)',
        glassBgEnd: isDark ? 'rgba(30,31,34,0.85)' : 'rgba(255,255,255,0.85)',
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',

        text: isDark ? '#FFFFFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',

        primary: themeColors.primary, // Dynamic accent
        accent: theme.palette.magenta,
        success: theme.palette.green,
        warning: theme.palette.orange,
        danger: theme.palette.red,
        surface: isDark ? '#121212' : '#FFFFFF',

        inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        gradients: themeColors.gradients, // Dynamic gradients
    };


    const styles = getStyles(c, isDark, insets);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [availableSems, setAvailableSems] = useState([]);
    const [stats, setStats] = useState({ cgpa: '0.00', totalCredits: 0 });
    const [showGradingRef, setShowGradingRef] = useState(false);

    // IPU Sync State
    const [step, setStep] = useState('results'); // 'results', 'form', 'captcha'
    const [enrollmentNo, setEnrollmentNo] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [captchaInfo, setCaptchaInfo] = useState(null);
    const [captchaCode, setCaptchaCode] = useState('');
    const [fetching, setFetching] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        setStep('results'); // default if data exists
        try {
            const data = await attendanceService.getSavedIPUResults();
            if (data?.semesters?.length) {
                setResults(data.semesters);
                setAvailableSems(data.semesters.map(s => s.semester));
                calculateOverallStats(data.semesters, data.cgpa);
                setLastUpdated(data.last_updated);
                setStep('results');

                // Set auth details if available from user context later
                if (data.enrollment_number) setEnrollmentNo(data.enrollment_number);
            } else {
                setStep('form');
            }
        } catch (error) {
            console.error(error);
            setStep('form');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const calculateOverallStats = (semesters, providedCgpa) => {
        if (providedCgpa) {
            setStats({
                cgpa: parseFloat(providedCgpa).toFixed(2),
                totalCredits: semesters.reduce((acc, r) => acc + (r.total_credits || 0), 0)
            });
            return;
        }

        let totalCredits = 0;
        let weightedSum = 0;

        (Array.isArray(semesters) ? semesters : []).forEach(r => {
            const credits = r.total_credits || 0;
            const sgpa = r.sgpa || 0;
            if (credits > 0) {
                weightedSum += (parseFloat(sgpa) * credits);
                totalCredits += credits;
            }
        });

        const cgpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : "0.00";
        setStats({ cgpa, totalCredits });
    };

    const calculateSemesterStats = (subjects = []) => {
        let totalCredits = 0;
        let weightedSum = 0;

        const processed = (subjects || []).map(sub => {
            const cr = parseInt(sub.credits) || 0;
            const type = sub.type || 'theory';
            let total = 0;
            let max = 0;

            if (type === 'nues') {
                total = parseInt(sub.internal_theory) || 0;
                max = 100;
            } else {
                if (type === 'theory') {
                    total += (parseInt(sub.internal_theory) || 0) + (parseInt(sub.external_theory) || 0);
                    max += 100;
                }
                if (type === 'practical') {
                    total += (parseInt(sub.internal_practical) || 0) + (parseInt(sub.external_practical) || 0);
                    max += 100;
                }
            }

            const percent = max > 0 ? (total / max) * 100 : 0;
            let grade = 'F';
            let gp = 0;
            if (percent >= 90) { grade = 'O'; gp = 10; }
            else if (percent >= 75) { grade = 'A+'; gp = 9; }
            else if (percent >= 65) { grade = 'A'; gp = 8; }
            else if (percent >= 55) { grade = 'B+'; gp = 7; }
            else if (percent >= 50) { grade = 'B'; gp = 6; }
            else if (percent >= 45) { grade = 'C'; gp = 5; }
            else if (percent >= 40) { grade = 'P'; gp = 4; }

            if (cr > 0) {
                weightedSum += (gp * cr);
                totalCredits += cr;
            }

            return {
                ...sub,
                total,
                percentage: percent.toFixed(1),
                grade,
                grade_point: gp
            };
        });

        const sgpa = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : "0.00";
        return { sgpa, credits: totalCredits, processedSubjects: processed };
    };

    const handleAutoFetch = async () => {
        if (!enrollmentNo.trim() || !password.trim()) {
            Alert.alert("Error", "Please enter Enrollment Number and Password.");
            return;
        }
        setFetching(true);
        try {
            const data = await attendanceService.autoFetchIPUResults({ enrollment_number: enrollmentNo, password });
            if (data?.captcha_required) {
                setCaptchaInfo({
                    captcha_image: data.captcha_image,
                    hidden_fields: data.hidden_fields || {},
                    field_names: data.field_names || {},
                    login_action: data.login_action,
                    ocr_attempted: data.ocr_attempted,
                });
                setCaptchaCode(data.ocr_attempted || '');
                setStep('captcha');
            } else if (data?.semesters !== undefined) {
                setResults(data.semesters);
                calculateOverallStats(data.semesters, data.cgpa);
                setLastUpdated(new Date().toISOString());
                setStep('results');
                Alert.alert("Success", "Results synced successfully!");
            } else {
                Alert.alert("Error", "Could not retrieve results.");
            }
        } catch (e) {
            Alert.alert("Error", e?.response?.data?.error || "Failed to reach server.");
        } finally {
            setFetching(false);
        }
    };

    const handleFetchResultsWithCaptcha = async () => {
        if (!captchaCode.trim()) {
            Alert.alert("Error", "Please enter CAPTCHA.");
            return;
        }
        setFetching(true);
        try {
            const payload = {
                enrollment_number: enrollmentNo, password, captcha: captchaCode,
                hidden_fields: captchaInfo?.hidden_fields || {},
                field_names: captchaInfo?.field_names || {},
                login_action: captchaInfo?.login_action || '',
            };
            const data = await attendanceService.fetchIPUResults(payload);
            if (data?.semesters !== undefined) {
                setResults(data.semesters);
                calculateOverallStats(data.semesters, data.cgpa);
                setLastUpdated(new Date().toISOString());
                setStep('results');
                Alert.alert("Success", "Results synced successfully!");
            } else {
                Alert.alert("Error", "Invalid credentials or CAPTCHA.");
                await refreshCaptcha();
            }
        } catch (e) {
            const status = e?.response?.status;
            Alert.alert("Error", e?.response?.data?.error || "Failed to fetch.");
            if (status === 423) {
                setStep('form');
                setPassword('');
            } else {
                await refreshCaptcha();
            }
        } finally {
            setFetching(false);
        }
    };

    const refreshCaptcha = async () => {
        setFetching(true);
        setCaptchaCode('');
        try {
            const data = await attendanceService.getIPUCaptcha();
            if (data?.captcha_image) {
                setCaptchaInfo({
                    captcha_image: data.captcha_image,
                    hidden_fields: data.hidden_fields || {},
                    field_names: data.field_names || {},
                    login_action: data.login_action,
                });
            }
        } catch (e) {
            Alert.alert("Error", "Failed to refresh CAPTCHA.");
        } finally {
            setFetching(false);
        }
    };

    // --- Renderers ---
    const getGradeColor = (grade) => {
        if (!grade) return c.subtext;
        const g = grade.toUpperCase();
        if (g === 'O') return c.success;
        if (g === 'A+' || g === 'A') return c.primary;
        if (g === 'F') return c.danger;
        return c.warning;
    };

    const renderSubjectCard = (sub) => {
        const gradeColor = getGradeColor(sub.grade);
        const type = sub.type || 'theory';

        // Always recalculate total from individual marks for accuracy
        let displayTotal = 0;
        if (type === 'nues') {
            displayTotal = parseInt(sub.internal_theory) || 0;
        } else {
            if (type === 'theory' || type === 'both') {
                displayTotal += (parseInt(sub.internal_theory) || 0) + (parseInt(sub.external_theory) || 0);
            }
            if (type === 'practical' || type === 'both') {
                displayTotal += (parseInt(sub.internal_practical) || 0) + (parseInt(sub.external_practical) || 0);
            }
        }

        return (
            <LinearGradient
                key={sub.code || Math.random()}
                colors={[c.glassBgStart, c.glassBgEnd]}
                style={styles.card}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
                <LinearGradient colors={[gradeColor, gradeColor + '80']} style={styles.gradeBadge}>
                    <Text style={styles.gradeText}>{sub.grade || '-'}</Text>
                </LinearGradient>

                <View style={{ flex: 1 }}>
                    <View style={styles.subHeader}>
                        <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
                        <View style={styles.chip}>
                            <Text style={styles.chipText}>{sub.credits} CREDITS</Text>
                        </View>
                    </View>

                    <View style={styles.marksContainer}>
                        {type === 'nues' ? (
                            <View style={styles.markPill}>
                                <Text style={styles.markLabel}>NUES</Text>
                                <Text style={styles.markValue}>{sub.internal_theory || 0}</Text>
                            </View>
                        ) : (
                            <>
                                {type === 'theory' && (
                                    <View style={styles.markPill}>
                                        <Text style={styles.markLabel}>THEORY</Text>
                                        <Text style={styles.markValue}>{sub.internal_theory || 0} + {sub.external_theory || 0}</Text>
                                    </View>
                                )}
                                {type === 'practical' && (
                                    <View style={styles.markPill}>
                                        <Text style={styles.markLabel}>PRACTICAL</Text>
                                        <Text style={styles.markValue}>{sub.internal_practical || 0} + {sub.external_practical || 0}</Text>
                                    </View>
                                )}
                            </>
                        )}
                        <Text style={styles.totalText}>TOTAL: {displayTotal}</Text>
                    </View>
                </View>
            </LinearGradient>
        );
    };

    const renderEditSubject = (sub, index) => (
        <LinearGradient key={index} colors={[c.glassBgStart, c.glassBgEnd]} style={styles.editCard}>
            <View style={styles.editHeader}>
                <TextInput
                    style={[styles.input, { flex: 1, fontWeight: '700' }]}
                    value={sub.name}
                    placeholder="Subject Name"
                    placeholderTextColor={c.subtext}
                    onChangeText={t => handleSubjectChange(t, index, 'name')}
                />
                <TextInput
                    style={[styles.input, { width: 60, textAlign: 'center' }]}
                    value={String(sub.credits)}
                    placeholder="Cr"
                    keyboardType="numeric"
                    onChangeText={t => handleSubjectChange(t, index, 'credits')}
                />
                <TouchableOpacity onPress={() => {
                    const newData = { ...editData };
                    newData.subjects.splice(index, 1);
                    setEditData(newData);
                }}>
                    <Trash2 size={20} color={c.danger} />
                </TouchableOpacity>
            </View>

            <View style={styles.typeRow}>
                {['theory', 'practical', 'nues'].map(t => (
                    <TouchableOpacity
                        key={t}
                        style={[styles.typeChip, sub.type === t && styles.typeChipActive]}
                        onPress={() => handleSubjectChange(t, index, 'type')}
                    >
                        <Text style={[styles.typeChipText, sub.type === t && styles.typeChipTextActive]}>{t.toUpperCase()}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.editRow}>
                {sub.type === 'nues' ? (
                    <View style={{ flex: 1 }}>
                        <Text style={styles.miniLabel}>Internal (100)</Text>
                        <TextInput
                            style={styles.inputSmall}
                            value={String(sub.internal_theory || 0)}
                            keyboardType="numeric"
                            onChangeText={t => handleSubjectChange(t, index, 'internal_theory')}
                        />
                    </View>
                ) : (
                    <>
                        {sub.type === 'theory' && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.miniLabel}>Th Int</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={String(sub.internal_theory || 0)}
                                        keyboardType="numeric"
                                        onChangeText={t => handleSubjectChange(t, index, 'internal_theory')}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.miniLabel}>Th Ext</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={String(sub.external_theory || 0)}
                                        keyboardType="numeric"
                                        onChangeText={t => handleSubjectChange(t, index, 'external_theory')}
                                    />
                                </View>
                            </>
                        )}
                        {sub.type === 'practical' && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.miniLabel}>Pr Int</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={String(sub.internal_practical || 0)}
                                        keyboardType="numeric"
                                        onChangeText={t => handleSubjectChange(t, index, 'internal_practical')}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.miniLabel}>Pr Ext</Text>
                                    <TextInput
                                        style={styles.inputSmall}
                                        value={String(sub.external_practical || 0)}
                                        keyboardType="numeric"
                                        onChangeText={t => handleSubjectChange(t, index, 'external_practical')}
                                    />
                                </View>
                            </>
                        )}
                    </>
                )}
            </View>
        </LinearGradient>
    );

    const currentResult = (Array.isArray(results) ? results : []).find(r => r.semester === selectedSemester);

    // Replace Edit imports and add new icons
    const { RefreshCw, Eye, EyeOff, ShieldCheck } = require('lucide-react-native');

    if (step === 'loading') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bgGradStart }}>
                <ActivityIndicator size="large" color={c.primary} />
            </View>
        );
    }

    if (step === 'form') {
        return (
            <View style={{ flex: 1, backgroundColor: c.bgGradStart }}>
                <AnimatedHeader
                    scrollY={scrollY}
                    title="IPU Sync"
                    subtitle="Fetch Academic Records"
                    isDark={isDark}
                    colors={c}
                    onBack={() => {
                        if (results?.length) setStep('results');
                        else navigation.goBack();
                    }}
                />
                <ScrollView contentContainerStyle={{ padding: 24, paddingTop: Layout.header.maxHeight + insets.top + 20 }}>
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: c.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                                <GraduationCap size={24} color={c.primary} />
                            </View>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Academic Portal</Text>
                                <Text style={{ fontSize: 12, color: c.subtext, fontWeight: '600' }}>Secure Result Retrieval</Text>
                            </View>
                        </View>

                        <View style={{ gap: 16 }}>
                            <View>
                                <Text style={styles.inputLabelForm}>ENROLLMENT NUMBER</Text>
                                <TextInput
                                    style={styles.textInputForm}
                                    placeholder="00000000000"
                                    placeholderTextColor={c.subtext}
                                    value={enrollmentNo}
                                    onChangeText={setEnrollmentNo}
                                    keyboardType="numeric"
                                />
                            </View>

                            <View>
                                <Text style={styles.inputLabelForm}>PORTAL PASSWORD</Text>
                                <View style={styles.passwordWrapper}>
                                    <TextInput
                                        style={[styles.textInputForm, { flex: 1, borderWidth: 0 }]}
                                        placeholder="********"
                                        placeholderTextColor={c.subtext}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPw}
                                    />
                                    <TouchableOpacity onPress={() => setShowPw(!showPw)} style={{ padding: 12 }}>
                                        {showPw ? <EyeOff size={20} color={c.subtext} /> : <Eye size={20} color={c.subtext} />}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleAutoFetch} disabled={fetching} style={{ marginTop: 24 }}>
                            <LinearGradient colors={theme.gradients.primary} style={styles.syncBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                {fetching ? <ActivityIndicator color="#FFF" /> : (
                                    <>
                                        <Zap size={18} color="#FFF" />
                                        <Text style={styles.syncBtnText}>SYNC NOW</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (step === 'captcha') {
        return (
            <View style={{ flex: 1, backgroundColor: c.bgGradStart }}>
                <AnimatedHeader scrollY={scrollY} title="Security Check" subtitle="Verify identity" isDark={isDark} colors={c} onBack={() => setStep('form')} />
                <ScrollView contentContainerStyle={{ padding: 24, paddingTop: Layout.header.maxHeight + insets.top + 20 }}>
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: c.text }}>Security Check</Text>
                                <Text style={{ fontSize: 12, color: c.subtext }}>Verify human identity</Text>
                            </View>
                            <TouchableOpacity onPress={refreshCaptcha} style={styles.iconBtn}>
                                <RefreshCw size={20} color={c.primary} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 24 }}>
                            {captchaInfo?.captcha_image ? (
                                <Animated.Image
                                    source={{ uri: captchaInfo.captcha_image.startsWith('data:') ? captchaInfo.captcha_image : `data:image/png;base64,${captchaInfo.captcha_image}` }}
                                    style={{ height: 60, width: 200, resizeMode: 'contain' }}
                                />
                            ) : (
                                <Text style={{ color: '#000', marginVertical: 20 }}>Loading...</Text>
                            )}
                        </View>

                        <TextInput
                            style={[styles.textInputForm, { textAlign: 'center', letterSpacing: 4, textTransform: 'uppercase', fontSize: 18, fontWeight: '800' }]}
                            placeholder="TYPE CAPTCHA..."
                            placeholderTextColor={c.subtext}
                            value={captchaCode}
                            onChangeText={setCaptchaCode}
                            autoCapitalize="characters"
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                            <TouchableOpacity onPress={() => setStep('form')} style={[styles.syncBtn, { flex: 1, backgroundColor: c.glassBgStart }]}>
                                <Text style={[styles.syncBtnText, { color: c.text }]}>BACK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleFetchResultsWithCaptcha} disabled={fetching} style={{ flex: 1 }}>
                                <LinearGradient colors={theme.gradients.primary} style={styles.syncBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    {fetching ? <ActivityIndicator color="#FFF" /> : <Text style={styles.syncBtnText}>VERIFY</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            {/* BACKGROUND */}
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* UNIVERSAL ANIMATED HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Results"
                subtitle="CGPA & GRADES"
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            >
                {/* Semester Selector */}
                <SemesterSelector isDark={isDark} />
            </AnimatedHeader>

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResults(); }} tintColor={c.text} progressViewOffset={Layout.header.maxHeight + insets.top} />}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
            >
                <View style={{ height: Layout.header.maxHeight + insets.top - 50 }} />

                {/* STATS ROW */}
                <View style={styles.statsRow}>
                    <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.statCard}>
                        <Text style={styles.statLabel}>SGPA</Text>
                        <Text style={[styles.statValue, { color: c.primary }]}>{currentResult ? currentResult.sgpa : '0.00'}</Text>
                    </LinearGradient>
                    <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.statCard}>
                        <Text style={styles.statLabel}>CGPA</Text>
                        <Text style={[styles.statValue, { color: c.accent }]}>{stats.cgpa}</Text>
                    </LinearGradient>
                    <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.statCard}>
                        <Text style={styles.statLabel}>CREDITS</Text>
                        <Text style={styles.statValue}>{currentResult ? currentResult.total_credits : 0}</Text>
                    </LinearGradient>
                </View>

                {/* Grading Ref Toggle */}
                <PressableScale style={styles.refToggle} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowGradingRef(!showGradingRef); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Info size={16} color={c.primary} />
                        <Text style={{ color: c.primary, fontWeight: '600' }}>Grading Key</Text>
                    </View>
                    {showGradingRef ? <ChevronUp size={18} color={c.subtext} /> : <ChevronDown size={18} color={c.subtext} />}
                </PressableScale>

                {showGradingRef && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
                        {([
                            { g: 'O', r: '90-100', p: 10 },
                            { g: 'A+', r: '75-89', p: 9 },
                            { g: 'A', r: '65-74', p: 8 },
                            { g: 'B+', r: '55-64', p: 7 },
                            { g: 'B', r: '50-54', p: 6 },
                            { g: 'C', r: '45-49', p: 5 },
                            { g: 'P', r: '40-44', p: 4 },
                            { g: 'F', r: '<40', p: 0 }
                        ] || []).map((item, i) => (
                            <LinearGradient key={i} colors={[c.glassBgStart, c.glassBgEnd]} style={styles.refChip}>
                                <Text style={{ fontWeight: 'bold', color: c.text, fontSize: 14 }}>{item.g}</Text>
                                <Text style={{ fontSize: 10, color: c.subtext }}>{item.r}</Text>
                                <Text style={{ fontSize: 9, color: c.primary, fontWeight: '600' }}>GP: {item.p}</Text>
                            </LinearGradient>
                        ))}
                    </ScrollView>
                )}

                {/* ACTIONS */}
                <View style={styles.actionRow}>
                    <Text style={styles.sectionTitle}>Subjects</Text>

                    {/* Right Side Actions Container */}
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <PressableScale style={styles.iconBtn} onPress={() => setStep('form')}>
                            <RefreshCw size={20} color={c.primary} />
                        </PressableScale>

                        <PressableScale style={styles.iconBtn} onPress={() => {
                            // Mock Report Download
                            const generatePDF = async () => {
                                try {
                                    setLoading(true);

                                    const current = (Array.isArray(results) ? results : []).find(r => r.semester === selectedSemester);
                                    if (!current) {
                                        Alert.alert("Error", "No data to export for this semester.");
                                        setLoading(false);
                                        return;
                                    }
                                    // ... func body continues ...

                                    const htmlContent = `
                                <!DOCTYPE html>
                                <html>
                                    <head>
                                        <style>
                                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
                                            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${theme.palette.purple}; padding-bottom: 20px; }
                                            .brand { color: ${theme.palette.purple}; font-size: 24px; font-weight: bold; }
                                            .title { font-size: 20px; font-weight: bold; margin-top: 10px; }
                                            .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
                                            
                                            .stats-grid { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 12px; }
                                            .stat-item { text-align: center; flex: 1; }
                                            .stat-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
                                            .stat-value { font-size: 24px; font-weight: bold; color: ${theme.palette.purple}; margin-top: 5px; }
                                            
                                            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
                                            th { text-align: left; padding: 12px; border-bottom: 2px solid #eee; color: #666; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
                                            td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
                                            .grade-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; color: white; font-weight: bold; font-size: 12px; }
                                            
                                            .footer { margin-top: 50px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 20px; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="header">
                                            <div class="brand">AcadHzub</div>
                                            <div class="title">Semester ${selectedSemester} Report</div>
                                            <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
                                        </div>

                                        <div class="stats-grid">
                                            <div class="stat-item">
                                                <div class="stat-label">SGPA</div>
                                                <div class="stat-value">${current.sgpa}</div>
                                            </div>
                                            <div class="stat-item">
                                                <div class="stat-label">CGPA</div>
                                                <div class="stat-value">${stats.cgpa}</div>
                                            </div>
                                            <div class="stat-item">
                                                <div class="stat-label">Credits</div>
                                                <div class="stat-value">${current.total_credits}</div>
                                            </div>
                                        </div>

                                        <table>
                                            <thead>
                                                <tr>
                                                    <th style="width: 40%">Subject</th>
                                                    <th style="width: 15%">Type</th>
                                                    <th style="width: 15%">Credits</th>
                                                    <th style="width: 15%">Score</th>
                                                    <th style="width: 15%">Grade</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${(current.subjects || []).map(sub => {
                                        let total = sub.total;
                                        // Recalculate if generic logic was used in display
                                        if (total === undefined) {
                                            if (sub.type?.toLowerCase() === 'nues') total = sub.internal_theory;
                                            else total = (parseInt(sub.internal_theory || 0) + parseInt(sub.external_theory || 0) + parseInt(sub.internal_practical || 0) + parseInt(sub.external_practical || 0));
                                        }

                                        let gradeColor = '#666';
                                        const g = (sub.grade || '').toUpperCase();
                                        if (g === 'O') gradeColor = theme.palette.green;
                                        else if (g === 'A+' || g === 'A') gradeColor = theme.palette.purple;
                                        else if (g === 'F') gradeColor = theme.palette.red;
                                        else gradeColor = theme.palette.orange;

                                        return `
                                                        <tr>
                                                            <td><b>${sub.name}</b><br/><span style="color:#999;font-size:10px">${sub.code || ''}</span></td>
                                                            <td style="text-transform:uppercase;font-size:10px">${sub.type}</td>
                                                            <td>${sub.credits}</td>
                                                            <td>${total}</td>
                                                            <td><span class="grade-badge" style="background-color: ${gradeColor}">${sub.grade}</span></td>
                                                        </tr>
                                                    `;
                                    }).join('')}
                                            </tbody>
                                        </table>

                                        <div class="footer">
                                            This report was generated via AcadHzub Mobile App.
                                        </div>
                                    </body>
                                </html>
                            `;

                                    const { uri } = await Print.printToFileAsync({ html: htmlContent });
                                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

                                } catch (error) {
                                    console.error(error);
                                    Alert.alert("Error", "Failed to generate PDF. Please try again.");
                                } finally {
                                    setLoading(false);
                                }
                            };

                            Alert.alert(
                                "Download Report",
                                `Generate PDF report for Semester ${selectedSemester}?`,
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Generate PDF", onPress: generatePDF }
                                ]
                            );
                        }}>
                            <Download size={20} color={c.primary} />
                        </PressableScale>
                    </View>
                </View>

                {/* LIST */}
                <View style={{ gap: 16, paddingBottom: 40 }}>
                    {(currentResult?.subjects || []).map(sub => renderSubjectCard(sub))}

                    {!currentResult && (
                        <View style={styles.emptyState}>
                            <Text style={{ color: c.subtext, marginBottom: 12 }}>No academic results available for this semester.</Text>
                            <TouchableOpacity onPress={() => setStep('form')} style={{ backgroundColor: c.glassBgStart, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder }}>
                                <Text style={{ color: c.primary, fontWeight: '700' }}>Fetch IPU Results</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Animated.ScrollView>
        </View>
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    headerContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        justifyContent: 'flex-end', paddingBottom: 16
    },
    glassOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: c.glassBgStart,
        borderBottomWidth: 1, borderBottomColor: c.glassBorder
    },
    headerContent: { paddingHorizontal: 24, gap: 16 },
    headerTitle: {
        fontWeight: '900', color: c.text, letterSpacing: -1
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 100 + insets.bottom
    },
    // SECTION 1: HEADER & CHIPS
    semScroll: {
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 20
    },
    semChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 22,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 85,
    },
    semChipActive: {
        backgroundColor: c.primary,
        borderColor: c.primary,
        shadowColor: c.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    semText: {
        fontWeight: '900',
        color: isDark ? '#A1A1AA' : '#666',
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    semTextActive: {
        color: '#FFF',
    },

    // SECTION 2: STATS CARDS
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24
    },
    statCard: {
        flex: 1, padding: 16, borderRadius: 20,
        alignItems: 'center', borderWidth: 1, borderColor: c.glassBorder
    },
    statLabel: { fontSize: 10, fontWeight: '700', color: c.subtext, marginBottom: 4 },
    statValue: { fontSize: 22, fontWeight: '800', color: c.text },

    refToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: c.glassBgEnd, marginBottom: 12 },
    refChip: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder, minWidth: 50, alignItems: 'center' },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: c.text },
    iconBtn: { padding: 8, backgroundColor: c.glassBgStart, borderRadius: 12 },

    // Cards
    card: {
        borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
        borderWidth: 1, borderColor: c.glassBorder, marginBottom: 0, backgroundColor: c.surface
    },
    gradeBadge: {
        width: 48, height: 48, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    gradeText: { fontSize: 18, fontWeight: '900', color: '#FFF' },
    subHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    subName: { fontSize: 16, fontWeight: '700', color: c.text, flex: 1, marginRight: 8 },
    chip: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: c.glassBgEnd, borderRadius: 6 },
    chipText: { fontSize: 9, fontWeight: '800', color: c.subtext },
    marksContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    markPill: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: c.glassBgStart },
    markLabel: { fontSize: 9, color: c.subtext, fontWeight: '700' },
    markValue: { fontSize: 9, color: c.text, fontWeight: '700' },
    totalText: { fontSize: 12, fontWeight: '800', color: c.text, marginLeft: 'auto' },

    // Form
    inputLabelForm: { fontSize: 10, fontWeight: '800', color: c.subtext, marginBottom: 8, letterSpacing: 0.5 },
    textInputForm: { backgroundColor: c.inputBg, borderRadius: 12, padding: 16, color: c.text, fontSize: 16, borderWidth: 1, borderColor: c.glassBorder },
    passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder },
    syncBtn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    syncBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 1 },

    // Edit
    editCard: { padding: 16, borderRadius: 24, borderWidth: 1, borderColor: c.glassBorder },
    editHeader: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    input: { backgroundColor: c.inputBg, borderRadius: 12, padding: 12, color: c.text },
    editRow: { flexDirection: 'row', gap: 8 },
    miniLabel: { fontSize: 9, color: c.subtext, textAlign: 'center', marginBottom: 4 },
    inputSmall: { backgroundColor: c.inputBg, borderRadius: 8, padding: 8, color: c.text, textAlign: 'center' },
    typeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    typeChip: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: c.glassBgEnd, alignItems: 'center', borderWidth: 1, borderColor: c.glassBorder },
    typeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    typeChipText: { fontSize: 10, fontWeight: '800', color: c.subtext },
    typeChipTextActive: { color: '#FFF' },
    addBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 1, borderColor: c.primary, borderStyle: 'dashed', borderRadius: 20 },

    emptyState: { alignItems: 'center', padding: 40 }
});

export default ResultsScreen;



