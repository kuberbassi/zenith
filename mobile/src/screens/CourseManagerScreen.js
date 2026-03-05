import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, Modal, TextInput, Alert, Animated, Platform, RefreshControl, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from '../components/LinearGradient';
import { theme, Layout } from '../theme';
import { Plus, X, Globe, Video, Clock, Trash2, Edit2, ExternalLink, Save, CheckCircle2 } from 'lucide-react-native';
import { attendanceService } from '../services';
import AnimatedHeader from '../components/AnimatedHeader';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import PressableScale from '../components/PressableScale';

const PLATFORMS = [
    { value: 'coursera', label: 'Coursera', icon: Globe, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
    { value: 'udemy', label: 'Udemy', icon: Video, color: '#A855F7', bg: 'rgba(168, 85, 247, 0.1)' },
    { value: 'youtube', label: 'YouTube', icon: Video, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
    { value: 'custom', label: 'Custom', icon: Globe, color: '#6B7280', bg: 'rgba(107, 114, 128, 0.1)' },
];

const { height } = Dimensions.get('window');

const CourseManagerScreen = ({ navigation }) => {
    const { isDark, colors: themeColors } = useTheme();
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        platform: 'coursera',
        url: '',
        progress: '0',
        instructor: '',
        targetCompletionDate: '',
        enrolledDate: new Date().toISOString().split('T')[0],
        notes: '',
        certificateUrl: ''
    });
    const [editingItem, setEditingItem] = useState(null);

    // Animation Refs
    const modalScale = useRef(new Animated.Value(0.9)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    const animateModal = (toVisible) => {
        if (toVisible) {
            modalScale.setValue(0.9);
            modalOpacity.setValue(0);
            Animated.parallel([
                Animated.spring(modalScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();
        }
    };

    useEffect(() => {
        if (modalVisible) animateModal(true);
    }, [modalVisible]);

    const c = {
        bgStart: isDark ? '#000000' : '#F8F9FA',
        bgEnd: isDark ? '#000000' : '#FFFFFF',
        text: isDark ? '#FFFFFF' : '#000000',
        subtext: isDark ? '#9CA3AF' : '#6B7280',
        card: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
        border: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        primary: themeColors.primary, // Dynamic accent
        accent: themeColors.primary,
        gradients: themeColors.gradients, // Dynamic gradients
        glassBgStart: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
        glassBgEnd: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
        glassBorder: 'rgba(255,255,255,0.15)',
        completionGreen: '#10B981',
        completionGreenBg: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
        completionGreenBorder: isDark ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)',
    };

    useEffect(() => { fetchCourses(); }, []);

    const fetchCourses = async () => {
        try {
            const data = await attendanceService.getManualCourses();
            setCourses(data);
        } catch (e) { console.error(e); }
        finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRefreshing(true);
        fetchCourses();
    };

    const handleSave = async () => {
        if (!formData.title) return Alert.alert("Required", "Please enter a course title");
        try {
            const payload = {
                ...formData,
                progress: parseInt(formData.progress) || 0,
            };

            if (editingItem) {
                const id = editingItem._id?.$oid || editingItem._id;
                await attendanceService.updateManualCourse(id, payload);
            } else {
                await attendanceService.saveManualCourses(payload); // Note: Service expects list or single? 
                // Service `saveManualCourses` calls `POST /api/v1/academic/courses/manual`.
                // Backend `handle_manual_courses` handles list or single dict.
            }
            setModalVisible(false);
            fetchCourses();
        } catch (e) { Alert.alert("Error", "Failed to save"); }
    };

    const handleDelete = async (id) => {
        Alert.alert("Delete", "Are you sure you want to delete this course?", [
            { text: "Cancel", style: 'cancel' },
            {
                text: "Delete", style: 'destructive', onPress: async () => {
                    try {
                        const oid = id.$oid || id;
                        await attendanceService.deleteManualCourse(oid);
                        setModalVisible(false);
                        setEditingItem(null);
                        fetchCourses();
                    } catch (e) {
                        Alert.alert("Error", "Failed to delete course");
                    }
                }
            }
        ]);
    };

    const getPlatformConfig = (val) => PLATFORMS.find(p => p.value === val) || PLATFORMS[6];

    const renderItem = ({ item }) => {
        const platform = getPlatformConfig(item.platform);
        const Icon = platform.icon;
        const isCompleted = item.progress >= 100;
        const progressColor = isCompleted ? c.completionGreen : platform.color;

        return (
            <PressableScale
                activeOpacity={0.9}
                onPress={() => {
                    setEditingItem(item);
                    setFormData({
                        ...item,
                        progress: String(item.progress || 0),
                        enrolledDate: item.enrolledDate || new Date().toISOString().split('T')[0],
                        notes: item.notes || '',
                        certificateUrl: item.certificateUrl || ''
                    });
                    setModalVisible(true);
                }}
                style={[
                    styles.card,
                    {
                        borderWidth: 0, // Border moved to Gradient
                        padding: 0 // Padding moved to Gradient
                    }
                ]}
            >
                <LinearGradient
                    colors={isCompleted ? [c.completionGreenBg, c.completionGreenBg] : [c.glassBgStart, c.glassBgEnd]}
                    style={{
                        padding: 18,
                        width: '100%',
                        borderRadius: 22,
                        borderWidth: isCompleted ? 1.5 : 1,
                        borderColor: isCompleted ? c.completionGreenBorder : c.glassBorder
                    }}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                >
                    <View style={styles.cardHeader}>
                        <View style={[styles.badge, { backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : platform.bg }]}>
                            <Icon size={12} color={isCompleted ? c.completionGreen : platform.color} />
                            <Text style={[styles.badgeText, { color: isCompleted ? c.completionGreen : platform.color }]}>
                                {isCompleted ? 'COMPLETED' : platform.label}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {isCompleted && <CheckCircle2 size={18} color={c.completionGreen} strokeWidth={2.5} />}
                            {item.url ? (
                                <PressableScale onPress={() => Linking.openURL(item.url).catch(() => { })} style={{ padding: 4 }}>
                                    <ExternalLink size={16} color={c.subtext} />
                                </PressableScale>
                            ) : null}
                        </View>
                    </View>

                    <Text style={[styles.title, { color: c.text, fontSize: 18 }]} numberOfLines={2}>{item.title}</Text>
                    {item.instructor ? <Text style={[styles.instructor, { color: c.subtext, fontSize: 13 }]}>by {item.instructor}</Text> : null}

                    <View style={{ marginTop: 14 }}>
                        <View style={styles.progressRow}>
                            <Text style={[styles.progressLabel, { color: c.subtext }]}>Progress</Text>
                            <Text style={[styles.progressVal, { color: isCompleted ? c.completionGreen : c.text, fontWeight: isCompleted ? '800' : '700' }]}>
                                {item.progress}%
                            </Text>
                        </View>
                        <View style={[styles.track, { height: 8, backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB' }]}>
                            <LinearGradient
                                colors={isCompleted ? [c.completionGreen, '#34D399'] : [progressColor, progressColor]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ width: `${item.progress}%`, height: '100%', borderRadius: 4 }}
                                noTexture // Progress bar needs no texture
                            />
                        </View>
                    </View>

                    {item.targetCompletionDate ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
                            <Clock size={11} color={c.subtext} />
                            <Text style={{ fontSize: 11, color: c.subtext, fontWeight: '600' }}>Target: {item.targetCompletionDate}</Text>
                        </View>
                    ) : null}
                </LinearGradient>
            </PressableScale>
        );
    };

    const styles = StyleSheet.create({
        card: {
            padding: 18, borderRadius: 22, marginBottom: 14, borderWidth: 0,
            shadowColor: "transparent",
            shadowOffset: { height: 0, width: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
        badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
        badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
        title: { fontSize: 18, fontWeight: '800', lineHeight: 24, letterSpacing: -0.3 },
        instructor: { fontSize: 13, marginTop: 3, fontWeight: '500' },
        progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        progressLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
        progressVal: { fontSize: 13, fontWeight: '700' },
        track: { height: 8, backgroundColor: isDark ? '#2C2C2E' : '#E5E7EB', borderRadius: 4, overflow: 'hidden' },

        fab: {
            position: 'absolute', bottom: 30, right: 30,
            width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center',
            shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
            zIndex: 999
        },
        modalView: {
            flex: 1, backgroundColor: isDark ? '#000000' : '#F2F2F7',
            marginTop: 80, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24
        },
        input: {
            backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
            padding: 14, borderRadius: 12, color: c.text, marginBottom: 16,
            fontSize: 15
        },
        label: { color: c.subtext, fontSize: 11, marginBottom: 6, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase' },
        platformChip: {
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
            flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginRight: 8
        },
        modalRefined: {
            borderRadius: 32, maxHeight: height * 0.9, width: '100%',
            overflow: 'hidden', borderWidth: 1, borderColor: c.glassBorder,
            flexShrink: 1, paddingTop: 12
        },
        dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
            marginBottom: 16,
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '900',
            letterSpacing: -0.5
        },
        countBadge: {
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            borderWidth: 1
        },
        countText: {
            fontSize: 13,
            fontWeight: '800'
        }
    });

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgStart, c.bgEnd]} noTexture style={StyleSheet.absoluteFill} />
            <AnimatedHeader
                title="My Courses"
                subtitle="ONLINE LEARNING"
                scrollY={scrollY}
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
            />

            <Animated.SectionList
                contentContainerStyle={{ padding: 20, paddingBottom: 100, paddingTop: 100 + insets.top }}
                sections={[
                    {
                        title: 'In Progress',
                        data: (Array.isArray(courses) ? courses : []).filter(c => c.progress > 0 && c.progress < 100)
                    },
                    {
                        title: 'Not Started',
                        data: (Array.isArray(courses) ? courses : []).filter(c => c.progress === 0)
                    },
                    {
                        title: 'Completed',
                        data: (Array.isArray(courses) ? courses : []).filter(c => c.progress >= 100)
                    }
                ].filter(section => section.data.length > 0)}
                renderItem={renderItem}
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>{section.title}</Text>
                        <View style={[
                            styles.countBadge,
                            {
                                backgroundColor: section.title === 'Completed' ? c.completionGreenBg : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                                borderColor: section.title === 'Completed' ? c.completionGreenBorder : 'transparent'
                            }
                        ]}>
                            <Text style={[
                                styles.countText,
                                { color: section.title === 'Completed' ? c.completionGreen : c.subtext }
                            ]}>
                                {section.data.length}
                            </Text>
                        </View>
                    </View>
                )}
                keyExtractor={item => item._id?.$oid || item._id || Math.random().toString()}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        progressBackgroundColor={isDark ? '#000000' : '#FFFFFF'}
                        progressViewOffset={Layout.header.minHeight + insets.top + 15}
                    />
                }
                stickySectionHeadersEnabled={false}
            />

            <PressableScale
                style={[styles.fab, { overflow: 'hidden' }]}
                onPress={() => {
                    setFormData({
                        title: '',
                        platform: 'coursera',
                        url: '',
                        progress: '0',
                        instructor: '',
                        targetCompletionDate: '',
                        enrolledDate: new Date().toISOString().split('T')[0],
                        notes: '',
                        certificateUrl: ''
                    });
                    setEditingItem(null);
                    setModalVisible(true);
                }}
            >
                <LinearGradient colors={c.gradients.primary} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Plus color="#FFF" size={28} />
                </LinearGradient>
            </PressableScale>

            {/* MODAL - Flush Bottom Sheet */}
            <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} activeOpacity={1} />
                    <Animated.View style={[styles.modalRefined, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                        <LinearGradient colors={[isDark ? '#000000' : '#FFFFFF', isDark ? '#000000' : '#F2F2F7']} style={{ flexShrink: 1 }}>
                            <View style={styles.dragHandle} />
                            <View style={{ padding: 24, paddingBottom: 0, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                                <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }}>{editingItem ? 'Edit' : 'Add'} Course</Text>
                                <PressableScale onPress={() => setModalVisible(false)}><X color={c.text} /></PressableScale>
                            </View>

                            <View style={{ flexShrink: 1, maxHeight: height * 0.7 }}>
                                <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }} style={{ flexGrow: 0 }}>
                                    <Text style={styles.label}>TITLE</Text>
                                    <TextInput style={styles.input} value={formData.title} onChangeText={t => setFormData({ ...formData, title: t })} placeholder="Course Name" placeholderTextColor={c.subtext} />

                                    <Text style={styles.label}>PLATFORM</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
                                        {PLATFORMS.map(p => (
                                            <PressableScale
                                                key={p.value}
                                                style={[styles.platformChip, {
                                                    backgroundColor: formData.platform === p.value ? p.bg : 'transparent',
                                                    borderColor: formData.platform === p.value ? p.color : c.border
                                                }]}
                                                onPress={() => setFormData({ ...formData, platform: p.value })}
                                            >
                                                <p.icon size={14} color={formData.platform === p.value ? p.color : c.subtext} style={{ marginRight: 6 }} />
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: formData.platform === p.value ? p.color : c.subtext }}>{p.label}</Text>
                                            </PressableScale>
                                        ))}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>PROGRESS (%)</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" value={String(formData.progress || '')} onChangeText={t => setFormData({ ...formData, progress: t })} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.label}>TARGET DATE</Text>
                                            <TextInput style={styles.input} value={formData.targetCompletionDate} onChangeText={t => setFormData({ ...formData, targetCompletionDate: t })} placeholder="YYYY-MM-DD" placeholderTextColor={c.subtext} />
                                        </View>
                                    </View>

                                    <Text style={styles.label}>INSTRUCTOR</Text>
                                    <TextInput style={styles.input} value={formData.instructor} onChangeText={t => setFormData({ ...formData, instructor: t })} placeholder="Instructor Name" placeholderTextColor={c.subtext} />

                                    <Text style={styles.label}>URL (Optional)</Text>
                                    <TextInput style={styles.input} value={formData.url} onChangeText={t => setFormData({ ...formData, url: t })} placeholder="https://..." placeholderTextColor={c.subtext} />

                                    <Text style={styles.label}>CERTIFICATE URL (Optional)</Text>
                                    <TextInput style={styles.input} value={formData.certificateUrl} onChangeText={t => setFormData({ ...formData, certificateUrl: t })} placeholder="Link to certificate" placeholderTextColor={c.subtext} />

                                    <Text style={styles.label}>NOTES</Text>
                                    <TextInput
                                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                        value={formData.notes}
                                        onChangeText={t => setFormData({ ...formData, notes: t })}
                                        placeholder="Add notes..."
                                        placeholderTextColor={c.subtext}
                                        multiline
                                    />

                                    {editingItem && (
                                        <PressableScale onPress={() => handleDelete(editingItem._id)} style={{ padding: 16, alignItems: 'center', marginTop: 8 }}>
                                            <Text style={{ color: '#FF3B30', fontWeight: '600' }}>Delete Course</Text>
                                        </PressableScale>
                                    )}
                                    <View style={{ height: 20 }} />
                                </Animated.ScrollView>
                            </View>

                            {/* Sticky Footer */}
                            <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: c.border }}>
                                <PressableScale onPress={handleSave} style={{ borderRadius: 16, overflow: 'hidden' }}>
                                    <LinearGradient colors={c.gradients.primary} style={{ padding: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                        <Save size={20} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>SAVE COURSE</Text>
                                    </LinearGradient>
                                </PressableScale>
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};

export default CourseManagerScreen;



