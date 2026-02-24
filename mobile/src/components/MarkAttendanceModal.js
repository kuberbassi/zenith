import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, TextInput, Platform, Dimensions, Alert, Animated } from 'react-native';
import PressableScale from './PressableScale';
import { useTheme } from '../contexts/ThemeContext';
import { theme } from '../theme';
import { X, Check, X as XIcon, MoreHorizontal, Calendar as CalendarIcon, Trash2, Edit2, AlertCircle, Ban, Activity, RefreshCw, Save } from 'lucide-react-native';
import { LinearGradient } from './LinearGradient';
import { useSemester } from '../contexts/SemesterContext';
import { attendanceService } from '../services';

const { height } = Dimensions.get('window');
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

const MarkAttendanceModal = ({ visible, onClose, date, classes, onMark, onRefresh, loading, allSubjects = [] }) => {
    const { isDark, colors: themeColors } = useTheme();
    const { selectedSemester } = useSemester();

    const getMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };

    const sortedClasses = [...(classes || [])].sort((a, b) => {
        const timeA = a.startTime || (a.time ? a.time.split(' - ')[0] : '00:00 AM');
        const timeB = b.startTime || (b.time ? b.time.split(' - ')[0] : '00:00 AM');
        return getMinutes(timeA) - getMinutes(timeB);
    });

    // Merge dynamic theme colors with local overrides
    const c = {
        ...themeColors,
        glassBg: isDark ? ['#000000', '#000000'] : ['rgba(255, 255, 255, 0.98)', 'rgba(240, 240, 240, 0.98)'],
        glassBorder: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        text: isDark ? '#FFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',
        primary: themeColors.primary, // Use dynamic accent
        success: theme.palette.green,
        warning: theme.palette.orange,
        medical: themeColors.primary,
        substituted: theme.palette.magenta,
        danger: theme.palette.red,
        surface: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    };

    const styles = getStyles(c, isDark);

    const [advancedClass, setAdvancedClass] = useState(null);
    const [note, setNote] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [substitutedBy, setSubstitutedBy] = useState('');
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [subjects, setSubjects] = useState([]);

    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            if (date) {
                fetchAttendanceLogs();
                fetchSubjects();
            }
            // Reset to visible values directly to avoid any animation stickiness for now
            scaleAnim.setValue(1);
            opacityAnim.setValue(1);
        } else {
            scaleAnim.setValue(0.9);
            opacityAnim.setValue(0);
        }
    }, [visible, date, selectedSemester]);

    const fetchSubjects = async () => {
        try {
            const data = await attendanceService.getSubjects(selectedSemester);
            setSubjects(data || []);
        } catch (error) {
            console.error('Failed to fetch subjects:', error);
        }
    };

    const fetchAttendanceLogs = async () => {
        try {
            const data = await attendanceService.getLogsForDate(date);
            setAttendanceLogs(data || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    const getSafeId = (val) => {
        if (!val) return '';
        if (typeof val === 'object') return val.$oid || val.toString();
        return String(val);
    };

    const deleteLog = async (logId) => {
        try {
            const cleanId = typeof logId === 'object' ? (logId.$oid || String(logId)) : String(logId);
            await attendanceService.deleteAttendance(cleanId);
            fetchAttendanceLogs();
            // Trigger a refresh in the parent without calling onMark with empty args
            if (onRefresh) onRefresh();
        } catch (error) {
            Alert.alert('Error', 'Failed to delete log');
        }
    };

    const openAdvanced = (cls) => {
        setAdvancedClass(cls);
        setSelectedStatus(cls.marked_status || 'present');
        setNote(cls.note || '');
        setSubstitutedBy(cls.substituted_by || '');
    };

    const closeAdvanced = () => {
        setAdvancedClass(null);
        setNote('');
        setSelectedStatus(null);
        setSubstitutedBy('');
    };

    const handleConfirmAdvanced = () => {
        if (advancedClass) {
            const payload = {
                id: advancedClass._id || advancedClass.id,
                status: selectedStatus,
                logId: advancedClass.log_id,
                sub: substitutedBy
            };
            console.log("💾 handleConfirmAdvanced triggering onMark:", payload);

            if (advancedClass.isMerged) {
                console.log(`🔗 Merged Class: Processing ${advancedClass.originalClasses.length} slots`);
                advancedClass.originalClasses.forEach((cls, i) => {
                    const isLast = i === advancedClass.originalClasses.length - 1;
                    const id = getSafeId(cls._id || cls.id);
                    onMark(id, selectedStatus, note, cls.log_id, !isLast, cls.type, substitutedBy);
                });
            } else {
                const id = getSafeId(advancedClass._id || advancedClass.id);
                onMark(id, selectedStatus, note, advancedClass.log_id, false, advancedClass.type, substitutedBy);
            }
            closeAdvanced();
        } else {
            console.warn("⚠️ handleConfirmAdvanced: advancedClass is null");
        }
    };

    const handleClearMark = () => {
        if (advancedClass) {
            if (advancedClass.isMerged) {
                advancedClass.originalClasses.forEach((cls, i) => {
                    const isLast = i === advancedClass.originalClasses.length - 1;
                    const cleanSubId = getSafeId(cls.subject_id || cls.subjectId || cls.id || cls._id);
                    onMark(cleanSubId, 'pending', '', cls.log_id, !isLast, cls.type);
                });
            } else {
                const cleanSubId = getSafeId(advancedClass.subject_id || advancedClass.subjectId || advancedClass.id || advancedClass._id);
                onMark(cleanSubId, 'pending', '', advancedClass.log_id, false, advancedClass.type);
            }
            closeAdvanced();
        }
    };

    const groupConsecutiveClasses = (classesList) => {
        if (!classesList || classesList.length === 0) return [];
        const grouped = [];
        let currentGroup = null;

        classesList.forEach((slot) => {
            const slotId = getSafeId(slot.id || slot._id);
            const subjectId = getSafeId(slot.subject_id || slot.subjectId || slot.id || slot._id);
            const isSameSubject = currentGroup &&
                ((subjectId && getSafeId(currentGroup.subject_id || currentGroup.subjectId || currentGroup.id) === subjectId) || (slot.name === currentGroup.name)) &&
                !slot.is_extra && !currentGroup.is_extra; // CRITICAL: Don't group extra/sub logs

            if (currentGroup && isSameSubject && slot.type === currentGroup.type) {
                currentGroup.originalClasses.push(slot);
                if (slot.time && currentGroup.startTime) {
                    const parts = slot.time.split(' - ');
                    const end = parts[1] || parts[0];
                    currentGroup.time = `${currentGroup.startTime} - ${end}`;
                }
            } else {
                const timeParts = slot.time ? slot.time.split(' - ') : [];
                currentGroup = {
                    ...slot,
                    _id: slotId,
                    isMerged: true,
                    originalClasses: [slot],
                    startTime: timeParts[0] || '10:00 AM'
                };
                grouped.push(currentGroup);
            }
        });

        return grouped.map(g => ({ ...g, isMerged: g.originalClasses.length > 1 }));
    };

    const groupedClasses = groupConsecutiveClasses(sortedClasses);

    const renderAdvancedContent = () => {
        if (!advancedClass) return null;
        return (
            <View style={{ flex: 1 }}>
                <View style={styles.advHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.advTitle} numberOfLines={1}>{advancedClass.name || advancedClass.code}</Text>
                        <Text style={styles.advSub}>Detailed Attendance</Text>
                    </View>
                    <PressableScale onPress={closeAdvanced} style={styles.closeBtn}>
                        <X size={20} color={c.text} />
                    </PressableScale>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} style={{ flex: 1 }}>
                    <View style={styles.statusGrid}>
                        {[
                            { id: 'present', icon: Check, color: c.success },
                            { id: 'absent', icon: XIcon, color: c.danger },
                            { id: 'medical', icon: Activity, color: c.medical },
                            { id: 'cancelled', icon: Ban, color: c.subtext },
                            { id: 'substituted', icon: RefreshCw, color: c.substituted }
                        ].map((status, index, array) => {
                            const isActive = selectedStatus === status.id;
                            const Icon = status.icon;
                            const isLastFull = array.length % 2 !== 0 && index === array.length - 1;
                            return (
                                <PressableScale
                                    key={status.id}
                                    style={[
                                        styles.statusOption,
                                        isLastFull && { width: '100%' },
                                        isActive && { borderColor: status.color, backgroundColor: status.color + '15' }
                                    ]}
                                    onPress={() => setSelectedStatus(status.id)}
                                >
                                    <Icon size={18} color={isActive ? status.color : c.subtext} strokeWidth={isActive ? 2.5 : 2} />
                                    <Text style={[styles.statusLabel, { color: isActive ? status.color : c.subtext, marginLeft: 10 }]}>
                                        {status.id.charAt(0).toUpperCase() + status.id.slice(1)}
                                    </Text>
                                </PressableScale>
                            );
                        })}
                    </View>

                    {selectedStatus === 'substituted' && (
                        <View style={{ marginBottom: 20 }}>
                            <Text style={styles.label}>Substituted By</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                {subjects.filter(s => {
                                    const subId = getSafeId(s._id || s.id);
                                    const currentSubId = getSafeId(advancedClass.subject_id || advancedClass.id);
                                    return subId !== currentSubId;
                                }).map((sub) => {
                                    const subId = getSafeId(sub._id || sub.id);
                                    const isSelected = substitutedBy === subId;
                                    return (
                                        <PressableScale key={subId} style={[styles.subChip, isSelected ? { backgroundColor: c.substituted, borderColor: c.substituted } : { borderColor: c.glassBorder, backgroundColor: c.surface }]} onPress={() => setSubstitutedBy(subId)}>
                                            <Text style={[styles.subChipText, isSelected && { color: '#FFF' }]}>{sub.name}</Text>
                                        </PressableScale>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    <Text style={styles.label}>Notes</Text>
                    <TextInput style={styles.input} placeholder="Add optional note..." placeholderTextColor={c.subtext} value={note} onChangeText={setNote} multiline />
                </ScrollView>

                <View style={styles.stickyFooter}>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={handleClearMark}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <View style={styles.clearBtn}>
                            <Trash2 size={18} color={c.danger} />
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={handleConfirmAdvanced}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <LinearGradient
                            colors={c.gradients?.primary || [c.primary, c.primary]}
                            style={styles.saveBtn}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        >
                            <Save size={18} color="#FFF" />
                            <Text style={styles.saveBtnText}>Save</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
                <Animated.View style={[styles.modalWrapper, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    <LinearGradient colors={c.glassBg} style={styles.modalContent}>
                        <View style={styles.dragHandle} />
                        <View style={{ flex: 1 }}>
                            {advancedClass ? (
                                <View style={{ flex: 1 }}>
                                    {renderAdvancedContent()}
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <View style={styles.header}>
                                        <View>
                                            <Text style={styles.title}>Attendance</Text>
                                            <View style={styles.dateRow}>
                                                <CalendarIcon size={14} color={c.primary} />
                                                <Text style={styles.dateText}>{new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })}</Text>
                                            </View>
                                        </View>
                                        <PressableScale onPress={onClose} style={styles.closeBtn}>
                                            <X size={20} color={c.text} />
                                        </PressableScale>
                                    </View>

                                    <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} style={{ flex: 1 }}>
                                        {groupedClasses.length > 0 ? (
                                            groupedClasses.map((cls, index) => {
                                                const isMarked = cls.marked_status && cls.marked_status !== 'pending';
                                                const statusColor = cls.marked_status === 'absent' ? c.danger : (cls.marked_status === 'present' ? c.success : c.primary);

                                                return (
                                                    <View key={index} style={styles.classItem}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.className}>{cls.name || cls.code}</Text>
                                                            <Text style={styles.classTime}>{cls.time}</Text>
                                                        </View>
                                                        <View style={styles.actions}>
                                                            {isMarked ? (
                                                                <PressableScale style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]} onPress={() => openAdvanced(cls)}>
                                                                    <Text style={[styles.statusText, { color: statusColor }]}>{cls.marked_status.toUpperCase()}</Text>
                                                                </PressableScale>
                                                            ) : (
                                                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                                                    <PressableScale style={[styles.actionIcon, { backgroundColor: c.success + '15' }]} onPress={() => onMark(getSafeId(cls._id || cls.id), 'present', '', cls.log_id, false, cls.type)}>
                                                                        <Check size={18} color={c.success} />
                                                                    </PressableScale>
                                                                    <PressableScale style={[styles.actionIcon, { backgroundColor: c.danger + '15' }]} onPress={() => onMark(getSafeId(cls._id || cls.id), 'absent', '', cls.log_id, false, cls.type)}>
                                                                        <XIcon size={18} color={c.danger} />
                                                                    </PressableScale>
                                                                </View>
                                                            )}
                                                            <TouchableOpacity onPress={() => openAdvanced(cls)} style={{ padding: 4 }}>
                                                                <MoreHorizontal size={20} color={c.subtext} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )
                                            })
                                        ) : (
                                            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                                                <AlertCircle size={40} color={c.subtext} style={{ marginBottom: 12, opacity: 0.5 }} />
                                                <Text style={{ color: c.subtext, fontSize: 15, fontWeight: '600' }}>No classes scheduled for today</Text>
                                            </View>
                                        )}

                                        {attendanceLogs.length > 0 && (
                                            <View style={{ marginTop: 24 }}>
                                                <Text style={styles.sectionLabel}>Recently Marked</Text>
                                                {attendanceLogs.map((log, idx) => (
                                                    <View key={idx} style={[styles.classItem, { paddingVertical: 12 }]}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[styles.className, { fontSize: 14 }]}>{log.subject_name || 'Class'}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                                <Text style={{ fontSize: 11, color: c.subtext, fontWeight: '700' }}>{log.status.toUpperCase()}</Text>
                                                                {log.status === 'substituted' && log.substituted_by_name && (
                                                                    <Text style={{ fontSize: 10, color: c.substituted, fontStyle: 'italic' }}>
                                                                        (Sub by: {log.substituted_by_name})
                                                                    </Text>
                                                                )}
                                                            </View>
                                                            {log.notes ? (
                                                                <Text style={{ fontSize: 11, color: c.subtext, fontStyle: 'italic', marginTop: 2, opacity: 0.8 }} numberOfLines={2}>
                                                                    "{log.notes}"
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                        <PressableScale onPress={() => deleteLog(log._id)} style={styles.deleteBtn}>
                                                            <Trash2 size={16} color={c.danger} />
                                                        </PressableScale>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </LinearGradient>
                </Animated.View>
            </View>
        </Modal>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalWrapper: { width: '100%', maxHeight: height * 0.92 },
    modalContent: { borderRadius: 32, paddingTop: 12, paddingBottom: 0, borderWidth: 1, borderColor: c.glassBorder, minHeight: height * 0.5, maxHeight: height * 0.92, overflow: 'hidden' },
    dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 24 },
    title: { fontSize: 24, fontWeight: '800', color: c.text, letterSpacing: -0.5 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    dateText: { fontSize: 14, color: c.primary, fontWeight: '600' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    classItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: c.surface, marginBottom: 12, borderWidth: 1, borderColor: c.glassBorder },
    className: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 2 },
    classTime: { fontSize: 12, color: c.subtext },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800' },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: c.subtext, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
    deleteBtn: { padding: 8, backgroundColor: c.danger + '10', borderRadius: 10 },
    advHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 24 },
    advTitle: { fontSize: 24, fontWeight: '900', color: c.text, letterSpacing: -0.5 },
    advSub: { fontSize: 13, color: c.subtext, marginTop: 2 },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    statusOption: {
        width: '48.5%',
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderRadius: 27,
        borderWidth: 1.5,
        borderColor: c.glassBorder,
        backgroundColor: c.surface,
        overflow: 'hidden',
        marginBottom: 10
    },
    statusLabel: { fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
    label: { fontSize: 11, color: c.subtext, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
    input: { backgroundColor: c.surface, borderRadius: 20, padding: 16, color: c.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: c.glassBorder, marginBottom: 20, fontSize: 14 },
    stickyFooter: {
        flexDirection: 'row',
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 64 : 74,
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: c.glassBorder,
        backgroundColor: isDark ? '#000000' : '#FFF',
        paddingHorizontal: 24,
        alignItems: 'center'
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 28,
        backgroundColor: isDark ? 'rgba(255, 59, 48, 0.12)' : 'rgba(255, 59, 48, 0.05)',
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 59, 48, 0.1)',
        paddingHorizontal: 20,
        width: '100%'
    },
    clearBtnText: { color: c.danger, fontWeight: '900', fontSize: 16, letterSpacing: 0.5, marginLeft: 8, textAlign: 'center' },
    saveBtn: {
        height: 56,
        borderRadius: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        overflow: 'hidden',
        width: '100%',
        backgroundColor: c.primary // Fallback
    },
    saveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 0.5, textAlign: 'center', marginLeft: 8 },
    subChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1 },
    subChipText: { fontWeight: '700', fontSize: 12, color: c.subtext }
});

export default MarkAttendanceModal;

