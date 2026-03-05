import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal,
    Animated, ScrollView, Platform, TextInput, Switch, KeyboardAvoidingView
} from 'react-native';
import { theme } from '../theme';
import api from '../services/api';
import { ChevronLeft, Edit2, Calendar, CheckCircle, XCircle, X, Trash2, Clock, AlertCircle, Shield } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import { useTheme } from '../contexts/ThemeContext';

import AddSubjectModal from '../components/AddSubjectModal';

const SubjectDetailScreen = ({ route, navigation }) => {
    const { subject: initialSubject } = route.params;
    const { isDark } = useTheme();

    // AMOLED Theme Colors
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
        success: theme.palette.green,
        danger: theme.palette.red,
        warning: theme.palette.orange,
        purple: theme.palette.magenta,
        inputBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        surface: isDark ? '#121212' : '#FFFFFF',
    };

    const styles = getStyles(c, isDark);
    const scrollY = useRef(new Animated.Value(0)).current;

    const [subject, setSubject] = useState(initialSubject);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Animations
    const modalScale = useRef(new Animated.Value(0.9)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (logModalVisible) {
            modalScale.setValue(0.9);
            modalOpacity.setValue(0);
            Animated.parallel([
                Animated.spring(modalScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(modalOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();
        }
    }, [logModalVisible]);

    // Modals
    const [editSubjectVisible, setEditSubjectVisible] = useState(false);
    const [logModalVisible, setLogModalVisible] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [statusNote, setStatusNote] = useState('');

    useEffect(() => { fetchLogs(); }, []);

    const fetchLogs = async () => {
        try {
            const response = await api.get(`/api/attendance/logs?subject_id=${subject._id}`);
            setLogs(response.data.logs);
        } catch (error) { console.error(error); }
        finally { setLoading(false); setRefreshing(false); }
    };

    // --- SUBJECT MANAGEMENT ---

    const openEditSubject = () => {
        setEditSubjectVisible(true);
    };

    const saveSubject = async (updatedData) => {
        try {
            await api.put(`/api/academic/subjects/${subject._id}`, updatedData);
            setSubject({ ...subject, ...updatedData });
            setEditSubjectVisible(false);
            Alert.alert("Success", "Subject updated successfully.");
        } catch (error) { Alert.alert("Error", "Failed to update subject."); }
    };

    const deleteSubject = async (subjectId) => {
        try {
            await api.delete(`/api/academic/subjects/${subjectId}`);
            setEditSubjectVisible(false);
            navigation.goBack();
        } catch (e) { Alert.alert("Error", "Failed to delete."); }
    };

    // --- ATTENDANCE MANAGEMENT ---

    const handleLogAction = async (newStatus) => {
        if (!selectedLog) return;
        try {
            await api.put(`/api/attendance/logs/${selectedLog._id}`, {
                status: newStatus,
                date: selectedLog.date, // Preserve date
                notes: statusNote
            });
            setLogModalVisible(false);
            fetchLogs();
        } catch (error) { Alert.alert("Error", "Update failed."); }
    };

    const deleteLog = async () => {
        if (!selectedLog) return;
        Alert.alert("Delete Log", "Remove this attendance record?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive",
                onPress: async () => {
                    try {
                        await api.delete(`/api/attendance/logs/${selectedLog._id}`);
                        setLogModalVisible(false);
                        fetchLogs();
                    } catch (e) { Alert.alert("Error", "Failed to delete log."); }
                }
            }
        ]);
    };

    // --- RENDERERS ---

    const getStatusTheme = (status) => {
        switch (status) {
            case 'present': return { colors: theme.gradients.success, Icon: CheckCircle };
            case 'approved_medical': return { colors: theme.gradients.success, Icon: Shield };
            case 'absent': return { colors: theme.gradients.danger, Icon: XCircle };
            case 'late': return { colors: theme.gradients.orange, Icon: AlertCircle };
            case 'cancelled': return { colors: ['#64748B', '#475569'], Icon: XCircle };
            case 'substituted': return { colors: theme.gradients.magenta, Icon: Clock };
            default: return { colors: ['#94A3B8', '#64748B'], Icon: AlertCircle };
        }
    };

    const renderLogItem = ({ item }) => {
        const { colors: gradColors, Icon } = getStatusTheme(item.status);
        const color = gradColors[0];

        return (
            <PressableScale
                onPress={() => { setSelectedLog(item); setStatusNote(item.notes || ''); setLogModalVisible(true); }}
            >
                <LinearGradient colors={[c.glassBgStart, c.glassBgEnd]} style={styles.logCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <LinearGradient colors={gradColors} style={styles.iconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Icon size={18} color="#FFF" />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.dateText}>{item.date}</Text>
                            <Text style={[styles.statusText, { color: color }]}>{item.status.toUpperCase().replace('_', ' ')}</Text>
                            {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
                        </View>
                        <ChevronRight size={18} color={c.subtext} opacity={0.5} />
                    </View>
                </LinearGradient>
            </PressableScale>
        );
    };

    const headerHeight = scrollY.interpolate({ inputRange: [0, 100], outputRange: [130, 70], extrapolate: 'clamp' });
    const titleScale = scrollY.interpolate({ inputRange: [0, 100], outputRange: [1, 0.9], extrapolate: 'clamp' });

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} />

            {/* FLUID HEADER */}
            <Animated.View style={[styles.header, { height: headerHeight }]}>
                <Animated.View style={[styles.glassOverlay, { opacity: scrollY.interpolate({ inputRange: [0, 100], outputRange: [0, 1] }) }]} />

                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <ChevronLeft size={24} color={c.text} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                        <Animated.Text style={[styles.headerTitle, { transform: [{ scale: titleScale }] }]} numberOfLines={1}>{subject.name}</Animated.Text>
                        <Text style={styles.headerSub}>{subject.code} • {subject.professor || 'No Prof'}</Text>
                    </View>

                    <TouchableOpacity style={styles.backBtn} onPress={openEditSubject}>
                        <Edit2 size={20} color={c.primary} />
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Animated.FlatList
                data={logs}
                renderItem={renderLogItem}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.list}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                onRefresh={() => { setRefreshing(true); fetchLogs(); }}
                refreshing={refreshing}
                ListHeaderComponent={<View style={{ height: 140 }} />}
                ListEmptyComponent={<Text style={styles.empty}>No attendance history found.</Text>}
            />

            {/* --- LOG EDIT MODAL --- */}
            <Modal animationType="fade" transparent={true} visible={logModalVisible} onRequestClose={() => setLogModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                    <Animated.View style={{ transform: [{ scale: modalScale }], opacity: modalOpacity, flex: 1, justifyContent: 'center' }}>
                        <LinearGradient
                            colors={[isDark ? '#000000' : '#ffffff', isDark ? '#000000' : '#f0f0f0']}
                            style={styles.modalContent}
                        >
                            <View style={styles.dragBar} />
                            <Text style={styles.modalTitle}>Edit Attendance</Text>
                            <Text style={styles.modalSub}>{selectedLog?.date}</Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
                                {[
                                    { id: 'present', label: 'Present', color: c.success },
                                    { id: 'absent', label: 'Absent', color: c.danger },
                                    { id: 'late', label: 'Late', color: c.warning },
                                    { id: 'approved_medical', label: 'Medical (Appr)', color: c.success },
                                    { id: 'medical', label: 'Medical (Exc)', color: c.subtext },
                                    { id: 'cancelled', label: 'Cancelled', color: c.subtext },
                                    { id: 'substituted', label: 'Substituted', color: c.purple },
                                ].map((opt) => (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[styles.statusChip, { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                                        onPress={() => handleLogAction(opt.id)}
                                    >
                                        <Text style={[styles.chipText, { color: opt.color }]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TextInput
                                style={styles.input}
                                placeholder="Add a note..."
                                placeholderTextColor={c.subtext}
                                value={statusNote}
                                onChangeText={setStatusNote}
                            />

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                                <TouchableOpacity style={[styles.fullBtn, { backgroundColor: c.danger + '20' }]} onPress={deleteLog}>
                                    <Trash2 size={20} color={c.danger} />
                                    <Text style={{ color: c.danger, fontWeight: '700' }}>Delete Log</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.fullBtn, { backgroundColor: c.inputBg }]} onPress={() => setLogModalVisible(false)}>
                                    <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- SUBJECT EDIT MODAL --- */}
            <AddSubjectModal
                visible={editSubjectVisible}
                onClose={() => setEditSubjectVisible(false)}
                onSave={saveSubject}
                onDelete={deleteSubject}
                initialData={subject}
                isDark={isDark}
            />
        </View>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, justifyContent: 'flex-end', paddingBottom: 16 },
    glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.bgGradStart, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 16 },
    backBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
    headerTitle: { fontSize: 22, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    headerSub: { color: c.subtext, fontWeight: '600', fontSize: 13, marginTop: 2 },
    list: { paddingHorizontal: 16, paddingBottom: 40 },
    logCard: { padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface },
    iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dateText: { fontSize: 15, fontWeight: '800', color: c.text, letterSpacing: -0.3 },
    statusText: { fontSize: 11, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    notesText: { fontSize: 12, color: c.subtext, marginTop: 4, fontStyle: 'italic' },
    empty: { textAlign: 'center', marginTop: 60, color: c.subtext, fontSize: 15, fontWeight: '600' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
    modalContent: { borderRadius: 32, padding: 24, paddingBottom: 24, maxHeight: '85%', width: '100%', borderWidth: 1, borderColor: c.glassBorder, backgroundColor: '#000000' },

    dragBar: { width: 40, height: 4, backgroundColor: c.subtext, borderRadius: 10, opacity: 0.3, marginBottom: 20, alignSelf: 'center' },
    modalTitle: { fontSize: 24, fontWeight: '900', color: c.text, marginBottom: 4, letterSpacing: -0.5 },
    modalSub: { color: c.subtext, marginBottom: 24, fontWeight: '600' },
    statusRow: { flexDirection: 'row', gap: 12, paddingBottom: 20 },
    statusChip: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, borderWidth: 1 },
    chipText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
    input: { backgroundColor: c.inputBg, borderRadius: 16, padding: 16, color: c.text, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: c.glassBorder },
    label: { color: c.subtext, fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    fullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, gap: 10, flex: 1 },
});

export default SubjectDetailScreen;



