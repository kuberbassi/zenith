import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, Platform, StatusBar,
    TouchableOpacity, FlatList, Alert, Modal, TextInput, ScrollView, ActivityIndicator, Animated, Dimensions
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, Layout } from '../theme';
import { attendanceService } from '../services';
import { ChevronLeft, Plus, Trash2, Clock, MapPin, Book, Edit2, Coffee, LayoutDashboard, CheckCircle2, XCircle, Settings, Calendar, GripVertical, X } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import AnimatedHeader from '../components/AnimatedHeader';
import { useSemester } from '../contexts/SemesterContext';
import PressableScale from '../components/PressableScale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const { height } = Dimensions.get('window');

const TimetableScreen = ({ navigation }) => {
    const { isDark, colors: themeColors } = useTheme();
    const { selectedSemester } = useSemester();
    const insets = useSafeAreaInsets();

    // Merge dynamic theme colors with local overrides
    const c = {
        ...themeColors,
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',
        glassBgStart: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
        glassBgEnd: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.65)',
        glassBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        text: isDark ? '#FFF' : '#1E1F22',
        subtext: isDark ? '#BABBBD' : '#6B7280',
        primary: themeColors.primary, // Use dynamic accent
        danger: theme.palette.red,
        surface: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        modalBg: isDark ? ['#000000', '#000000'] : ['rgba(255, 255, 255, 0.98)', 'rgba(248, 249, 250, 0.98)']
    };

    const styles = getStyles(c, isDark, insets);
    const queryClient = useQueryClient();

    const [selectedDay, setSelectedDay] = useState('Monday');
    const scrollY = useRef(new Animated.Value(0)).current;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

    // Queries
    const { data: timetableData, isLoading: timetableLoading, refetch: refetchTimetable } = useQuery({
        queryKey: ['timetable', selectedSemester],
        queryFn: () => attendanceService.getTimetable(selectedSemester),
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects', selectedSemester],
        queryFn: () => attendanceService.getSubjects(selectedSemester),
    });

    const { data: markedClasses = [] } = useQuery({
        queryKey: ['attendance_logs', todayStr, selectedSemester],
        queryFn: () => attendanceService.getClassesForDate(todayStr, selectedSemester),
    });

    const timetable = timetableData?.schedule || {};
    const periods = timetableData?.periods || [];
    const isFetching = !!(timetableLoading || timetableData === undefined);
    const refreshing = timetableLoading || isFetching;
    const loading = timetableLoading;

    const fetchData = () => {
        refetchTimetable();
        queryClient.invalidateQueries({ queryKey: ['attendance_logs', todayStr, selectedSemester] });
    };

    // Enrich timetable with marked status for today
    const effectiveTimetable = { ...timetable };
    if (selectedDay === todayName && effectiveTimetable[selectedDay]) {
        effectiveTimetable[selectedDay] = effectiveTimetable[selectedDay].map(slot => {
            const marked = markedClasses.find(m => m.subject_id === slot.subject_id);
            return { ...slot, marked_status: marked ? marked.marked_status : 'pending' };
        });
    }

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [structureModalVisible, setStructureModalVisible] = useState(false);
    const [tempPeriods, setTempPeriods] = useState([]);
    const [newSlot, setNewSlot] = useState({
        subject_id: '', name: '', startTime: '09:00 AM', endTime: '10:00 AM',
        time: '', classroom: '', type: 'Lecture'
    });
    const [addingSlot, setAddingSlot] = useState(false);
    // Time Picker State
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [timePickerTarget, setTimePickerTarget] = useState('start');
    const [tempTime, setTempTime] = useState({ hour: 9, minute: 0, period: 'AM' });

    // Animation Refs
    const modalScale = useRef(new Animated.Value(0.9)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;
    const structureScale = useRef(new Animated.Value(0.9)).current;
    const structureOpacity = useRef(new Animated.Value(0)).current;
    const pickerScale = useRef(new Animated.Value(0.9)).current;
    const pickerOpacity = useRef(new Animated.Value(0)).current;

    const animateModal = (toVisible, animScale, animOpacity) => {
        if (toVisible) {
            animScale.setValue(0.9);
            animOpacity.setValue(0);
            Animated.parallel([
                Animated.spring(animScale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(animOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();
        }
    };

    useEffect(() => {
        if (modalVisible) animateModal(true, modalScale, modalOpacity);
    }, [modalVisible]);

    useEffect(() => {
        if (structureModalVisible) animateModal(true, structureScale, structureOpacity);
    }, [structureModalVisible]);

    useEffect(() => {
        if (timePickerVisible) animateModal(true, pickerScale, pickerOpacity);
    }, [timePickerVisible]);

    const openTimePicker = (target) => {
        setTimePickerTarget(target);
        const timeStr = target === 'start' ? newSlot.startTime : newSlot.endTime;
        if (timeStr) {
            const [time, period] = timeStr.split(' ');
            const [h, m] = time.split(':');
            setTempTime({ hour: parseInt(h), minute: parseInt(m), period: period });
        }
        setTimePickerVisible(true);
    };

    const handleTimeConfirm = () => {
        const h = tempTime.hour.toString().padStart(2, '0');
        const m = tempTime.minute.toString().padStart(2, '0');
        const timeStr = `${h}:${m} ${tempTime.period}`;

        if (timePickerTarget === 'start') {
            setNewSlot(prev => ({ ...prev, startTime: timeStr }));
        } else {
            setNewSlot(prev => ({ ...prev, endTime: timeStr }));
        }
        setTimePickerVisible(false);
    };

    const [editingSlot, setEditingSlot] = useState(null);

    // ... existing Time Picker logic ...

    // Helper to normalize IDs for comparison
    const safeId = (id) => {
        if (!id) return '';
        return typeof id === 'object' ? (id.$oid || id.toString()) : String(id);
    };

    const handleEditStart = (slot) => {
        setEditingSlot(slot);
        setNewSlot({
            subject_id: safeId(slot.subject_id) || '',
            name: slot.name || '',
            startTime: slot.startTime || slot.time.split(' - ')[0] || '09:00 AM',
            endTime: slot.endTime || slot.time.split(' - ')[1] || '10:00 AM',
            classroom: slot.classroom || '',
            type: slot.type || 'Lecture'
        });
        setModalVisible(true);
    };

    const handleSaveStructure = async () => {
        try {
            await attendanceService.saveTimetableStructure(tempPeriods, selectedSemester);
            setStructureModalVisible(false);
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
        } catch (error) {
            Alert.alert('Error', 'Failed to save structure');
        }
    };

    // ... existing Time Picker logic ...

    const handleMarkAttendance = async (subjectId, status) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await attendanceService.markAttendance(subjectId, status, todayStr);
            queryClient.invalidateQueries({ queryKey: ['attendance_logs', todayStr, selectedSemester] });
        } catch (error) {
            Alert.alert('Error', 'Failed to mark attendance');
        }
    };

    const deleteMutation = useMutation({
        mutationFn: (slotId) => attendanceService.deleteTimetableSlot(slotId, selectedSemester),
        onMutate: async (slotId) => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await queryClient.cancelQueries({ queryKey: ['timetable', selectedSemester] });
            const previousData = queryClient.getQueryData(['timetable', selectedSemester]);

            queryClient.setQueryData(['timetable', selectedSemester], old => {
                if (!old) return old;
                const next = { ...old };
                if (next.schedule && next.schedule[selectedDay]) {
                    next.schedule[selectedDay] = next.schedule[selectedDay].filter(s => s._id !== slotId && s.id !== slotId);
                }
                return next;
            });

            return { previousData };
        },
        onError: (err, slotId, context) => {
            queryClient.setQueryData(['timetable', selectedSemester], context.previousData);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
        }
    });

    const handleDeleteSlot = (slotId) => {
        Alert.alert("Delete Class", "Remove this class from the schedule?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(slotId) }
        ]);
    };

    const saveMutation = useMutation({
        mutationFn: (slotData) => attendanceService.addTimetableSlot(slotData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
            setModalVisible(false);
            setEditingSlot(null);
            setNewSlot({ subject_id: '', name: '', startTime: '09:00 AM', endTime: '10:00 AM', classroom: '', type: 'Lecture' });
        },
        onError: () => Alert.alert("Error", "Failed to save changes.")
    });

    const handleSaveSlot = async () => {
        if (!newSlot.subject_id && !['Break', 'Free'].includes(newSlot.type)) {
            return Alert.alert("Missing Fields", "Please select a subject.");
        }

        const slotData = {
            day: selectedDay,
            semester: selectedSemester,
            ...newSlot,
            time: `${newSlot.startTime} - ${newSlot.endTime}`
        };

        saveMutation.mutate(slotData);
    };



    const renderSlotItem = ({ item, index }) => {
        // Handle legacy string items (rare now, but for safety)
        if (typeof item === 'string') {
            const typeMap = { 'c': 'Lecture', 'l': 'Lab', 'b': 'Break', 't': 'Tutorial' };
            const time = periods[index] ? `${periods[index].startTime} - ${periods[index].endTime}` : 'No Time';
            return (
                <View style={[styles.timelineRow, { opacity: 0.7 }]}>
                    <View style={styles.timelineLeft}>
                        <Text style={styles.timeStart}>{periods[index] ? periods[index].startTime : '--:--'}</Text>
                        <Text style={styles.timeEnd}>{periods[index] ? periods[index].endTime : '--:--'}</Text>
                    </View>
                    <View style={styles.timelineLineContainer}>
                        <View style={styles.timelineLine} />
                        <View style={styles.timelineDot} />
                    </View>
                    <View style={styles.timelineContent}>
                        <Text style={styles.timelineSubject}>{typeMap[item] || 'Class'}</Text>
                    </View>
                </View>
            );
        }

        // Map legacy type codes
        const codeMap = { 'c': 'Lecture', 'l': 'Lab', 'b': 'Break', 't': 'Tutorial' };
        // Derive time from periods if missing
        let displayTime = item.time;
        if (periods[index]) {
            displayTime = `${periods[index].startTime} - ${periods[index].endTime}`;
        }

        let startTime = '09:00';
        let endTime = '10:00';
        if (displayTime && displayTime.includes('-')) {
            [startTime, endTime] = displayTime.split('-').map(s => s.trim());
        } else if (item.startTime && item.endTime) {
            startTime = item.startTime;
            endTime = item.endTime;
        }

        // Break/Free Logic
        let displaySubject = 'Unknown Subject';
        let infoIcon = <Book size={14} color={c.subtext} />;

        const isStructureBreak = (item._structType && item._structType.toLowerCase() === 'break') ||
            (periods[index] && periods[index].type && periods[index].type.toLowerCase() === 'break');

        // Case-insensitive type checks
        const itemType = (item.type || '').toLowerCase();
        const isFree = itemType === 'free';
        const isBreak = itemType === 'break' || isStructureBreak;
        const isCustom = itemType === 'custom';

        const isToday = selectedDay === (['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]);

        // Status from Slot (if backend returned it via classes_for_date)
        const status = item.marked_status || 'pending';

        const safeId = (id) => {
            if (!id) return '';
            return typeof id === 'object' ? (id.$oid || id.toString()) : String(id);
        };

        if (isBreak) {
            displaySubject = 'Break';
            infoIcon = <Coffee size={14} color={theme.palette.orange} />;
        } else if (isFree) {
            displaySubject = 'Free Slot';
            infoIcon = <LayoutDashboard size={14} color={c.subtext} />;
        } else if (isCustom) {
            displaySubject = item.label || item.name || 'Custom';
            infoIcon = <Edit2 size={14} color={c.subtext} />;
        } else {
            let subjectName = item.name || item.subject_name;
            if (item.subject_id) {
                const normalizedItemId = safeId(item.subject_id || item.subjectId);
                // Try finding by _id or id
                const foundSub = subjects.find(s => {
                    const sId = safeId(s._id || s.id);
                    return sId === normalizedItemId;
                });

                if (foundSub) {
                    subjectName = foundSub.name;
                } else {
                    // Debug info for unknown subjects
                    console.log(`[Timetable] Unknown Subject: ItemID=${normalizedItemId} (${item.subject_id}), AvailSubjects=${subjects.length}`);
                    if (subjects.length > 0 && index === 0) {
                        console.log(`[Timetable] Sample Subject ID: ${safeId(subjects[0]._id)}`);
                    }
                }
            }
            if (subjectName) displaySubject = subjectName;
        }

        const getSubjectColor = (name) => {
            const lower = (name || '').toLowerCase();
            if (lower.includes('lab') || lower.includes('practical')) return theme.palette.green;
            if (lower.includes('break')) return theme.palette.orange;
            if (lower.includes('math')) return theme.palette.cyan;
            return theme.palette.purple;
        };

        const accentColor = getSubjectColor(displaySubject);

        // Determine if last item to hide connector line
        const isLast = index === currentSlots.length - 1;

        return (
            <View style={styles.timelineRow}>
                {/* Left: Time */}
                <View style={styles.timelineLeft}>
                    <Text style={styles.timeStart} numberOfLines={1} adjustsFontSizeToFit>{startTime}</Text>
                    <Text style={styles.timeEnd} numberOfLines={1}>{endTime}</Text>
                </View>

                {/* Middle: Line & Dot */}
                <View style={styles.timelineLineContainer}>
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: c.glassBorder }]} />}
                    <View style={[styles.timelineDot, { borderColor: accentColor, backgroundColor: c.surface }]} >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor }} />
                    </View>
                </View>

                {/* Right: Content */}
                <View style={styles.timelineContentWrapper}>
                    <PressableScale
                        onPress={() => item.subject_id && !isStructureBreak && !isFree && handleEditStart(item)}
                        style={{ flex: 1 }}
                    >
                        <LinearGradient
                            colors={isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.4)']}
                            style={[styles.timelineCard, { borderColor: isBreak ? 'transparent' : c.glassBorder }]}
                            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                        >
                            <View style={styles.cardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    {infoIcon}
                                    <Text style={[styles.timelineSubject, isBreak && { color: theme.palette.orange }]} numberOfLines={1}>{displaySubject}</Text>
                                </View>

                                {/* Status Indicators */}
                                {!isBreak && !isFree && (
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {status === 'present' && <View style={[styles.statusBadge, { backgroundColor: theme.palette.green + '20' }]}><CheckCircle2 size={12} color={theme.palette.green} /></View>}
                                        {status === 'absent' && <View style={[styles.statusBadge, { backgroundColor: theme.palette.red + '20' }]}><XCircle size={12} color={theme.palette.red} /></View>}
                                    </View>
                                )}
                            </View>

                            {/* Location / Details */}
                            {item.classroom ? (
                                <View style={styles.cardDetailRow}>
                                    <MapPin size={12} color={c.subtext} />
                                    <Text style={styles.cardDetailText}>{item.classroom}</Text>
                                </View>
                            ) : null}
                        </LinearGradient>

                        {/* Quick Actions (Today Only) */}
                        {isToday && item.subject_id && !isStructureBreak && !isFree && (
                            <View style={styles.quickActions}>
                                <PressableScale style={[styles.actionBtn, status === 'present' && styles.actionBtnActive]} onPress={() => handleMarkAttendance(item.subject_id, 'present')}>
                                    <Text style={[styles.actionBtnText, status === 'present' && { color: theme.palette.green }]}>P</Text>
                                </PressableScale>
                                <View style={styles.actionDivider} />
                                <PressableScale style={[styles.actionBtn, status === 'absent' && styles.actionBtnActive]} onPress={() => handleMarkAttendance(item.subject_id, 'absent')}>
                                    <Text style={[styles.actionBtnText, status === 'absent' && { color: theme.palette.red }]}>A</Text>
                                </PressableScale>
                            </View>
                        )}
                    </PressableScale>

                    {/* Delete Action - Outside card to be distinct */}
                    {item.subject_id && !isStructureBreak && !isFree && (
                        <PressableScale onPress={() => handleDeleteSlot(item.id || item._id)} style={styles.deleteSideBtn}>
                            <Trash2 size={16} color={c.danger} />
                        </PressableScale>
                    )}
                </View>
            </View>
        );
    };

    // Merge Structure (Periods) with Schedule (Slots)
    const getMinutes = (t) => {
        if (!t) return -1;
        const lower = t.toString().toLowerCase().replace(/\s/g, '');
        const isPM = lower.includes('pm');
        const isAM = lower.includes('am');

        let timePart = lower.replace(/[a-z]/g, ''); // Remove non-digit/colon
        let [h, m] = timePart.split(':').map(Number);

        if (isNaN(h)) return -1;
        if (isNaN(m)) m = 0;

        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0; // 12 AM is 00:00

        return h * 60 + m;
    };

    // Merge Structure (Periods) with Schedule (Slots)
    const rawDailySlots = effectiveTimetable[selectedDay] || [];
    const dailySlots = [...rawDailySlots].sort((a, b) => {
        const aTime = a.startTime || a.start_time || (a.time ? a.time.split('-')[0] : '');
        const bTime = b.startTime || b.start_time || (b.time ? b.time.split('-')[0] : '');
        return getMinutes(aTime) - getMinutes(bTime);
    });

    const sortedPeriods = [...periods].sort((a, b) => getMinutes(a.startTime) - getMinutes(b.startTime));

    const currentSlots = sortedPeriods.length > 0 ? sortedPeriods.map((period, index) => {
        const periodStart = getMinutes(period.startTime);

        const slot = dailySlots.find(s => {
            const sTime = s.startTime || s.start_time || (s.time ? s.time.split('-')[0] : '');
            const slotStart = getMinutes(sTime);
            return Math.abs(slotStart - periodStart) < 5; // 5 min tolerance
        });

        if (slot) return { ...slot, _structType: period.type };

        // If no slot exists, return a placeholder based on Structure
        // Case-insensitive check for 'break'
        const isBreakPeriod = period.type && period.type.toLowerCase() === 'break';

        return {
            _id: `empty_${index}_${selectedDay}`,
            type: isBreakPeriod ? 'Break' : 'Free',
            startTime: period.startTime,
            endTime: period.endTime,
            time: `${period.startTime} - ${period.endTime}`,
            subject_id: null,
            name: isBreakPeriod ? 'Break' : 'Free Slot',
            _structType: period.type
        };
    }) : dailySlots;

    return (
        <View style={styles.container}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* Content placeholder - AnimatedHeader moved to bottom for layering */}

            {/* Content */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
            ) : (
                <Animated.FlatList
                    data={currentSlots}
                    renderItem={renderSlotItem}
                    keyExtractor={(item, idx) => item.id || item._id || idx.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={<View style={{ height: Layout.header.maxHeight + insets.top + 20 }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No classes for {selectedDay}</Text>
                            <Text style={styles.emptySubText}>Tap + to add a class</Text>
                        </View>
                    }
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                    onRefresh={fetchData} refreshing={refreshing}
                    progressViewOffset={Layout.header.maxHeight + insets.top}
                    tintColor={c.primary}
                />
            )}

            {/* UNIVERSAL ANIMATED HEADER - MOVED TO FRONT LAYER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Timetable"
                badge={`SEM ${selectedSemester}`}
                subtitle="DAILY SCHEDULE"
                isDark={isDark}
                colors={c}
                // No onBack for main tab
                rightComponent={
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <PressableScale onPress={() => {
                            setTempPeriods(JSON.parse(JSON.stringify(periods)));
                            setStructureModalVisible(true);
                        }} style={styles.addBtn}>
                            <Settings size={22} color={c.text} />
                        </PressableScale>
                        <PressableScale onPress={() => {
                            setEditingSlot(null);
                            setNewSlot({ subject_id: '', name: '', startTime: '09:00 AM', endTime: '10:00 AM', classroom: '', type: 'Lecture' });
                            setModalVisible(true);
                        }} style={styles.addBtn}>
                            <Plus size={24} color={c.primary} />
                        </PressableScale>
                    </View>
                }
            >
                {/* Day Tabs */}
                <View style={styles.daysContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
                        {(DAYS || []).map(day => (
                            <PressableScale
                                key={day}
                                style={[styles.dayTab, selectedDay === day && styles.activeDayTab]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedDay(day);
                                }}
                            >
                                <Text style={[styles.dayText, selectedDay === day && styles.activeDayText]}>
                                    {day.substring(0, 3)}
                                </Text>
                            </PressableScale>
                        ))}
                    </ScrollView>
                </View>
            </AnimatedHeader>

            {/* ADD SLOT MODAL */}
            <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 }}>
                    <TouchableOpacity noTexture style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} activeOpacity={1} />
                    <Animated.View style={[styles.modalContent, { transform: [{ scale: modalScale }], opacity: modalOpacity }]}>
                        <Text style={styles.modalTitle}>{editingSlot ? 'Edit Class' : 'Add Class'} ({selectedDay})</Text>

                        <View style={{ flexShrink: 1 }}>
                            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 4 }} style={{ flexGrow: 0 }}>
                                <Text style={styles.label}>Subject</Text>
                                <View style={styles.subjectGrid}>
                                    {(subjects || []).map(sub => {
                                        const subId = safeId(sub._id || sub.id);
                                        const isSelected = safeId(newSlot.subject_id) === subId;
                                        return (
                                            <PressableScale
                                                key={subId}
                                                style={[styles.subjectChip, isSelected && { backgroundColor: c.primary, borderColor: c.primary }]}
                                                onPress={() => setNewSlot({ ...newSlot, subject_id: subId, name: sub.name })}
                                            >
                                                <Text style={[styles.subjectChipText, isSelected && { color: '#FFF' }]}>{sub.name}</Text>
                                            </PressableScale>
                                        );
                                    })}
                                </View>

                                {periods.length === 0 && (
                                    <>
                                        <Text style={styles.label}>Time Duration</Text>
                                        <View style={styles.timeRangeGrid}>
                                            <PressableScale style={styles.timeInputBox} onPress={() => openTimePicker('start')}>
                                                <Text style={styles.timeLabel}>START</Text>
                                                <Text style={styles.timeVal}>{newSlot.startTime}</Text>
                                            </PressableScale>
                                            <View style={styles.timeDash} />
                                            <PressableScale style={styles.timeInputBox} onPress={() => openTimePicker('end')}>
                                                <Text style={styles.timeLabel}>END</Text>
                                                <Text style={styles.timeVal}>{newSlot.endTime}</Text>
                                            </PressableScale>
                                        </View>
                                    </>
                                )}

                                <Text style={styles.label}>Classroom / Venue</Text>
                                <TextInput
                                    style={styles.inputField}
                                    placeholder="Room 101, Lab A..."
                                    placeholderTextColor={c.subtext}
                                    value={newSlot.classroom}
                                    onChangeText={t => setNewSlot({ ...newSlot, classroom: t })}
                                />
                            </ScrollView>

                            <View style={styles.stickyFooter}>
                                {editingSlot && (
                                    <PressableScale style={[styles.secondaryBtn, { backgroundColor: c.danger + '15' }]} onPress={() => { setModalVisible(false); handleDeleteSlot(editingSlot.id || editingSlot._id); }}>
                                        <Trash2 size={20} color={c.danger} />
                                    </PressableScale>
                                )}
                                <PressableScale style={styles.secondaryBtn} onPress={() => setModalVisible(false)}>
                                    <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
                                </PressableScale>
                                <PressableScale onPress={handleSaveSlot} disabled={addingSlot} style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}>
                                    <LinearGradient
                                        colors={c.gradients.primary}
                                        style={styles.primaryBtn}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    >
                                        {addingSlot ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>{editingSlot ? 'Update' : 'Add Class'}</Text>}
                                    </LinearGradient>
                                </PressableScale>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            {/* TIME PICKER MODAL */}
            <Modal transparent visible={timePickerVisible} animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTimePickerVisible(false)}>
                    <Animated.View style={[styles.pickerContainer, { transform: [{ scale: pickerScale }], opacity: pickerOpacity }]}>
                        <LinearGradient colors={isDark ? theme.gradients.cardDark : theme.gradients.cardLight} style={{ padding: 24, borderRadius: 32, borderWidth: 1, borderColor: c.glassBorder }}>
                            <Text style={styles.pickerTitle}>Select Time</Text>
                            <View style={styles.pickerRow}>
                                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                        <PressableScale key={`h_${h}`} style={[styles.pickerItem, tempTime.hour === h && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, hour: h }))}>
                                            <Text style={[styles.pickerText, tempTime.hour === h && styles.pickerSelectedText]}>{h.toString().padStart(2, '0')}</Text>
                                        </PressableScale>
                                    ))}
                                </ScrollView>
                                <Text style={styles.colon}>:</Text>
                                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                        <PressableScale key={`m_${m}`} style={[styles.pickerItem, tempTime.minute === m && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, minute: m }))}>
                                            <Text style={[styles.pickerText, tempTime.minute === m && styles.pickerSelectedText]}>{m.toString().padStart(2, '0')}</Text>
                                        </PressableScale>
                                    ))}
                                </ScrollView>
                                <View style={styles.ampmColumn}>
                                    {['AM', 'PM'].map(p => (
                                        <PressableScale key={p} style={[styles.pickerItem, tempTime.period === p && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, period: p }))}>
                                            <Text style={[styles.pickerText, tempTime.period === p && styles.pickerSelectedText]}>{p}</Text>
                                        </PressableScale>
                                    ))}
                                </View>
                            </View>
                            <PressableScale style={{ borderRadius: 14, overflow: 'hidden', marginTop: 12 }} onPress={handleTimeConfirm}>
                                <LinearGradient
                                    colors={c.gradients.primary}
                                    style={styles.confirmBtn}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.confirmText}>Confirm</Text>
                                </LinearGradient>
                            </PressableScale>
                        </LinearGradient>
                    </Animated.View>
                </TouchableOpacity>
            </Modal>

            {/* STRUCTURE MODAL */}
            <Modal animationType="fade" transparent visible={structureModalVisible} onRequestClose={() => setStructureModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <TouchableOpacity noTexture style={StyleSheet.absoluteFill} onPress={() => setStructureModalVisible(false)} activeOpacity={1} />
                    <Animated.View style={[styles.modalContent, { transform: [{ scale: structureScale }], opacity: structureOpacity }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Daily Grid</Text>
                                <Text style={styles.modalSub}>Semester Structure</Text>
                            </View>
                            <PressableScale onPress={() => setStructureModalVisible(false)} style={styles.closeBtn}>
                                <X size={20} color={c.text} />
                            </PressableScale>
                        </View>

                        <View style={{ flexShrink: 1 }}>
                            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 4 }} style={{ flexGrow: 0 }}>
                                {tempPeriods.map((p, idx) => (
                                    <LinearGradient
                                        key={idx}
                                        colors={[c.glassBgStart, c.glassBgEnd]}
                                        style={[styles.structureCard, { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.glassBorder }]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    >
                                        <View style={{ width: 4, height: '60%', backgroundColor: c.primary, borderRadius: 2, marginRight: 8 }} />
                                        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                                            <TextInput
                                                style={styles.miniInput}
                                                value={p.startTime}
                                                onChangeText={t => {
                                                    const newP = [...tempPeriods];
                                                    newP[idx].startTime = t;
                                                    setTempPeriods(newP);
                                                }}
                                                placeholder="Start"
                                                placeholderTextColor={c.subtext}
                                            />
                                            <TextInput
                                                style={styles.miniInput}
                                                value={p.endTime}
                                                onChangeText={t => {
                                                    const newP = [...tempPeriods];
                                                    newP[idx].endTime = t;
                                                    setTempPeriods(newP);
                                                }}
                                                placeholder="End"
                                                placeholderTextColor={c.subtext}
                                            />
                                        </View>
                                        <PressableScale onPress={() => setTempPeriods(tempPeriods.filter((_, i) => i !== idx))} style={styles.deleteIconBox}>
                                            <Trash2 size={16} color={c.danger} />
                                        </PressableScale>
                                    </LinearGradient>
                                ))}

                                <PressableScale
                                    style={styles.addPeriodGhostBtn}
                                    onPress={() => setTempPeriods([...tempPeriods, { startTime: '09:00 AM', endTime: '10:00 AM', type: 'Lecture' }])}
                                >
                                    <Plus size={20} color={c.primary} />
                                    <Text style={{ color: c.primary, fontWeight: '700', fontSize: 14 }}>Add Period</Text>
                                </PressableScale>
                            </ScrollView>
                        </View>

                        <View style={styles.stickyFooter}>
                            <PressableScale style={styles.cancelActionBtn} onPress={() => setStructureModalVisible(false)}>
                                <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
                            </PressableScale>
                            <PressableScale style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }} onPress={handleSaveStructure}>
                                <LinearGradient
                                    colors={c.gradients.primary}
                                    style={styles.saveActionBtn}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.saveActionText}>Save Configuration</Text>
                                </LinearGradient>
                            </PressableScale>
                        </View>
                    </Animated.View>
                </View>
            </Modal>


        </View >
    );
};

const getStyles = (c, isDark, insets) => StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: {
        padding: 20,
        paddingBottom: 100 + insets.bottom
    },

    addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' },
    daysContainer: { height: 48, marginTop: 12, marginBottom: 8 },
    daysScroll: { paddingHorizontal: 20, gap: 10 },
    dayTab: { paddingHorizontal: 18, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderWidth: 1, borderColor: 'transparent' },
    activeDayTab: { backgroundColor: c.primary, borderColor: c.primary },
    dayText: { fontSize: 13, fontWeight: '700', color: c.subtext },
    activeDayText: { color: '#FFF' },

    // Timeline Row
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 0,
        minHeight: 70, // Changed fixed height to minHeight for better scaling if text grows
    },
    timelineLeft: {
        width: 68, // Increased from 50 to 68 to fit "08:30 AM"
        alignItems: 'flex-end',
        paddingRight: 10,
        paddingTop: 8,
    },
    timeStart: {
        fontSize: 12.5, // Slight reduction
        fontWeight: '800',
        color: c.text,
        letterSpacing: -0.2,
    },
    timeEnd: {
        fontSize: 10,
        fontWeight: '600',
        color: c.subtext,
        marginTop: 2,
    },
    timelineLineContainer: {
        width: 20,
        alignItems: 'center',
    },
    timelineLine: {
        width: 2,
        height: '100%',
        backgroundColor: c.glassBorder,
        position: 'absolute',
        top: 20, // Start line below dot
        bottom: 0,
    },
    timelineDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        marginTop: 8, // Align with time text
    },

    timelineContentWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 16, // Space between rows
        paddingRight: 8,
    },
    timelineCard: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: c.glassBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    timelineSubject: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        flex: 1,
    },
    cardDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    cardDetailText: {
        fontSize: 11,
        color: c.subtext,
        fontWeight: '600',
    },

    // Quick Actions
    quickActions: {
        flexDirection: 'row',
        marginTop: 12,
        backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
        borderRadius: 8,
        padding: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: c.glassBorder,
    },
    actionBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    actionBtnActive: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#FFF',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: c.subtext,
    },
    actionDivider: {
        width: 1,
        backgroundColor: c.glassBorder,
        marginVertical: 4,
    },

    deleteSideBtn: {
        padding: 10,
        marginLeft: 4,
        opacity: 0.6,
        alignSelf: 'center',
    },

    statusBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
    emptyText: { fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 4 },
    emptySubText: { color: c.subtext, fontSize: 14 },

    modalContent: { borderRadius: 32, width: '100%', maxHeight: height * 0.65, overflow: 'hidden', borderWidth: 1, borderColor: c.glassBorder, flexShrink: 1, backgroundColor: isDark ? '#000000' : '#FFF', paddingTop: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
    modalSub: { fontSize: 13, color: c.subtext, fontWeight: '600', paddingHorizontal: 24, marginTop: -15, marginBottom: 15, textAlign: 'center' },
    modalHeader: { paddingBottom: 10 },

    subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    subjectChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, borderColor: c.glassBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
    subjectChipText: { fontSize: 13, fontWeight: '700', color: c.text },

    timeRangeGrid: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    timeInputBox: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: c.glassBorder },
    timeLabel: { fontSize: 10, fontWeight: '800', color: c.subtext, marginBottom: 4 },
    timeVal: { fontSize: 15, fontWeight: '700', color: c.text },
    timeDash: { width: 10, height: 2, backgroundColor: c.glassBorder, borderRadius: 1 },

    inputField: { padding: 18, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderWidth: 1, borderColor: c.glassBorder, color: c.text, fontSize: 15, fontWeight: '600' },

    structureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 20,
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.glassBorder,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.2 : 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    miniInput: { flex: 1, height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: c.text, fontWeight: '700', fontSize: 14 },
    deleteIconBox: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: c.danger + '12', borderRadius: 12 },
    addPeriodGhostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.primary, marginTop: 8 },

    stickyFooter: { flexDirection: 'row', paddingTop: 24, paddingHorizontal: 24, paddingBottom: 24, gap: 12, borderTopWidth: 1, borderTopColor: c.glassBorder, backgroundColor: isDark ? '#000' : '#FFF' },
    cancelActionBtn: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 18, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', alignItems: 'center' },
    primaryBtn: { flex: 1, paddingVertical: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    saveActionText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    pickerContainer: { width: '85%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: c.glassBorder },
    pickerTitle: { fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 20 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', height: 200, paddingHorizontal: 10 },
    columnScroll: { flex: 1 },
    pickerItem: { height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
    pickerSelected: { backgroundColor: c.primary + '20' },
    colon: { fontSize: 24, fontWeight: '800', color: c.text, alignSelf: 'center', paddingBottom: 10 },
    ampmColumn: { flex: 1, justifyContent: 'center', gap: 8 },
    confirmBtn: { padding: 14, borderRadius: 14, alignItems: 'center' },
    confirmText: { color: '#FFF', fontWeight: '800', fontSize: 16 }
});

export default TimetableScreen;



