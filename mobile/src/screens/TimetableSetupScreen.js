import React, { useState, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, TouchableOpacity, FlatList, Alert, Modal, TextInput, ScrollView, ActivityIndicator, Animated, KeyboardAvoidingView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../contexts/ThemeContext';
import { useSemester } from '../contexts/SemesterContext';
import { theme, Layout } from '../theme';
import { ChevronLeft, Plus, Trash2, Clock, MapPin, Book, Edit2, Coffee, LayoutDashboard, Settings, X, Save } from 'lucide-react-native';
import { LinearGradient } from '../components/LinearGradient';
import AnimatedHeader from '../components/AnimatedHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '../services';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableSetupScreen = ({ navigation }) => {
    const { isDark, colors: themeColors } = useTheme();
    const { selectedSemester } = useSemester();
    const insets = useSafeAreaInsets();

    // Merge dynamic theme colors with local overrides
    const c = {
        ...themeColors,
        bgGradStart: isDark ? '#000000' : '#FFFFFF',
        bgGradMid: isDark ? '#000000' : '#F8F9FA',
        bgGradEnd: isDark ? '#000000' : '#FFFFFF',
        glassBgStart: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.85)',
        glassBgEnd: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)',
        glassBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
        text: isDark ? '#FFFFFF' : '#000000',
        subtext: isDark ? '#9CA3AF' : '#6B7280',
        primary: themeColors.primary, // Use dynamic accent
        danger: '#FF3B30',
        surface: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
        modalBg: isDark ? '#000000' : '#FFFFFF',
    };


    const styles = getStyles(c, isDark);

    // Helper to normalize IDs
    const safeId = (id) => {
        if (!id) return '';
        return typeof id === 'object' ? (id.$oid || id.toString()) : String(id);
    };

    const [selectedDay, setSelectedDay] = useState('Monday');
    const scrollY = useRef(new Animated.Value(0)).current;
    const queryClient = useQueryClient();

    // Queries
    const { data: timetableData, isLoading: timetableLoading, refetch: refetchTimetable } = useQuery({
        queryKey: ['timetable', selectedSemester],
        queryFn: () => attendanceService.getTimetable(selectedSemester),
    });

    const { data: subjects = [] } = useQuery({
        queryKey: ['subjects', selectedSemester],
        queryFn: () => attendanceService.getSubjects(selectedSemester),
    });

    const timetable = timetableData?.schedule || {};
    const periods = timetableData?.periods || [];

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [newSlot, setNewSlot] = useState({
        subject_id: '', name: '', startTime: '', endTime: '',
        time: '', classroom: '', type: 'Lecture'
    });
    const [showCustomTime, setShowCustomTime] = useState(false);
    const [addingSlot, setAddingSlot] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);

    // Structure Editor State
    const [structureModalVisible, setStructureModalVisible] = useState(false);
    const [tempPeriods, setTempPeriods] = useState([]);
    const [savingStructure, setSavingStructure] = useState(false);

    // Time Picker State
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [timePickerTarget, setTimePickerTarget] = useState('start'); // 'start' | 'end' | 'struct_start_idx' | 'struct_end_idx'
    const [timePickerIndex, setTimePickerIndex] = useState(null); // For structure editing
    const [tempTime, setTempTime] = useState({ hour: 9, minute: 0, period: 'AM' });

    const openTimePicker = (target, index = null) => {
        setTimePickerTarget(target);
        setTimePickerIndex(index);

        let timeStr = '09:00 AM';

        if (target === 'start') timeStr = newSlot.startTime;
        else if (target === 'end') timeStr = newSlot.endTime;
        else if (target === 'struct_start' && index !== null) timeStr = tempPeriods[index].startTime;
        else if (target === 'struct_end' && index !== null) timeStr = tempPeriods[index].endTime;

        if (timeStr) {
            const [time, period] = timeStr.split(' ');
            if (time && period) {
                const [h, m] = time.split(':');
                setTempTime({ hour: parseInt(h), minute: parseInt(m), period: period });
            }
        }
        setTimePickerVisible(true);
    };

    const handleTimeConfirm = () => {
        // Enforce strict 12-hour format: hh:mm AM/PM (e.g., 09:00 AM)
        let h = tempTime.hour;
        const m = tempTime.minute.toString().padStart(2, '0');
        const p = tempTime.period === 'AM' ? 'AM' : 'PM';

        // Handle 12 vs 0 edge cases if needed, but standard 12h clock usually has 12:00
        // Ensure hour is 1-12 range for display
        if (h === 0) h = 12;
        if (h > 12) h = h - 12; // Should not happen with typical picker limit logic but safe guard.

        const hStr = h.toString().padStart(2, '0');
        const timeStr = `${hStr}:${m} ${p}`;

        if (timePickerTarget === 'start') {
            setNewSlot(prev => ({ ...prev, startTime: timeStr }));
        } else if (timePickerTarget === 'end') {
            setNewSlot(prev => ({ ...prev, endTime: timeStr }));
        } else if (timePickerTarget === 'struct_start' && timePickerIndex !== null) {
            const updated = Array.isArray(tempPeriods) ? [...tempPeriods] : [];
            if (updated[timePickerIndex]) {
                updated[timePickerIndex].startTime = timeStr;
                setTempPeriods(updated);
            }
        } else if (timePickerTarget === 'struct_end' && timePickerIndex !== null) {
            const updated = Array.isArray(tempPeriods) ? [...tempPeriods] : [];
            if (updated[timePickerIndex]) {
                updated[timePickerIndex].endTime = timeStr;
                setTempPeriods(updated);
            }
        }
        setTimePickerVisible(false);
    };

    const fetchData = () => {
        refetchTimetable();
        queryClient.invalidateQueries({ queryKey: ['subjects', selectedSemester] });
    };

    // Structure Editor Functions
    const openStructureEditor = () => {
        // Initialize with default slots if empty, or just copy existing
        const initialPeriods = (periods && periods.length > 0) ? periods : [];
        setTempPeriods(JSON.parse(JSON.stringify(initialPeriods))); // Deep copy
        setStructureModalVisible(true);
    };

    const handleAddPeriod = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const currentP = Array.isArray(tempPeriods) ? tempPeriods : [];
        setTempPeriods([...currentP, {
            id: `p-${Date.now()}`,
            name: '', // Empty name by default to avoid redundancy
            startTime: '09:00 AM',
            endTime: '10:00 AM',
            type: 'class'
        }]);
    };

    const handleDeletePeriod = (index) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const updated = Array.isArray(tempPeriods) ? [...tempPeriods] : [];
        if (updated[index]) {
            updated.splice(index, 1);
            setTempPeriods(updated);
        }
    };

    const togglePeriodType = (index) => {
        Haptics.selectionAsync();
        const updated = Array.isArray(tempPeriods) ? [...tempPeriods] : [];
        // Toggle between 'class' and 'break' (lowercase)
        if (updated[index]) {
            updated[index].type = updated[index].type === 'break' ? 'class' : 'break';
            setTempPeriods(updated);
        }
    };

    const saveStructureMutation = useMutation({
        mutationFn: (newPeriods) => attendanceService.saveTimetableStructure(newPeriods, selectedSemester),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
            setStructureModalVisible(false);
        },
        onError: (err) => {
            Alert.alert("Error", "Failed to save grid structure.");
        }
    });

    const handleSaveStructure = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        saveStructureMutation.mutate(tempPeriods);
    };


    const saveSlotMutation = useMutation({
        mutationFn: async (slotData) => {
            // If editing, delete the old slot first
            if (editingSlot && (editingSlot.id || editingSlot._id)) {
                await attendanceService.deleteTimetableSlot(editingSlot.id || editingSlot._id, selectedSemester);
            }
            return attendanceService.addTimetableSlot(slotData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
            setModalVisible(false);
            setEditingSlot(null);
            setNewSlot({ subject_id: '', name: '', startTime: '09:00 AM', endTime: '10:00 AM', classroom: '', type: 'Lecture' });
        },
        onError: (error) => {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || "Failed to add class.";
            Alert.alert("Error", errorMessage);
        }
    });

    const handleAddSlot = (quickData = null) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Check if quickData is an event object (has nativeEvent)
        const isEvent = quickData && (quickData.nativeEvent || quickData._dispatchInstances);
        const slotData = (quickData && !isEvent) ? quickData : newSlot;

        if (!slotData.subject_id && !['Break', 'Free', 'Custom'].includes(slotData.type)) {
            return Alert.alert("Missing Fields", "Please select a subject.");
        }

        const payload = {
            semester: selectedSemester,
            day: selectedDay,
            ...slotData,
            start_time: slotData.startTime || newSlot.startTime,
            end_time: slotData.endTime || newSlot.endTime,
            time: `${slotData.startTime || newSlot.startTime} - ${slotData.endTime || newSlot.endTime}`
        };

        saveSlotMutation.mutate(payload);
    };

    const deleteSlotMutation = useMutation({
        mutationFn: (slotId) => attendanceService.deleteTimetableSlot(slotId, selectedSemester),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timetable', selectedSemester] });
        }
    });

    const handleDeleteSlot = (slotId) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Delete Class", "Remove this class from the schedule?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    deleteSlotMutation.mutate(slotId);
                }
            }
        ]);
    };

    const formatTimeDisplay = (timeStr) => {
        if (!timeStr) return { time: '--:--', period: '' };
        const lower = timeStr.toLowerCase().trim();
        let period = '';
        let time = lower;

        if (lower.includes('am')) {
            period = 'AM';
            time = lower.replace('am', '').trim();
        } else if (lower.includes('pm')) {
            period = 'PM';
            time = lower.replace('pm', '').trim();
        }

        return { time, period };
    };

    const renderSlotItem = ({ item, index }) => {
        // Time Sync Logic
        let displayTime = item.time;
        if (periods[index]) {
            displayTime = `${periods[index].startTime} - ${periods[index].endTime}`;
        }

        let startTime = '09:00 AM';
        let endTime = '10:00 AM';
        if (displayTime && displayTime.includes('-')) {
            [startTime, endTime] = displayTime.split('-').map(s => s.trim());
        } else if (item.startTime && item.endTime) {
            startTime = item.startTime;
            endTime = item.endTime;
        }

        const start = formatTimeDisplay(startTime);
        const end = formatTimeDisplay(endTime);

        // Break/Free Logic
        let displaySubject = 'Unknown Subject';
        let infoIcon = <Book size={14} color={c.subtext} />;

        const isStructureBreak = periods[index] && periods[index].type && periods[index].type.toLowerCase() === 'break';

        // Case-insensitive type checks
        let itemType = (item.type || '').toLowerCase();
        const isFree = itemType === 'free';
        const isBreak = itemType === 'break' || isStructureBreak;
        const isCustom = itemType === 'custom';

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
            if (!subjectName && item.subject_id) {
                const normalizedItemId = safeId(item.subject_id);
                const foundSub = (Array.isArray(subjects) ? subjects : []).find(s => {
                    const sId = safeId(s._id || s.id);
                    return sId === normalizedItemId;
                });
                if (foundSub) subjectName = foundSub.name;
            }
            if (subjectName) displaySubject = subjectName;
        }

        const onEdit = () => {
            let start = '09:00 AM', end = '10:00 AM';
            if (displayTime && displayTime.includes('-')) {
                const parts = displayTime.split('-');
                if (parts.length === 2) [start, end] = parts.map(s => s.trim());
            }

            // Normalize type for button highlights
            let normalizedType = (item.type || 'Lecture').charAt(0).toUpperCase() + (item.type || 'Lecture').slice(1).toLowerCase();
            if (normalizedType === 'Class') normalizedType = 'Lecture';
            if (normalizedType === 'Free_slot') normalizedType = 'Free';

            setNewSlot({
                subject_id: safeId(item.subject_id) || '',
                name: displaySubject === 'Break' || displaySubject === 'Free/Empty' ? '' : displaySubject,
                label: item.label || item.name || '',
                startTime: start,
                endTime: end,
                classroom: item.classroom || '',
                type: normalizedType
            });
            setEditingSlot(item);
            setModalVisible(true);
        };

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
                {/* Left: Time (Optimized) */}
                <View style={styles.timelineLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', width: '100%' }}>
                        <Text style={styles.timeStartMain}>{start.time}</Text>
                        <Text style={styles.timeStartPeriod}>{start.period}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', width: '100%', marginTop: -2 }}>
                        <Text style={styles.timeEndMain}>{end.time}</Text>
                        <Text style={styles.timeEndPeriod}>{end.period}</Text>
                    </View>
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
                    <Pressable onPress={onEdit} style={{ flex: 1 }}>
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
                            </View>

                            {/* Location / Details */}
                            {item.classroom ? (
                                <View style={styles.cardDetailRow}>
                                    <MapPin size={12} color={c.subtext} />
                                    <Text style={styles.cardDetailText}>{item.classroom}</Text>
                                </View>
                            ) : null}
                        </LinearGradient>
                    </Pressable>

                    {/* Delete Action - Outside card */}
                    <TouchableOpacity style={styles.deleteSideBtn} onPress={() => handleDeleteSlot(item.id || item._id)}>
                        <Trash2 size={16} color={c.danger} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

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
    const rawDailySlots = Array.isArray(timetable[selectedDay]) ? timetable[selectedDay] : [];
    const dailySlots = [...rawDailySlots].sort((a, b) => {
        const aTime = a.startTime || a.start_time || (a.time ? a.time.split('-')[0] : '');
        const bTime = b.startTime || b.start_time || (b.time ? b.time.split('-')[0] : '');
        return getMinutes(aTime) - getMinutes(bTime);
    });

    const sortedPeriods = Array.isArray(periods) ? [...periods].sort((a, b) => getMinutes(a.startTime) - getMinutes(b.startTime)) : [];

    const currentSlots = sortedPeriods.length > 0 ? sortedPeriods.map((period, index) => {
        // Find matching slot for this period
        const periodStart = getMinutes(period.startTime);

        const slot = dailySlots.find(s => {
            const sTime = s.startTime || s.start_time || (s.time ? s.time.split('-')[0] : '');
            const slotStart = getMinutes(sTime);
            return Math.abs(slotStart - periodStart) < 5; // 5 min tolerance
        });

        if (slot) return { ...slot, _structType: period.type };

        // If no slot exists, return a placeholder based on Structure
        return {
            _id: `empty_${index}_${selectedDay}`,
            type: period.type === 'Break' ? 'Break' : 'Free',
            startTime: period.startTime,
            endTime: period.endTime,
            time: `${period.startTime} - ${period.endTime}`,
            subject_id: null,
            name: period.type === 'Break' ? 'Break' : 'Free Slot',
            _structType: period.type
        };
    }) : dailySlots; // Fallback if no structure defined

    return (
        <View style={styles.container}>
            <LinearGradient colors={[c.bgGradStart, c.bgGradMid, c.bgGradEnd]} noTexture style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

            {/* UNIVERSAL ANIMATED HEADER */}
            {/* Content placeholder - AnimatedHeader moved to bottom for layering */}

            {/* Content */}
            {timetableLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
            ) : (
                <Animated.FlatList
                    data={currentSlots}
                    renderItem={renderSlotItem}
                    keyExtractor={(item, idx) => item.id || item._id || idx.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={<View style={{ height: Layout.header.maxHeight + insets.top - 50 }} />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No classes for {selectedDay}</Text>
                            <Text style={styles.emptySubText}>Tap + to add a class</Text>
                        </View>
                    }
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
                    onRefresh={fetchData} refreshing={false}
                    progressViewOffset={Layout.header.maxHeight + insets.top}
                    tintColor={c.primary}
                    colors={[c.primary]}
                    progressBackgroundColor={c.modalBg}
                />
            )}

            {/* UNIVERSAL ANIMATED HEADER - MOVED TO FRONT LAYER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="Timetable"
                badge={`SEM ${selectedSemester}`}
                subtitle="MANAGE SCHEDULE"
                isDark={isDark}
                colors={c}
                onBack={() => navigation.goBack()}
                rightComponent={
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={openStructureEditor} style={styles.addBtn}>
                            <Settings size={22} color={c.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
                            <Plus size={24} color={c.primary} />
                        </TouchableOpacity>
                    </View>
                }
            >
                {/* Day Tabs */}
                <View style={styles.daysContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
                        {DAYS.map(day => (
                            <TouchableOpacity
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
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </AnimatedHeader>

            {/* Structure Editor Modal - Centered Premium Style */}
            <Modal animationType="fade" transparent visible={structureModalVisible} onRequestClose={() => setStructureModalVisible(false)}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                    activeOpacity={1}
                    onPress={() => setStructureModalVisible(false)}
                >
                    <Pressable style={styles.centeredModal} onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.modalContentCentered, { backgroundColor: c.modalBg }]}>
                            <View style={styles.dragHandle} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 24 }}>
                                <Text style={styles.modalTitle}>Edit Grid Structure</Text>
                                <TouchableOpacity onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setStructureModalVisible(false);
                                }}>
                                    <View style={{ padding: 8, backgroundColor: c.surface, borderRadius: 12 }}>
                                        <Text style={{ color: c.subtext, fontWeight: '700' }}>Close</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                style={{ maxHeight: 300, flexGrow: 0 }}
                                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 8 }}
                                scrollEventThrottle={16}
                                nestedScrollEnabled={true}
                                bounces={true}
                            >
                                {tempPeriods.map((p, index) => (
                                    <LinearGradient
                                        key={index}
                                        colors={[c.glassBgStart, c.glassBgEnd]}
                                        style={[styles.structRow, { backgroundColor: 'transparent' }]}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    >
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ fontWeight: '800', color: c.text, fontSize: 12 }}>{index + 1}</Text>
                                                </View>
                                                <View style={styles.structInput}>
                                                    <TextInput
                                                        style={{ color: c.text, fontWeight: '700', fontSize: 14, padding: 0 }}
                                                        value={p.name}
                                                        placeholder={`Period ${index + 1}`}
                                                        placeholderTextColor={c.subtext}
                                                        onChangeText={(text) => {
                                                            const updated = [...tempPeriods];
                                                            updated[index].name = text;
                                                            setTempPeriods(updated);
                                                        }}
                                                    />
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                <TouchableOpacity
                                                    style={[styles.structTypeBtn, p.type === 'break' ? { borderColor: '#FFA500', backgroundColor: '#FF950015' } : { borderColor: c.primary, backgroundColor: c.primary + '15' }]}
                                                    onPress={() => togglePeriodType(index)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Text style={[styles.structTypeText, p.type === 'break' ? { color: '#FFA500' } : { color: c.primary }]}>
                                                        {p.type === 'break' ? 'BREAK' : 'CLASS'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.iconBtn, { backgroundColor: c.surface, borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }]}
                                                    onPress={() => handleDeletePeriod(index)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Trash2 size={16} color={c.danger} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
                                            <TouchableOpacity
                                                style={styles.timePill}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    openTimePicker('struct_start', index);
                                                }}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <Clock size={11} color={c.subtext} />
                                                <Text style={{ color: c.text, fontWeight: '600', fontSize: 12 }}>{p.startTime}</Text>
                                            </TouchableOpacity>
                                            <Text style={{ color: c.subtext, fontWeight: '600', fontSize: 12 }}>—</Text>
                                            <TouchableOpacity
                                                style={styles.timePill}
                                                onPress={() => {
                                                    Haptics.selectionAsync();
                                                    openTimePicker('struct_end', index);
                                                }}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <Clock size={11} color={c.subtext} />
                                                <Text style={{ color: c.text, fontWeight: '600', fontSize: 12 }}>{p.endTime}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>
                                ))}
                            </ScrollView>

                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingHorizontal: 24, paddingBottom: 24 }}>
                                <TouchableOpacity onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    handleAddPeriod();
                                }} style={[styles.saveBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary, paddingVertical: 14, paddingHorizontal: 18, flex: 1 }]}>
                                    <Plus size={18} color={c.primary} />
                                    <Text style={{ color: c.primary, fontWeight: '700', marginLeft: 6, fontSize: 14 }}>Add Period</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveBtn, { paddingVertical: 14, paddingHorizontal: 18, flex: 1.5, borderRadius: 16, overflow: 'hidden' }]}
                                    onPress={handleSaveStructure}
                                    disabled={savingStructure}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <LinearGradient
                                        colors={c.gradients.primary}
                                        style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}
                                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    >
                                        {savingStructure ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save & Close</Text>}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </TouchableOpacity>
            </Modal>

            {/* ADD SLOT MODAL - Centered Premium Style */}
            <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <Pressable
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
                        onPress={() => { setModalVisible(false); setEditingSlot(null); }}
                    >
                        <Pressable style={styles.centeredModal} onPress={(e) => e.stopPropagation()}>
                            <View style={[styles.modalContentCentered, { backgroundColor: c.modalBg }]}>
                                <View style={styles.dragHandle} />

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 24 }}>
                                    <Text style={{ fontSize: 24, fontWeight: '800', color: c.text, flex: 1, letterSpacing: -0.5 }}>
                                        {editingSlot ? 'Edit Class' : 'New Class'}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: c.glassBorder }}>
                                        <Clock size={12} color={c.primary} style={{ marginRight: 6 }} />
                                        <Text style={{ fontWeight: '700', color: c.text, fontSize: 13 }}>{newSlot.startTime || '--:--'} - {newSlot.endTime || '--:--'}</Text>
                                    </View>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
                                    <View style={{ paddingBottom: 20, paddingTop: 4, paddingHorizontal: 24 }}>
                                        <Text style={styles.label}>Time Slot</Text>
                                        <View style={{ height: 60, marginBottom: 20 }}>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                                {periods.map((p, index) => {
                                                    const periodStartMin = getMinutes(p.startTime);
                                                    const slotStartMin = getMinutes(newSlot.startTime);
                                                    const isSelected = Math.abs(periodStartMin - slotStartMin) < 5;
                                                    return (
                                                        <TouchableOpacity
                                                            key={index}
                                                            style={[styles.timeChip, isSelected && styles.timeChipSelected]}
                                                            onPress={() => {
                                                                const isBreakPeriod = p.type && p.type.toLowerCase() === 'break';
                                                                setNewSlot({
                                                                    ...newSlot,
                                                                    startTime: p.startTime,
                                                                    endTime: p.endTime,
                                                                    type: isBreakPeriod ? 'Break' : 'Lecture'
                                                                });
                                                            }}
                                                        >
                                                            <Text style={[styles.timeChipNum, isSelected && styles.timeChipTextSelected]}>{p.type === 'break' || p.type === 'Break' ? 'Break' : (index + 1)}</Text>
                                                            <Text style={[styles.timeChipText, isSelected && styles.timeChipTextSelected]}>{p.startTime}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>

                                        {/* Quick Actions: Break, Free, Custom */}
                                        <Text style={styles.label}>Select Slot Type</Text>
                                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                            <TouchableOpacity
                                                style={[styles.quickActionBtn, {
                                                    backgroundColor: (newSlot.type || '').toLowerCase() === 'break' ? '#FF950020' : c.surface,
                                                    borderColor: '#FF9500',
                                                    borderWidth: 1
                                                }]}
                                                onPress={() => handleAddSlot({ type: 'Break', subject_id: null, name: 'Break' })}
                                            >
                                                <Coffee size={20} color="#FF9500" />
                                                <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Break</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.quickActionBtn, {
                                                    backgroundColor: (newSlot.type || '').toLowerCase() === 'free' ? '#34C75920' : c.surface,
                                                    borderColor: '#34C759',
                                                    borderWidth: 1
                                                }]}
                                                onPress={() => handleAddSlot({ type: 'Free', subject_id: null, name: 'Free' })}
                                            >
                                                <LayoutDashboard size={20} color="#34C759" />
                                                <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Free</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.quickActionBtn, { backgroundColor: (newSlot.type || '').toLowerCase() === 'custom' ? c.primary + '20' : c.surface, borderColor: c.primary, borderWidth: 1 }]}
                                                onPress={() => setNewSlot({ ...newSlot, type: 'Custom', subject_id: null })}
                                            >
                                                <Edit2 size={20} color={c.primary} />
                                                <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>Custom</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Custom Name Input - Show when Custom is selected */}
                                        {newSlot.type === 'Custom' && (
                                            <View style={{ marginBottom: 20 }}>
                                                <Text style={styles.label}>Custom Name</Text>
                                                <TextInput
                                                    style={[styles.input, { marginBottom: 10 }]}
                                                    placeholder="e.g. Library, Sports, Lab"
                                                    placeholderTextColor={c.subtext}
                                                    value={newSlot.label || ''}
                                                    onChangeText={(txt) => setNewSlot({ ...newSlot, label: txt, name: txt })}
                                                    autoFocus
                                                />
                                                <TouchableOpacity
                                                    style={{ backgroundColor: c.primary, padding: 12, borderRadius: 10, alignItems: 'center' }}
                                                    onPress={() => newSlot.label && handleAddSlot({ type: 'Custom', subject_id: null, label: newSlot.label, name: newSlot.label })}
                                                >
                                                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Custom Slot</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Always Show Subjects */}
                                        <View style={{ flex: 1, marginTop: 10 }}>
                                            <Text style={styles.label}>Assign Subject</Text>
                                            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
                                                <View style={styles.subGrid}>
                                                    {Array.isArray(subjects) ? subjects.map((sub, mapIdx) => {
                                                        const subId = safeId(sub._id || sub.id);
                                                        const isSelected = safeId(newSlot.subject_id) === subId;

                                                        return (
                                                            <TouchableOpacity
                                                                key={subId || `sub-${mapIdx}`}
                                                                style={[styles.subCard, isSelected && styles.subCardSelected]}
                                                                onPress={() => setNewSlot({ ...newSlot, subject_id: subId, name: sub.name, type: 'Lecture' })}
                                                            >
                                                                <Text style={styles.subName} numberOfLines={2}>{sub.name}</Text>
                                                                <Text style={styles.subLabel}>{sub.professor || 'No Prof'}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    }) : null}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    </View>
                                </ScrollView>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setEditingSlot(null); }}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleAddSlot()} disabled={addingSlot} style={{ flex: 2, borderRadius: 16, overflow: 'hidden' }}>
                                        <LinearGradient
                                            colors={c.gradients.primary}
                                            style={[styles.saveBtn, { height: '100%' }]}
                                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                        >
                                            {addingSlot ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>{editingSlot ? 'Update' : 'Add Class'}</Text>}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Pressable>
                    </Pressable>
                </KeyboardAvoidingView>
            </Modal>

            {/* TIME PICKER MODAL */}
            <Modal transparent visible={timePickerVisible} animationType="fade" onRequestClose={() => setTimePickerVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTimePickerVisible(false)}>
                    <View style={[styles.pickerContainer, { backgroundColor: 'transparent', padding: 0 }]}>
                        <LinearGradient
                            colors={isDark ? theme.gradients.cardDark : theme.gradients.cardLight}
                            style={{ padding: 20, borderRadius: 24, width: '100%', borderWidth: 1, borderColor: c.glassBorder }}
                        >
                            <Text style={styles.pickerTitle}>Select Time</Text>
                            <View style={styles.pickerRow}>
                                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                        <TouchableOpacity key={`h_${h}`} style={[styles.pickerItem, tempTime.hour === h && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, hour: h }))}>
                                            <Text style={[styles.pickerText, tempTime.hour === h && styles.pickerSelectedText]}>{h.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <Text style={styles.colon}>:</Text>
                                <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                        <TouchableOpacity key={`m_${m}`} style={[styles.pickerItem, tempTime.minute === m && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, minute: m }))}>
                                            <Text style={[styles.pickerText, tempTime.minute === m && styles.pickerSelectedText]}>{m.toString().padStart(2, '0')}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <View style={styles.ampmColumn}>
                                    {['AM', 'PM'].map(p => (
                                        <TouchableOpacity key={p} style={[styles.pickerItem, tempTime.period === p && styles.pickerSelected]} onPress={() => setTempTime(prev => ({ ...prev, period: p }))}>
                                            <Text style={[styles.pickerText, tempTime.period === p && styles.pickerSelectedText]}>{p}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </LinearGradient>
                        <View style={{ borderRadius: 14, overflow: 'hidden', marginTop: 10 }}>
                            <Pressable onPress={handleTimeConfirm}>
                                <LinearGradient
                                    colors={c.gradients.primary}
                                    style={styles.confirmBtn}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.confirmText}>Confirm</Text>
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View >
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    backBtn: { padding: 8, backgroundColor: c.glassBgEnd, borderRadius: 12 },
    title: { fontSize: 20, fontWeight: '800', color: c.text },
    addBtn: { padding: 8, backgroundColor: c.glassBgEnd, borderRadius: 12 },

    daysContainer: { marginBottom: 10 },
    daysScroll: { paddingHorizontal: 20, gap: 10 },
    dayTab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: c.glassBgEnd, borderWidth: 1, borderColor: c.glassBorder },
    activeDayTab: { backgroundColor: c.primary, borderColor: c.primary },
    dayText: { color: c.subtext, fontWeight: '700' },
    activeDayText: { color: '#FFF' },

    listContent: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Timeline Row
    timelineRow: {
        flexDirection: 'row',
        marginBottom: 0,
        height: 70, // Fixed height for alignment
    },
    timelineLeft: {
        width: 60,
        alignItems: 'flex-end',
        paddingRight: 10,
        paddingTop: 4
    },
    // Optimized Time Typography
    timeStartMain: { fontSize: 15, fontWeight: '700', color: c.text },
    timeStartPeriod: { fontSize: 10, fontWeight: '600', color: c.subtext, marginLeft: 2, marginBottom: 2 },

    timeEndMain: { fontSize: 12, fontWeight: '600', color: c.subtext },
    timeEndPeriod: { fontSize: 9, fontWeight: '500', color: c.subtext, marginLeft: 2 },
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

    deleteSideBtn: {
        padding: 10,
        marginLeft: 4,
        opacity: 0.6,
        alignSelf: 'center',
    },

    actions: { flexDirection: 'row', alignItems: 'center' },
    iconBtn: { padding: 8, marginLeft: 4 },

    // Removed unused: timeBox,
    emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { fontSize: 18, fontWeight: '700', color: c.text },
    emptySubText: { color: c.subtext },

    // Modal - Centered Premium Style
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
    centeredModal: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '85%',
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    modalContentCentered: {
        borderRadius: 32,
        width: '100%',
        maxHeight: '90%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.glassBorder,
        paddingTop: 12
    },
    modalContent: {
        backgroundColor: c.glassBgEnd, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24,
        width: '100%', borderWidth: 1, borderColor: c.glassBorder,
        borderBottomWidth: 0,
        position: 'absolute', bottom: 0 // Force absolute bottom
    },
    dragHandle: { width: 40, height: 4, backgroundColor: c.glassBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '800', color: c.subtext, marginBottom: 16, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 },


    subjectList: { maxHeight: 150, marginBottom: 10 },
    subjectOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: c.glassBorder },
    selectedOption: { backgroundColor: c.primary + '20', borderRadius: 12, borderBottomWidth: 0 },
    optionText: { color: c.text, fontWeight: '600' },
    selectedOptionText: { color: c.primary, fontWeight: '800' },

    input: { backgroundColor: c.surface, padding: 16, borderRadius: 16, color: c.text, fontWeight: '600', borderWidth: 1, borderColor: c.glassBorder },

    timeRangeContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    timeInputBtn: { flex: 1, backgroundColor: c.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder },
    timeLabel: { fontSize: 10, color: c.subtext, fontWeight: '700', marginBottom: 4 },
    timeValue: { fontSize: 15, fontWeight: '700', color: c.text },
    timeSeparator: { width: 10, height: 2, backgroundColor: c.glassBorder },

    modalActions: { flexDirection: 'row', gap: 16, marginTop: 32, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.glassBorder },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 16, backgroundColor: c.surface },
    saveBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 16, backgroundColor: c.primary, flexDirection: 'row', justifyContent: 'center' },
    cancelText: { color: c.text, fontWeight: '700' },
    saveText: { color: '#FFF', fontWeight: '800' },

    // Structure Editor items
    structRow: { padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface },
    structInput: { backgroundColor: c.glassBgEnd, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 100 },
    structTypeBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
    structTypeText: { fontWeight: '800', fontSize: 9 },
    timePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.glassBgEnd, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: c.glassBorder },

    // Time Picker
    pickerContainer: { borderRadius: 24, padding: 20, width: '85%', borderWidth: 1, borderColor: c.glassBorder },
    pickerTitle: { fontSize: 18, fontWeight: '800', color: c.text, textAlign: 'center', marginBottom: 20 },
    pickerRow: { flexDirection: 'row', height: 180, marginBottom: 20 },
    columnScroll: { flex: 1 },
    pickerItem: { paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    pickerSelected: { backgroundColor: c.primary + '20' },
    pickerText: { fontSize: 18, color: c.subtext, fontWeight: '600' },
    pickerSelectedText: { color: c.primary, fontWeight: '800', fontSize: 22 },
    colon: { fontSize: 24, fontWeight: '800', color: c.text, alignSelf: 'center', paddingBottom: 10 },
    ampmColumn: { flex: 1, justifyContent: 'center', gap: 8 },
    confirmBtn: { padding: 14, alignItems: 'center', justifyContent: 'center' },
    confirmText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

    // Grid Layouts
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    gridItem: { width: '30%', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface, alignItems: 'center' },
    quickActionBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
    gridItemSelected: { backgroundColor: c.primary, borderColor: c.primary },
    gridItemText: { fontWeight: '700', color: c.text, fontSize: 16, marginBottom: 2 },
    gridItemSub: { fontSize: 10, color: c.subtext },

    // Type Pills - Compact 2x2 Grid
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    typePill: { width: '48%', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },
    typePillSelected: { borderColor: c.primary, backgroundColor: c.primary + '15' },
    typeText: { fontWeight: '800', color: c.text, fontSize: 13, marginTop: 4 },
    typeTextSelected: { color: c.primary },

    // Subject Grid - Expanded
    subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 20 },
    subCard: { width: '48%', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surface, minHeight: 80, justifyContent: 'center' },
    subCardSelected: { borderColor: c.primary, backgroundColor: c.primary + '15' },
    subName: { fontSize: 15, fontWeight: '700', color: c.text, marginBottom: 4 },
    subLabel: { fontSize: 10, color: c.subtext },

    // Time Chips
    timeChip: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
        backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder,
        alignItems: 'center', minWidth: 60
    },
    timeChipSelected: {
        backgroundColor: c.primary, borderColor: c.primary
    },
    timeChipNum: { fontSize: 10, color: c.subtext, fontWeight: '700', marginBottom: 2 },
    timeChipText: { fontSize: 13, color: c.text, fontWeight: '700' },
    timeChipTextSelected: { color: '#FFF' }
});

export default TimetableSetupScreen;



